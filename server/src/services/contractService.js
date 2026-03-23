const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { generateContractNumber } = require('../utils/contractNumber');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const MATERIAL_SELECT = {
  id: true,
  code: true,
  name: true,
  weee_category: true,
};

const CONTRACT_INCLUDE = {
  supplier: { select: { id: true, name: true, supplier_type: true } },
  carrier: { select: { id: true, name: true } },
  approved_by_user: { select: { id: true, full_name: true } },
  contract_waste_streams: {
    include: {
      waste_stream: { select: { id: true, name: true, code: true } },
      rate_lines: {
        where: { superseded_at: null },
        include: { material: { select: MATERIAL_SELECT } },
        orderBy: { valid_from: 'asc' },
      },
    },
  },
  rate_lines: {
    where: { superseded_at: null },
    include: {
      material: { select: MATERIAL_SELECT },
    },
    orderBy: { valid_from: 'asc' },
  },
  contamination_penalties: {
    include: { fee: true },
  },
};

const CONTRACT_LIST_INCLUDE = {
  supplier: { select: { id: true, name: true, supplier_type: true } },
  carrier: { select: { id: true, name: true } },
  approved_by_user: { select: { id: true, full_name: true } },
  _count: { select: { rate_lines: { where: { superseded_at: null } } } },
};

function computeRagStatus(expiryDate) {
  const now = new Date();
  const diffMs = new Date(expiryDate).getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 60) return 'GREEN';
  if (diffDays >= 30) return 'AMBER';
  return 'RED';
}

