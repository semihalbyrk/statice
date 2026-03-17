const prisma = require('../utils/prismaClient');
const { canTransition: canInboundTransition } = require('../utils/inboundStateMachine');
const { writeAuditLog } = require('../utils/auditLog');

const LINE_INCLUDE = {
  asset: { select: { id: true, asset_label: true, container_type: true, parcel_type: true, net_weight_kg: true } },
  category: { select: { id: true, code_cbs: true, description_en: true, description_nl: true } },
};

const SESSION_INCLUDE = {
  inbound: {
    include: {
      vehicle: { select: { id: true, registration_plate: true } },
      order: {
        include: {
          carrier: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true, supplier_type: true } },
          waste_stream: { select: { id: true, name_en: true, code: true } },
        },
      },
      assets: {
        include: {
          waste_stream: { select: { id: true, name_en: true, code: true } },
        },
        orderBy: { created_at: 'asc' },
      },
    },
  },
  recorded_by_user: { select: { id: true, full_name: true } },
  sorting_lines: {
    include: LINE_INCLUDE,
  },
};

function createError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function addAllocationFields(session) {
  if (!session || !session.inbound?.assets) return session;

  const lines = session.sorting_lines || [];
  const assets = session.inbound.assets;

  for (const asset of assets) {
    const assetLines = lines.filter((l) => l.asset_id === asset.id);
    const totalAllocated = assetLines.reduce((sum, l) => sum + Number(l.net_weight_kg), 0);
    const netWeight = Number(asset.net_weight_kg) || 0;

    asset.total_allocated_kg = Math.round(totalAllocated * 100) / 100;
    asset.unallocated_kg = Math.round((netWeight - totalAllocated) * 100) / 100;
    asset.allocation_pct = netWeight > 0 ? Math.round((totalAllocated / netWeight) * 10000) / 100 : 0;
    asset.is_over_allocated = totalAllocated > netWeight;
  }

  return session;
}

async function getSession(id) {
  const session = await prisma.sortingSession.findUnique({
    where: { id },
    include: SESSION_INCLUDE,
  });
  if (!session) return null;
  return addAllocationFields(session);
}

async function listSessionsByOrder(orderId) {
  const sessions = await prisma.sortingSession.findMany({
    where: { order_id: orderId },
    include: SESSION_INCLUDE,
    orderBy: { recorded_at: 'desc' },
  });
  return sessions.map(addAllocationFields);
}

