const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { generateContaminationNumber } = require('../utils/contaminationNumber');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const INCIDENT_INCLUDE = {
  order: {
    select: {
      id: true,
      order_number: true,
      supplier_id: true,
      status: true,
      planned_date: true,
      supplier: { select: { id: true, name: true } },
    },
  },
  sorting_session: {
    select: { id: true, status: true, recorded_at: true },
  },
  fee_master: {
    select: {
      id: true,
      fee_type: true,
      description: true,
      rate_type: true,
      rate_value: true,
      min_cap: true,
      max_cap: true,
    },
  },
  recorded_by_user: {
    select: { id: true, full_name: true },
  },
};

// --- Fee Calculation ---

async function calculateContaminationFee(incident, contractId, orderSubtotal, tx) {
  const penalties = await tx.contractContaminationPenalty.findMany({
    where: { contract_id: contractId },
    include: { fee: true },
  });

  if (!penalties.length) {
    return { fee_amount: null, fee_master_id: null };
  }

  // Find first active fee from the penalties
  const activePenalty = penalties.find((p) => p.fee.is_active);
  if (!activePenalty) {
    return { fee_amount: null, fee_master_id: null };
  }

  const fee = activePenalty.fee;

  // Check tolerance: if contamination % is within tolerance, no fee
  const contract = await tx.supplierContract.findUnique({
    where: { id: contractId },
    select: { contamination_tolerance_pct: true },
  });

  if (
    contract &&
    incident.contamination_pct != null &&
    Number(incident.contamination_pct) <= Number(contract.contamination_tolerance_pct)
  ) {
    return { fee_amount: 0, fee_master_id: fee.id };
  }

  // Calculate fee by rate_type
  let feeAmount = 0;
  const rateValue = Number(fee.rate_value);

  switch (fee.rate_type) {
    case 'FIXED':
      feeAmount = rateValue;
      break;
    case 'PERCENTAGE':
      feeAmount = (orderSubtotal || 0) * rateValue / 100;
      break;
    case 'PER_KG':
      feeAmount = (Number(incident.contamination_weight_kg) || 0) * rateValue;
      break;
    case 'PER_HOUR':
      feeAmount = (Number(incident.estimated_hours) || 0) * rateValue;
      break;
    default:
      feeAmount = 0;
  }

  // Apply min/max caps
  if (fee.min_cap != null && feeAmount < Number(fee.min_cap)) {
    feeAmount = Number(fee.min_cap);
  }
  if (fee.max_cap != null && feeAmount > Number(fee.max_cap)) {
    feeAmount = Number(fee.max_cap);
  }

  return { fee_amount: feeAmount, fee_master_id: fee.id };
}

// --- Find active contract for an order's supplier ---

async function findActiveContractForOrder(order, tx) {
  const plannedDate = new Date(order.planned_date);

  const contract = await tx.supplierContract.findFirst({
    where: {
      supplier_id: order.supplier_id,
      status: 'ACTIVE',
      is_active: true,
      effective_date: { lte: plannedDate },
      OR: [
        { expiry_date: { gte: plannedDate } },
        { expiry_date: null },
      ],
    },
    include: {
      contamination_penalties: { include: { fee: true } },
    },
    orderBy: { effective_date: 'desc' },
  });

  return contract;
}

// --- CRUD ---

async function recordContaminationIncident(data, userId) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate order exists and has valid status
    const order = await tx.inboundOrder.findUnique({
      where: { id: data.order_id },
      select: {
        id: true,
        order_number: true,
        supplier_id: true,
        status: true,
        planned_date: true,
      },
    });

    if (!order) {
      throw createError('Inbound order not found', 404);
    }

    if (!['IN_PROGRESS', 'COMPLETED'].includes(order.status)) {
      throw createError(
        `Order status must be IN_PROGRESS or COMPLETED to record contamination. Current: ${order.status}`,
        400,
      );
    }

    // 2. Validate sorting_session if provided
    if (data.sorting_session_id) {
      const session = await tx.sortingSession.findUnique({
        where: { id: data.sorting_session_id },
        select: { id: true, order_id: true },
      });

      if (!session) {
        throw createError('Sorting session not found', 404);
      }

      if (session.order_id !== data.order_id) {
        throw createError('Sorting session does not belong to the specified order', 400);
      }
    }

    // 3. Find active contract for order's supplier
    const contract = await findActiveContractForOrder(order, tx);

    if (!contract) {
      throw createError('No active contract found for this order\'s supplier', 404);
    }

    // 4. Validate contract has contamination penalty records
    if (!contract.contamination_penalties.length) {
      throw createError('Contract has no contamination penalty configuration', 400);
    }

    // 5. Generate incident number
    const incidentNumber = await generateContaminationNumber(tx);

    // 6. Calculate fee (orderSubtotal = 0 as a default; caller can provide)
    const orderSubtotal = data.order_subtotal || 0;
    const { fee_amount, fee_master_id } = await calculateContaminationFee(
      data,
      contract.id,
      orderSubtotal,
      tx,
    );

    // 7. Create ContaminationIncident
    const incident = await tx.contaminationIncident.create({
      data: {
        incident_number: incidentNumber,
        order_id: data.order_id,
        sorting_session_id: data.sorting_session_id || null,
        contamination_type: data.contamination_type,
        description: data.description,
        contamination_weight_kg: data.contamination_weight_kg || null,
        contamination_pct: data.contamination_pct || null,
        estimated_hours: data.estimated_hours || null,
        fee_amount,
        fee_master_id,
        recorded_by: userId,
        notes: data.notes || null,
      },
      include: INCIDENT_INCLUDE,
    });

    // 8. Audit log
    await writeAuditLog(
      {
        userId,
        action: 'CREATE',
        entityType: 'ContaminationIncident',
        entityId: incident.id,
        after: incident,
      },
      tx,
    );

    return incident;
  });
}