function daysUntilExpiry(expiryDate) {
  const now = new Date();
  const diffMs = new Date(expiryDate).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function enrichContract(contract) {
  if (!contract) return contract;
  return {
    ...contract,
    days_until_expiry: contract.expiry_date ? daysUntilExpiry(contract.expiry_date) : null,
    rag_status: contract.expiry_date ? computeRagStatus(contract.expiry_date) : null,
  };
}

// --- CRUD ---

async function listContracts({ status, supplier_id, search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = { is_active: true };
  if (status) where.status = status;
  if (supplier_id) where.supplier_id = supplier_id;
  if (search) {
    where.OR = [
      { contract_number: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [contracts, total] = await Promise.all([
    prisma.supplierContract.findMany({
      where,
      skip,
      take: limitNum,
      include: CONTRACT_LIST_INCLUDE,
      orderBy: { created_at: 'desc' },
    }),
    prisma.supplierContract.count({ where }),
  ]);

  return {
    data: contracts.map(enrichContract),
    total,
    page: pageNum,
    limit: limitNum,
  };
}

async function getContract(id) {
  const contract = await prisma.supplierContract.findUnique({
    where: { id },
    include: CONTRACT_INCLUDE,
  });
  if (!contract) throw createError('Contract not found', 404);
  return enrichContract(contract);
}

async function getDashboardSummary() {
  const activeContracts = await prisma.supplierContract.findMany({
    where: { status: 'ACTIVE', is_active: true },
    select: { id: true, contract_number: true, name: true, expiry_date: true, supplier: { select: { id: true, name: true } } },
    orderBy: { expiry_date: 'asc' },
  });

  const [draftCount, activeCount, expiredCount, terminatedCount] = await Promise.all([
    prisma.supplierContract.count({ where: { status: 'DRAFT', is_active: true } }),
    prisma.supplierContract.count({ where: { status: 'ACTIVE', is_active: true } }),
    prisma.supplierContract.count({ where: { status: 'EXPIRED', is_active: true } }),
    prisma.supplierContract.count({ where: { status: 'INACTIVE', is_active: true } }),
  ]);

  let green = 0;
  let amber = 0;
  let red = 0;
  const expiringSoon = [];

  for (const c of activeContracts) {
    if (!c.expiry_date) {
      green++;
      continue;
    }
    const rag = computeRagStatus(c.expiry_date);
    if (rag === 'GREEN') green++;
    else if (rag === 'AMBER') amber++;
    else red++;

    if (rag !== 'GREEN' && expiringSoon.length < 10) {
      expiringSoon.push({
        ...c,
        days_until_expiry: daysUntilExpiry(c.expiry_date),
        rag_status: rag,
      });
    }
  }

  return {
    total: draftCount + activeCount + expiredCount + terminatedCount,
    by_status: { DRAFT: draftCount, ACTIVE: activeCount, EXPIRED: expiredCount, INACTIVE: terminatedCount },
    expiry_rag: { green, amber, red },
    expiring_soon: expiringSoon,
  };
}

async function createContract(data, userId) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({
      where: { id: data.supplier_id },
      select: { id: true, is_active: true },
    });
    if (!supplier || !supplier.is_active) throw createError('Active supplier not found', 404);

    // Validate carrier if provided
    if (data.carrier_id) {
      const carrier = await tx.carrier.findUnique({
        where: { id: data.carrier_id },
        select: { id: true, is_active: true },
      });
      if (!carrier || !carrier.is_active) throw createError('Active carrier not found', 404);
    }

    const contractNumber = await generateContractNumber(tx);

    // Auto-fill receiver_name from SystemSetting
    let receiverName = 'Statice B.V.';
    const settings = await tx.systemSetting.findFirst();
    if (settings?.facility_name) receiverName = settings.facility_name;

    // Check for overlapping active contracts for same supplier + carrier before creation
    const effectiveDate = new Date(data.effective_date);
    const expiryDate = data.expiry_date ? new Date(data.expiry_date) : null;

    const overlapWhere = {
      supplier_id: data.supplier_id,
      status: 'ACTIVE',
      is_active: true,
    };
    if (data.carrier_id) overlapWhere.carrier_id = data.carrier_id;
    if (expiryDate) {
      overlapWhere.effective_date = { lte: expiryDate };
    }
    overlapWhere.OR = [
      { expiry_date: { gte: effectiveDate } },
      { expiry_date: null },
    ];

    const overlapping = await tx.supplierContract.findFirst({
      where: overlapWhere,
      select: { contract_number: true },
    });
    if (overlapping) {
      throw createError(`Overlapping active contract exists: ${overlapping.contract_number}`, 409);
    }

    const contract = await tx.supplierContract.create({
      data: {
        contract_number: contractNumber,
        supplier_id: data.supplier_id,
        carrier_id: data.carrier_id || null,
        name: data.name,
        status: 'ACTIVE',
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        receiver_name: receiverName,
        payment_term_days: data.payment_term_days ?? 30,
        invoicing_frequency: data.invoicing_frequency ?? 'MONTHLY',
        currency: data.currency ?? 'EUR',
        invoice_delivery_method: data.invoice_delivery_method || null,
        contamination_tolerance_pct: data.contamination_tolerance_pct ?? 0,
        requires_finance_review: data.requires_finance_review ?? false,
      },
    });

    // Create contract waste streams with nested rate lines
    if (Array.isArray(data.contract_waste_streams) && data.contract_waste_streams.length > 0) {
      // Validate waste stream uniqueness within contract
      const wsIds = data.contract_waste_streams.map((cws) => cws.waste_stream_id);
      if (new Set(wsIds).size !== wsIds.length) {
        throw createError('Duplicate waste stream in contract', 400);
      }

      // Validate waste streams exist
      const wasteStreams = await tx.wasteStream.findMany({
        where: { id: { in: wsIds }, is_active: true },
        select: { id: true },
      });
      const validWsIds = new Set(wasteStreams.map((ws) => ws.id));
      const invalidWs = wsIds.filter((id) => !validWsIds.has(id));
      if (invalidWs.length > 0) throw createError(`Invalid waste stream IDs: ${invalidWs.join(', ')}`, 400);

      // Collect all material IDs for validation
      const allMaterialIds = data.contract_waste_streams
        .flatMap((cws) => (cws.rate_lines || []).map((rl) => rl.material_id));
      if (allMaterialIds.length > 0) {
        const materials = await tx.materialMaster.findMany({
          where: { id: { in: allMaterialIds }, is_active: true },
          select: { id: true },
        });
        const validMaterialIds = new Set(materials.map((m) => m.id));
        const invalidMats = allMaterialIds.filter((id) => !validMaterialIds.has(id));
        if (invalidMats.length > 0) throw createError(`Invalid material IDs: ${invalidMats.join(', ')}`, 400);
      }

      for (const cwsData of data.contract_waste_streams) {
        // Validate material uniqueness within waste stream
        const matPricingKeys = (cwsData.rate_lines || []).map((rl) => `${rl.material_id}:${rl.pricing_model}`);
        if (new Set(matPricingKeys).size !== matPricingKeys.length) {
          throw createError('Duplicate material + pricing model in waste stream', 400);
        }

        const cws = await tx.contractWasteStream.create({
          data: {
            contract_id: contract.id,
            waste_stream_id: cwsData.waste_stream_id,
            afvalstroomnummer: cwsData.afvalstroomnummer,
          },
        });

        // Create rate lines under this waste stream
        if (Array.isArray(cwsData.rate_lines) && cwsData.rate_lines.length > 0) {
          await tx.contractRateLine.createMany({
            data: cwsData.rate_lines.map((rl) => ({
              contract_id: contract.id,
              contract_waste_stream_id: cws.id,
              material_id: rl.material_id,
              pricing_model: rl.pricing_model,
              unit_rate: rl.unit_rate,
              btw_rate: rl.btw_rate ?? 0,
              valid_from: effectiveDate,
              valid_to: expiryDate,
            })),
          });
        }
      }
    }

    // Create standalone rate lines if provided (backward compat)
    if (Array.isArray(data.rate_lines) && data.rate_lines.length > 0) {
      const materialIds = data.rate_lines.map((rl) => rl.material_id);
      const materials = await tx.materialMaster.findMany({
        where: { id: { in: materialIds }, is_active: true },
        select: { id: true },
      });
      const validMaterialIds = new Set(materials.map((m) => m.id));
      const invalid = materialIds.filter((id) => !validMaterialIds.has(id));
      if (invalid.length > 0) throw createError(`Invalid or inactive material IDs: ${invalid.join(', ')}`, 400);

      await tx.contractRateLine.createMany({
        data: data.rate_lines.map((rl) => ({
          contract_id: contract.id,
          material_id: rl.material_id,
          pricing_model: rl.pricing_model,
          unit_rate: rl.unit_rate,
          btw_rate: rl.btw_rate ?? 0,
          valid_from: new Date(rl.valid_from),
          valid_to: rl.valid_to ? new Date(rl.valid_to) : null,
        })),
      });
    }

    // Create penalty links if provided
    if (Array.isArray(data.penalty_fee_ids) && data.penalty_fee_ids.length > 0) {
      const fees = await tx.feeMaster.findMany({
        where: { id: { in: data.penalty_fee_ids }, is_active: true },
        select: { id: true },
      });
      const validFeeIds = new Set(fees.map((f) => f.id));
      const invalidFees = data.penalty_fee_ids.filter((id) => !validFeeIds.has(id));
      if (invalidFees.length > 0) throw createError(`Invalid or inactive fee IDs: ${invalidFees.join(', ')}`, 400);

      await tx.contractContaminationPenalty.createMany({
        data: data.penalty_fee_ids.map((feeId) => ({
          contract_id: contract.id,
          fee_id: feeId,
        })),
      });
    }

    const full = await tx.supplierContract.findUnique({
      where: { id: contract.id },
      include: CONTRACT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'SupplierContract',
      entityId: contract.id,
      after: full,
    }, tx);

    return enrichContract(full);
  });
}

async function updateContract(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!existing) throw createError('Contract not found', 404);

    if (existing.status !== 'ACTIVE') {
      throw createError('Only ACTIVE contracts can be updated', 400);
    }

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.carrier_id !== undefined) updateData.carrier_id = data.carrier_id || null;
    if (data.effective_date !== undefined) updateData.effective_date = new Date(data.effective_date);
    if (data.expiry_date !== undefined) updateData.expiry_date = data.expiry_date ? new Date(data.expiry_date) : null;
    if (data.payment_term_days !== undefined) updateData.payment_term_days = data.payment_term_days;
    if (data.invoicing_frequency !== undefined) updateData.invoicing_frequency = data.invoicing_frequency;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.invoice_delivery_method !== undefined) updateData.invoice_delivery_method = data.invoice_delivery_method || null;
    if (data.contamination_tolerance_pct !== undefined) updateData.contamination_tolerance_pct = data.contamination_tolerance_pct;
    if (data.requires_finance_review !== undefined) updateData.requires_finance_review = data.requires_finance_review;

    await tx.supplierContract.update({
      where: { id },
      data: updateData,
    });

    // Sync contract waste streams (replace-all strategy)
    if (Array.isArray(data.contract_waste_streams)) {
      const effectiveDate = data.effective_date ? new Date(data.effective_date) : existing.effective_date;
      const expiryDate = data.expiry_date !== undefined
        ? (data.expiry_date ? new Date(data.expiry_date) : null)
        : existing.expiry_date;

      // Validate waste stream uniqueness
      const wsIds = data.contract_waste_streams.map((cws) => cws.waste_stream_id);
      if (new Set(wsIds).size !== wsIds.length) {
        throw createError('Duplicate waste stream in contract', 400);
      }

      // Validate waste streams exist
      if (wsIds.length > 0) {
        const wasteStreams = await tx.wasteStream.findMany({
          where: { id: { in: wsIds }, is_active: true },
          select: { id: true },
        });
        const validWsIds = new Set(wasteStreams.map((ws) => ws.id));
        const invalidWs = wsIds.filter((wsId) => !validWsIds.has(wsId));
        if (invalidWs.length > 0) throw createError(`Invalid waste stream IDs: ${invalidWs.join(', ')}`, 400);
      }

      // Validate all material IDs
      const allMaterialIds = data.contract_waste_streams
        .flatMap((cws) => (cws.rate_lines || []).map((rl) => rl.material_id));
      if (allMaterialIds.length > 0) {
        const materials = await tx.materialMaster.findMany({
          where: { id: { in: allMaterialIds }, is_active: true },
          select: { id: true },
        });
        const validMatIds = new Set(materials.map((m) => m.id));
        const invalidMats = allMaterialIds.filter((matId) => !validMatIds.has(matId));
        if (invalidMats.length > 0) throw createError(`Invalid material IDs: ${invalidMats.join(', ')}`, 400);
      }

      // Delete existing rate lines linked to waste streams, then delete waste streams
      const existingCwsIds = (existing.contract_waste_streams || []).map((cws) => cws.id);
      if (existingCwsIds.length > 0) {
        await tx.contractRateLine.deleteMany({
          where: { contract_waste_stream_id: { in: existingCwsIds } },
        });
        await tx.contractWasteStream.deleteMany({
          where: { contract_id: id },
        });
      }

      // Re-create waste streams with rate lines
      for (const cwsData of data.contract_waste_streams) {
        const matPricingKeys = (cwsData.rate_lines || []).map((rl) => `${rl.material_id}:${rl.pricing_model}`);
        if (new Set(matPricingKeys).size !== matPricingKeys.length) {
          throw createError('Duplicate material + pricing model in waste stream', 400);
        }

        const cws = await tx.contractWasteStream.create({
          data: {
            contract_id: id,
            waste_stream_id: cwsData.waste_stream_id,
            afvalstroomnummer: cwsData.afvalstroomnummer,
          },
        });

        if (Array.isArray(cwsData.rate_lines) && cwsData.rate_lines.length > 0) {
          await tx.contractRateLine.createMany({
            data: cwsData.rate_lines.map((rl) => ({
              contract_id: id,
              contract_waste_stream_id: cws.id,
              material_id: rl.material_id,
              pricing_model: rl.pricing_model,
              unit_rate: rl.unit_rate,
              btw_rate: rl.btw_rate ?? 0,
              valid_from: effectiveDate,
              valid_to: expiryDate,
            })),
          });
        }
      }
    }

    // Sync penalties if provided
    if (Array.isArray(data.penalty_fee_ids)) {
      await tx.contractContaminationPenalty.deleteMany({
        where: { contract_id: id },
      });
      if (data.penalty_fee_ids.length > 0) {
        const fees = await tx.feeMaster.findMany({
          where: { id: { in: data.penalty_fee_ids }, is_active: true },
          select: { id: true },
        });
        const validFeeIds = new Set(fees.map((f) => f.id));
        const invalidFees = data.penalty_fee_ids.filter((feeId) => !validFeeIds.has(feeId));
        if (invalidFees.length > 0) throw createError(`Invalid fee IDs: ${invalidFees.join(', ')}`, 400);

        await tx.contractContaminationPenalty.createMany({
          data: data.penalty_fee_ids.map((feeId) => ({
            contract_id: id,
            fee_id: feeId,
          })),
        });
      }
    }

    const updated = await tx.supplierContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'SupplierContract',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return enrichContract(updated);
  });
}