async function listAllSessions({ status, search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (search) {
    const normalizedSearch = search.replace(/^SRT-/i, 'INB-');
    where.OR = [
      { inbound: { inbound_number: { contains: normalizedSearch, mode: 'insensitive' } } },
      { inbound: { order: { order_number: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [sessions, total] = await Promise.all([
    prisma.sortingSession.findMany({
      where, skip, take: limitNum,
      include: SESSION_INCLUDE,
      orderBy: { recorded_at: 'desc' },
    }),
    prisma.sortingSession.count({ where }),
  ]);

  return { data: sessions.map(addAllocationFields), total, page: pageNum, limit: limitNum };
}

async function submitSession(sessionId, userId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.sortingSession.findUnique({
      where: { id: sessionId },
      include: {
        sorting_lines: true,
        inbound: {
          include: {
            order: { select: { id: true, status: true } },
            assets: { select: { id: true, net_weight_kg: true } },
          },
        },
      },
    });

    if (!session) throw createError('Sorting session not found', 404);
    if (session.status !== 'PLANNED') throw createError('Session is already submitted', 409);
    if (session.sorting_lines.length === 0) {
      throw createError('Add at least one material line before submitting', 409);
    }

    // Validate all lines have pct sum = 100
    const invalidLines = [];
    for (const line of session.sorting_lines) {
      const sum = Math.round(
        (Number(line.recycled_pct) + Number(line.reused_pct) +
         Number(line.disposed_pct) + Number(line.landfill_pct)) * 100
      ) / 100;
      if (sum !== 100) {
        invalidLines.push({ line_id: line.id, asset_id: line.asset_id, sum });
      }
    }
    if (invalidLines.length > 0) {
      const err = createError('Some lines have invalid recovery rate sums', 422);
      err.invalidLines = invalidLines;
      throw err;
    }

    // Update session status → SORTED
    const updated = await tx.sortingSession.update({
      where: { id: sessionId },
      data: {
        status: 'SORTED',
        recorded_by: userId,
        recorded_at: new Date(),
      },
      include: SESSION_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'SUBMIT',
      entityType: 'SortingSession',
      entityId: sessionId,
      before: { status: 'PLANNED' },
      after: { status: 'SORTED' },
    }, tx);

    // Transition Inbound → SORTED
    const inbound = session.inbound;
    if (inbound && canInboundTransition(inbound.status, 'SORTED')) {
      await tx.inbound.update({
        where: { id: inbound.id },
        data: { status: 'SORTED' },
      });

      await writeAuditLog({
        userId,
        action: 'STATUS_CHANGE',
        entityType: 'Inbound',
        entityId: inbound.id,
        before: { status: inbound.status },
        after: { status: 'SORTED', trigger: 'sorting_submitted' },
      }, tx);
    }

    return addAllocationFields(updated);
  });
}

async function reopenSession(sessionId, reason, userId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.sortingSession.findUnique({
      where: { id: sessionId },
      include: { inbound: { select: { id: true, status: true } } },
    });
    if (!session) throw createError('Sorting session not found', 404);
    if (session.status !== 'SORTED') throw createError('Session is not submitted', 409);

    const updated = await tx.sortingSession.update({
      where: { id: sessionId },
      data: { status: 'PLANNED' },
      include: SESSION_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'REOPEN',
      entityType: 'SortingSession',
      entityId: sessionId,
      before: { status: 'SORTED' },
      after: { status: 'PLANNED', reason },
    }, tx);

    // Revert Inbound SORTED → READY_FOR_SORTING
    if (session.inbound && session.inbound.status === 'SORTED') {
      await tx.inbound.update({
        where: { id: session.inbound.id },
        data: { status: 'READY_FOR_SORTING' },
      });

      await writeAuditLog({
        userId,
        action: 'STATUS_CHANGE',
        entityType: 'Inbound',
        entityId: session.inbound.id,
        before: { status: 'SORTED' },
        after: { status: 'READY_FOR_SORTING', trigger: 'sorting_reopened' },
      }, tx);
    }

    return addAllocationFields(updated);
  });
}

async function createLine(sessionId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.sortingSession.findUnique({
      where: { id: sessionId },
      include: {
        inbound: { select: { id: true } },
        sorting_lines: { select: { asset_id: true, net_weight_kg: true } },
      },
    });
    if (!session) throw createError('Sorting session not found', 404);
    if (session.status !== 'PLANNED') throw createError('Session is locked', 409);

    const asset = await tx.asset.findFirst({
      where: { id: data.asset_id, inbound_id: session.inbound_id },
    });
    if (!asset) throw createError('Asset does not belong to this inbound', 400);

    const line = await tx.sortingLine.create({
      data: {
        session_id: sessionId,
        asset_id: data.asset_id,
        category_id: data.category_id,
        net_weight_kg: parseFloat(data.net_weight_kg),
        recycled_pct: parseFloat(data.recycled_pct),
        reused_pct: parseFloat(data.reused_pct),
        disposed_pct: parseFloat(data.disposed_pct),
        landfill_pct: parseFloat(data.landfill_pct),
        downstream_processor: data.downstream_processor || null,
        downstream_processor_address: data.downstream_processor_address || null,
        downstream_permit_number: data.downstream_permit_number || null,
        transfer_date: data.transfer_date ? new Date(data.transfer_date) : null,
        transfer_method: data.transfer_method || null,
        certificate_reference: data.certificate_reference || null,
        notes: data.notes || null,
      },
      include: LINE_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'SortingLine',
      entityId: line.id,
      after: { session_id: sessionId, asset_id: data.asset_id, category_id: data.category_id, net_weight_kg: data.net_weight_kg },
    }, tx);

    const existingSum = session.sorting_lines
      .filter((l) => l.asset_id === data.asset_id)
      .reduce((sum, l) => sum + Number(l.net_weight_kg), 0);
    const newTotal = Math.round((existingSum + Number(data.net_weight_kg)) * 100) / 100;
    const assetNet = Number(asset.net_weight_kg) || 0;

    const result = { data: line };
    if (newTotal > assetNet) {
      result.warning = `Total allocated weight (${newTotal} kg) exceeds skip net weight (${assetNet} kg)`;
    }
    return result;
  });
}