async function getContractContaminationConfig(contractId) {
  const contract = await prisma.supplierContract.findUnique({
    where: { id: contractId },
    include: {
      contamination_penalties: {
        include: { fee: true },
      },
    },
  });

  if (!contract) {
    throw createError('Contract not found', 404);
  }

  return {
    contract_id: contract.id,
    contamination_tolerance_pct: contract.contamination_tolerance_pct,
    penalties: contract.contamination_penalties.map((p) => ({
      fee_id: p.fee.id,
      fee_type: p.fee.fee_type,
      description: p.fee.description,
      rate_type: p.fee.rate_type,
      rate_value: p.fee.rate_value,
      min_cap: p.fee.min_cap,
      max_cap: p.fee.max_cap,
      is_active: p.fee.is_active,
    })),
  };
}

async function listContaminationIncidents({ order_id, sorting_session_id, is_invoiced, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (order_id) where.order_id = order_id;
  if (sorting_session_id) where.sorting_session_id = sorting_session_id;
  if (is_invoiced !== undefined && is_invoiced !== '') {
    where.is_invoiced = is_invoiced === 'true' || is_invoiced === true;
  }

  const [incidents, total] = await Promise.all([
    prisma.contaminationIncident.findMany({
      where,
      skip,
      take: limitNum,
      include: INCIDENT_INCLUDE,
      orderBy: { recorded_at: 'desc' },
    }),
    prisma.contaminationIncident.count({ where }),
  ]);

  return {
    data: incidents,
    total,
    page: pageNum,
    limit: limitNum,
  };
}

async function getContaminationIncident(id) {
  const incident = await prisma.contaminationIncident.findUnique({
    where: { id },
    include: INCIDENT_INCLUDE,
  });

  if (!incident) {
    throw createError('Contamination incident not found', 404);
  }

  return incident;
}

async function updateContaminationIncident(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    // Load existing incident
    const existing = await tx.contaminationIncident.findUnique({
      where: { id },
      include: {
        order: {
          select: { id: true, supplier_id: true, planned_date: true },
        },
      },
    });

    if (!existing) {
      throw createError('Contamination incident not found', 404);
    }

    if (existing.is_invoiced) {
      throw createError('Cannot update an invoiced contamination incident', 400);
    }

    // Build update payload
    const updateData = {};
    if (data.contamination_type !== undefined) updateData.contamination_type = data.contamination_type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.contamination_weight_kg !== undefined) updateData.contamination_weight_kg = data.contamination_weight_kg;
    if (data.contamination_pct !== undefined) updateData.contamination_pct = data.contamination_pct;
    if (data.estimated_hours !== undefined) updateData.estimated_hours = data.estimated_hours;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Determine if fee-relevant fields changed
    const feeFieldsChanged =
      data.contamination_weight_kg !== undefined ||
      data.contamination_pct !== undefined ||
      data.estimated_hours !== undefined ||
      data.contamination_type !== undefined;

    if (feeFieldsChanged) {
      // Recalculate fee
      const contract = await findActiveContractForOrder(existing.order, tx);

      if (contract) {
        const mergedIncident = {
          contamination_weight_kg: data.contamination_weight_kg ?? existing.contamination_weight_kg,
          contamination_pct: data.contamination_pct ?? existing.contamination_pct,
          estimated_hours: data.estimated_hours ?? existing.estimated_hours,
        };

        const orderSubtotal = data.order_subtotal || 0;
        const { fee_amount, fee_master_id } = await calculateContaminationFee(
          mergedIncident,
          contract.id,
          orderSubtotal,
          tx,
        );

        updateData.fee_amount = fee_amount;
        updateData.fee_master_id = fee_master_id;
      }
    }

    const updated = await tx.contaminationIncident.update({
      where: { id },
      data: updateData,
      include: INCIDENT_INCLUDE,
    });

    // Audit log
    await writeAuditLog(
      {
        userId,
        action: 'UPDATE',
        entityType: 'ContaminationIncident',
        entityId: id,
        before: existing,
        after: updated,
      },
      tx,
    );

    return updated;
  });
}

module.exports = {
  calculateContaminationFee,
  recordContaminationIncident,
  getContractContaminationConfig,
  listContaminationIncidents,
  getContaminationIncident,
  updateContaminationIncident,
};