// --- Approval Workflow ---

async function approveContract(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierContract.findUnique({
      where: { id },
      include: {
        rate_lines: { where: { superseded_at: null } },
        supplier: { select: { id: true, name: true } },
      },
    });
    if (!existing) throw createError('Contract not found', 404);
    if (existing.status !== 'DRAFT') throw createError('Only DRAFT contracts can be approved', 400);
    if (existing.rate_lines.length === 0) throw createError('Contract must have at least one rate line before approval', 400);

    // Check for overlapping active contracts for same supplier + material + date range
    const materialIds = existing.rate_lines.map((rl) => rl.material_id);
    const overlapWhere = {
      id: { not: id },
      supplier_id: existing.supplier_id,
      status: 'ACTIVE',
      is_active: true,
      rate_lines: {
        some: {
          material_id: { in: materialIds },
          superseded_at: null,
        },
      },
    };
    // If this contract has no expiry, any active contract starting after effective_date overlaps
    if (existing.expiry_date) {
      overlapWhere.effective_date = { lte: existing.expiry_date };
    }
    // Other contract must overlap: its expiry >= our start, or it has no expiry (open-ended)
    overlapWhere.OR = [
      { expiry_date: { gte: existing.effective_date } },
      { expiry_date: null },
    ];
    const overlapping = await tx.supplierContract.findFirst({
      where: overlapWhere,
      select: { contract_number: true },
    });
    if (overlapping) {
      throw createError(`Overlapping active contract exists: ${overlapping.contract_number}`, 409);
    }

    const updated = await tx.supplierContract.update({
      where: { id },
      data: { status: 'ACTIVE', approved_by: userId },
      include: CONTRACT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'APPROVE',
      entityType: 'SupplierContract',
      entityId: id,
      before: { status: existing.status, approved_by: existing.approved_by },
      after: { status: 'ACTIVE', approved_by: userId },
    }, tx);

    return enrichContract(updated);
  });
}