async function updateLine(sessionId, lineId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sortingLine.findUnique({
      where: { id: lineId },
      include: { session: { select: { id: true, status: true, inbound_id: true } } },
    });
    if (!existing) throw createError('Sorting line not found', 404);
    if (existing.session_id !== sessionId) throw createError('Line does not belong to this session', 400);
    if (existing.session.status !== 'PLANNED') throw createError('Session is locked', 409);

    const updateData = {};
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.net_weight_kg !== undefined) updateData.net_weight_kg = parseFloat(data.net_weight_kg);
    if (data.recycled_pct !== undefined) updateData.recycled_pct = parseFloat(data.recycled_pct);
    if (data.reused_pct !== undefined) updateData.reused_pct = parseFloat(data.reused_pct);
    if (data.disposed_pct !== undefined) updateData.disposed_pct = parseFloat(data.disposed_pct);
    if (data.landfill_pct !== undefined) updateData.landfill_pct = parseFloat(data.landfill_pct);
    if (data.downstream_processor !== undefined) updateData.downstream_processor = data.downstream_processor;
    if (data.downstream_processor_address !== undefined) updateData.downstream_processor_address = data.downstream_processor_address;
    if (data.downstream_permit_number !== undefined) updateData.downstream_permit_number = data.downstream_permit_number;
    if (data.transfer_date !== undefined) updateData.transfer_date = data.transfer_date ? new Date(data.transfer_date) : null;
    if (data.transfer_method !== undefined) updateData.transfer_method = data.transfer_method;
    if (data.certificate_reference !== undefined) updateData.certificate_reference = data.certificate_reference;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await tx.sortingLine.update({
      where: { id: lineId },
      data: updateData,
      include: LINE_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'SortingLine',
      entityId: lineId,
      before: { net_weight_kg: Number(existing.net_weight_kg), category_id: existing.category_id },
      after: { net_weight_kg: Number(updated.net_weight_kg), category_id: updated.category_id },
    }, tx);

    const allLines = await tx.sortingLine.findMany({
      where: { session_id: sessionId, asset_id: updated.asset_id },
      select: { net_weight_kg: true },
    });
    const totalAllocated = Math.round(allLines.reduce((s, l) => s + Number(l.net_weight_kg), 0) * 100) / 100;

    const asset = await tx.asset.findUnique({
      where: { id: updated.asset_id },
      select: { net_weight_kg: true },
    });
    const assetNet = Number(asset?.net_weight_kg) || 0;

    const result = { data: updated };
    if (totalAllocated > assetNet) {
      result.warning = `Total allocated weight (${totalAllocated} kg) exceeds skip net weight (${assetNet} kg)`;
    }
    return result;
  });
}

async function deleteLine(sessionId, lineId, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.sortingLine.findUnique({
      where: { id: lineId },
      include: { session: { select: { id: true, status: true } } },
    });
    if (!existing) throw createError('Sorting line not found', 404);
    if (existing.session_id !== sessionId) throw createError('Line does not belong to this session', 400);
    if (existing.session.status !== 'PLANNED') throw createError('Session is locked', 409);

    await tx.sortingLine.delete({ where: { id: lineId } });

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'SortingLine',
      entityId: lineId,
      before: { asset_id: existing.asset_id, category_id: existing.category_id, net_weight_kg: Number(existing.net_weight_kg) },
    }, tx);

    return { success: true };
  });
}

async function listLines(sessionId, assetId) {
  const where = { session_id: sessionId };
  if (assetId) where.asset_id = assetId;

  return prisma.sortingLine.findMany({
    where,
    include: LINE_INCLUDE,
  });
}

async function getCategoryDefaults(categoryId) {
  const category = await prisma.productCategory.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      recycled_pct_default: true,
      reused_pct_default: true,
      disposed_pct_default: true,
      landfill_pct_default: true,
    },
  });
  if (!category) throw createError('Product category not found', 404);
  return category;
}

module.exports = {
  getSession,
  listSessionsByOrder,
  listAllSessions,
  submitSession,
  reopenSession,
  createLine,
  updateLine,
  deleteLine,
  listLines,
  getCategoryDefaults,
};