async function deactivateContract(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierContract.findUnique({ where: { id } });
    if (!existing) throw createError('Contract not found', 404);
    if (existing.status !== 'ACTIVE') throw createError('Only ACTIVE contracts can be deactivated', 400);

    const updated = await tx.supplierContract.update({
      where: { id },
      data: { status: 'INACTIVE' },
      include: CONTRACT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'DEACTIVATE',
      entityType: 'SupplierContract',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'INACTIVE' },
    }, tx);

    return enrichContract(updated);
  });
}

// --- Rate Lines ---

async function addRateLine(contractId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.supplierContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, effective_date: true, expiry_date: true },
    });
    if (!contract) throw createError('Contract not found', 404);
    if (contract.status !== 'ACTIVE') {
      throw createError('Rate lines can only be added to ACTIVE contracts', 400);
    }

    const material = await tx.materialMaster.findUnique({
      where: { id: data.material_id },
      select: { id: true, is_active: true },
    });
    if (!material || !material.is_active) throw createError('Active material not found', 404);

    // Validate contract_waste_stream_id if provided
    if (data.contract_waste_stream_id) {
      const cws = await tx.contractWasteStream.findUnique({
        where: { id: data.contract_waste_stream_id },
      });
      if (!cws || cws.contract_id !== contractId) {
        throw createError('Invalid contract waste stream', 400);
      }
    }

    const rateLine = await tx.contractRateLine.create({
      data: {
        contract_id: contractId,
        contract_waste_stream_id: data.contract_waste_stream_id || null,
        material_id: data.material_id,
        pricing_model: data.pricing_model,
        unit_rate: data.unit_rate,
        btw_rate: data.btw_rate ?? 0,
        valid_from: data.valid_from ? new Date(data.valid_from) : contract.effective_date,
        valid_to: data.valid_to ? new Date(data.valid_to) : contract.expiry_date || null,
      },
      include: { material: { select: MATERIAL_SELECT } },
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'ContractRateLine',
      entityId: rateLine.id,
      after: rateLine,
    }, tx);

    return rateLine;
  });
}

async function updateRateLine(lineId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.contractRateLine.findUnique({
      where: { id: lineId },
      include: { contract: { select: { status: true } } },
    });
    if (!existing) throw createError('Rate line not found', 404);
    if (existing.superseded_at) throw createError('Cannot update a superseded rate line', 400);
    if (existing.contract.status !== 'ACTIVE') {
      throw createError('Rate lines can only be updated on ACTIVE contracts', 400);
    }

    // Supersede the existing line
    await tx.contractRateLine.update({
      where: { id: lineId },
      data: { superseded_at: new Date() },
    });

    // Create new line with updated values
    const newLine = await tx.contractRateLine.create({
      data: {
        contract_id: existing.contract_id,
        contract_waste_stream_id: existing.contract_waste_stream_id || null,
        material_id: data.material_id ?? existing.material_id,
        pricing_model: data.pricing_model ?? existing.pricing_model,
        unit_rate: data.unit_rate !== undefined ? data.unit_rate : existing.unit_rate,
        btw_rate: data.btw_rate !== undefined ? data.btw_rate : existing.btw_rate,
        valid_from: data.valid_from ? new Date(data.valid_from) : existing.valid_from,
        valid_to: data.valid_to ? new Date(data.valid_to) : existing.valid_to,
      },
      include: { material: { select: MATERIAL_SELECT } },
    });

    await writeAuditLog({
      userId,
      action: 'SUPERSEDE',
      entityType: 'ContractRateLine',
      entityId: lineId,
      before: existing,
      after: newLine,
    }, tx);

    return newLine;
  });
}

async function deleteRateLine(lineId, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.contractRateLine.findUnique({ where: { id: lineId } });
    if (!existing) throw createError('Rate line not found', 404);
    if (existing.superseded_at) throw createError('Rate line already superseded', 400);

    await tx.contractRateLine.update({
      where: { id: lineId },
      data: { superseded_at: new Date() },
    });

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'ContractRateLine',
      entityId: lineId,
      before: existing,
      after: { ...existing, superseded_at: new Date() },
    }, tx);
  });
}

// --- Penalties ---

async function syncPenalties(contractId, feeIds, userId) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.supplierContract.findUnique({
      where: { id: contractId },
      include: { contamination_penalties: { include: { fee: true } } },
    });
    if (!contract) throw createError('Contract not found', 404);

    const before = contract.contamination_penalties;

    await tx.contractContaminationPenalty.deleteMany({
      where: { contract_id: contractId },
    });

    if (Array.isArray(feeIds) && feeIds.length > 0) {
      await tx.contractContaminationPenalty.createMany({
        data: feeIds.map((feeId) => ({
          contract_id: contractId,
          fee_id: feeId,
        })),
      });
    }

    const after = await tx.contractContaminationPenalty.findMany({
      where: { contract_id: contractId },
      include: { fee: true },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'ContractContaminationPenalty',
      entityId: contractId,
      before,
      after,
    }, tx);

    return after;
  });
}

// --- Contract Waste Streams ---

async function addContractWasteStream(contractId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.supplierContract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, effective_date: true, expiry_date: true },
    });
    if (!contract) throw createError('Contract not found', 404);
    if (contract.status !== 'ACTIVE') {
      throw createError('Waste streams can only be added to ACTIVE contracts', 400);
    }

    const ws = await tx.wasteStream.findUnique({
      where: { id: data.waste_stream_id },
      select: { id: true, is_active: true },
    });
    if (!ws || !ws.is_active) throw createError('Active waste stream not found', 404);

    // Check uniqueness
    const existing = await tx.contractWasteStream.findUnique({
      where: { contract_id_waste_stream_id: { contract_id: contractId, waste_stream_id: data.waste_stream_id } },
    });
    if (existing) throw createError('This waste stream is already in this contract', 409);

    const cws = await tx.contractWasteStream.create({
      data: {
        contract_id: contractId,
        waste_stream_id: data.waste_stream_id,
        afvalstroomnummer: data.afvalstroomnummer,
      },
      include: {
        waste_stream: { select: { id: true, name: true, code: true } },
      },
    });

    // Create rate lines if provided
    if (Array.isArray(data.rate_lines) && data.rate_lines.length > 0) {
      const matPricingKeys = data.rate_lines.map((rl) => `${rl.material_id}:${rl.pricing_model}`);
      if (new Set(matPricingKeys).size !== matPricingKeys.length) {
        throw createError('Duplicate material + pricing model in waste stream', 400);
      }
      const materials = await tx.materialMaster.findMany({
        where: { id: { in: matIds }, is_active: true },
        select: { id: true },
      });
      const validMatIds = new Set(materials.map((m) => m.id));
      const invalidMats = matIds.filter((id) => !validMatIds.has(id));
      if (invalidMats.length > 0) throw createError(`Invalid material IDs: ${invalidMats.join(', ')}`, 400);

      await tx.contractRateLine.createMany({
        data: data.rate_lines.map((rl) => ({
          contract_id: contractId,
          contract_waste_stream_id: cws.id,
          material_id: rl.material_id,
          pricing_model: rl.pricing_model,
          unit_rate: rl.unit_rate,
          btw_rate: rl.btw_rate ?? 0,
          valid_from: contract.effective_date,
          valid_to: contract.expiry_date,
        })),
      });
    }

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'ContractWasteStream',
      entityId: cws.id,
      after: cws,
    }, tx);

    return cws;
  });
}

async function deleteContractWasteStream(contractWasteStreamId, userId) {
  return prisma.$transaction(async (tx) => {
    const cws = await tx.contractWasteStream.findUnique({
      where: { id: contractWasteStreamId },
      include: { rate_lines: { where: { superseded_at: null } } },
    });
    if (!cws) throw createError('Contract waste stream not found', 404);

    // Supersede all active rate lines under this waste stream
    if (cws.rate_lines.length > 0) {
      await tx.contractRateLine.updateMany({
        where: { contract_waste_stream_id: contractWasteStreamId, superseded_at: null },
        data: { superseded_at: new Date() },
      });
    }

    await tx.contractWasteStream.delete({
      where: { id: contractWasteStreamId },
    });

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'ContractWasteStream',
      entityId: contractWasteStreamId,
      before: cws,
    }, tx);
  });
}

// --- Auto-Match ---

async function matchContractForOrder(supplierId, materialId, date, tx) {
  const client = tx || prisma;
  const targetDate = new Date(date);

  const contract = await client.supplierContract.findFirst({
    where: {
      supplier_id: supplierId,
      status: 'ACTIVE',
      is_active: true,
      effective_date: { lte: targetDate },
      OR: [
        { expiry_date: { gte: targetDate } },
        { expiry_date: null },
      ],
      rate_lines: {
        some: {
          material_id: materialId,
          valid_from: { lte: targetDate },
          OR: [
            { valid_to: { gte: targetDate } },
            { valid_to: null },
          ],
          superseded_at: null,
        },
      },
    },
    include: {
      rate_lines: {
        where: {
          material_id: materialId,
          valid_from: { lte: targetDate },
          OR: [
            { valid_to: { gte: targetDate } },
            { valid_to: null },
          ],
          superseded_at: null,
        },
        include: {
          contract_waste_stream: { select: { id: true, waste_stream_id: true, afvalstroomnummer: true } },
        },
        take: 1,
      },
    },
  });

  if (!contract || contract.rate_lines.length === 0) return null;

  const rateLine = contract.rate_lines[0];
  return {
    contract: { id: contract.id, contract_number: contract.contract_number },
    contract_waste_stream: rateLine.contract_waste_stream || null,
    rate_line: rateLine,
  };
}

// --- Order Form Matching ---

async function findContractForSupplierCarrier(supplierId, carrierId, date) {
  const targetDate = new Date(date || new Date());

  const contract = await prisma.supplierContract.findFirst({
    where: {
      supplier_id: supplierId,
      carrier_id: carrierId,
      status: 'ACTIVE',
      is_active: true,
      effective_date: { lte: targetDate },
      OR: [
        { expiry_date: { gte: targetDate } },
        { expiry_date: null },
      ],
    },
    include: {
      supplier: { select: { id: true, name: true } },
      carrier: { select: { id: true, name: true } },
      contract_waste_streams: {
        include: {
          waste_stream: { select: { id: true, name: true, code: true } },
          rate_lines: {
            where: { superseded_at: null },
            include: { material: { select: MATERIAL_SELECT } },
          },
        },
      },
    },
  });

  if (!contract) return null;
  return enrichContract(contract);
}

// --- Supplier-scoped ---

async function getSupplierContracts(supplierId, { status } = {}) {
  const where = { supplier_id: supplierId, is_active: true };
  if (status) where.status = status;

  const contracts = await prisma.supplierContract.findMany({
    where,
    include: CONTRACT_LIST_INCLUDE,
    orderBy: { created_at: 'desc' },
  });

  return contracts.map(enrichContract);
}

module.exports = {
  listContracts,
  getContract,
  getDashboardSummary,
  createContract,
  updateContract,
  approveContract,
  deactivateContract,
  addRateLine,
  updateRateLine,
  deleteRateLine,
  syncPenalties,
  addContractWasteStream,
  deleteContractWasteStream,
  matchContractForOrder,
  findContractForSupplierCarrier,
  getSupplierContracts,
};
