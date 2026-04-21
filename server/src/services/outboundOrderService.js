const crypto = require('crypto');
const prisma = require('../utils/prismaClient');
const { generateOutboundOrderNumber } = require('../utils/outboundOrderNumber');
const { validateTransition } = require('../utils/outboundOrderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');

// ---------------------------------------------------------------------------
// Shared includes
// ---------------------------------------------------------------------------

const LIST_INCLUDE = {
  buyer: { select: { id: true, company_name: true } },
  sender: { select: { id: true, company_name: true } },
  transporter: { select: { id: true, company_name: true } },
  contract: { select: { id: true, contract_number: true, name: true } },
  _count: { select: { outbounds: true } },
};

const DETAIL_INCLUDE = {
  contract: {
    include: {
      contract_waste_streams: {
        include: { waste_stream: { select: { id: true, name: true, code: true } } },
      },
    },
  },
  buyer: { select: { id: true, company_name: true } },
  sender: { select: { id: true, company_name: true } },
  disposer: { select: { id: true, company_name: true } },
  transporter: { select: { id: true, company_name: true, vihb_number: true } },
  outsourced_transporter: { select: { id: true, company_name: true, vihb_number: true } },
  waste_streams: {
    include: {
      waste_stream: { select: { id: true, name: true, code: true } },
      receiver: { select: { id: true, company_name: true } },
    },
  },
  outbounds: {
    select: {
      id: true,
      outbound_number: true,
      status: true,
      net_weight_kg: true,
      vehicle_plate: true,
      departed_at: true,
      _count: {
        select: {
          documents: true,
          parcels: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  },
  created_by_user: { select: { id: true, full_name: true } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function throwNotFound(msg = 'Outbound order not found') {
  const err = new Error(msg);
  err.statusCode = 404;
  throw err;
}

function throwBadRequest(msg) {
  const err = new Error(msg);
  err.statusCode = 400;
  throw err;
}

async function attachWasteStreamMaterials(client, order) {
  if (!order?.waste_streams?.length) return order;

  const materialIds = [...new Set(order.waste_streams.map((ws) => ws.material_id).filter(Boolean))];
  if (materialIds.length === 0) return order;

  const materials = await client.materialMaster.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, name: true, code: true },
  });
  const materialMap = new Map(materials.map((material) => [material.id, material]));

  return {
    ...order,
    waste_streams: order.waste_streams.map((ws) => ({
      ...ws,
      material: ws.material_id ? materialMap.get(ws.material_id) || null : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

async function listOutboundOrders({ status, search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.order_number = { contains: search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.outboundOrder.findMany({
      where,
      skip,
      take: limitNum,
      include: LIST_INCLUDE,
      orderBy: { created_at: 'desc' },
    }),
    prisma.outboundOrder.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

async function getOutboundOrder(id) {
  const order = await prisma.outboundOrder.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!order) throwNotFound();
  return attachWasteStreamMaterials(prisma, order);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function createOutboundOrder(data, userId) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate contract
    const contract = await tx.supplierContract.findUnique({
      where: { id: data.contract_id },
      include: {
        contract_waste_streams: {
          include: {
            rate_lines: {
              where: { superseded_at: null },
              include: { material: { select: { id: true, name: true } } },
              orderBy: { valid_from: 'asc' },
            },
          },
        },
      },
    });
    if (!contract) throwBadRequest('Contract not found');
    if (contract.contract_type !== 'OUTGOING') {
      throwBadRequest('Contract must be of type OUTGOING');
    }
    if (contract.status !== 'ACTIVE') {
      throwBadRequest('Contract is not active');
    }

    const plannedTimeStart = data.planned_time_start || data.time_window_start || null;
    const plannedTimeEnd = data.planned_time_end || data.time_window_end || null;
    const expectedOutbounds = data.expected_outbounds ?? data.expected_outbound_count;

    // 2. Generate order number
    const orderNumber = await generateOutboundOrderNumber(tx);

    // 3. Create order with contract defaults
    const order = await tx.outboundOrder.create({
      data: {
        order_number: orderNumber,
        contract_id: data.contract_id,
        buyer_id: data.buyer_id || contract.buyer_id,
        sender_id: data.sender_id || contract.sender_id,
        disposer_id: data.disposer_id || contract.disposer_id,
        disposer_site_id: data.disposer_site_id || contract.disposer_site_id || null,
        transporter_id: data.transporter_id || contract.agreement_transporter_id,
        outsourced_transporter_id: data.outsourced_transporter_id || null,
        vehicle_plate: data.vehicle_plate || null,
        planned_date: new Date(data.planned_date),
        planned_time_start: plannedTimeStart ? new Date(plannedTimeStart) : null,
        planned_time_end: plannedTimeEnd ? new Date(plannedTimeEnd) : null,
        shipment_type: data.shipment_type || contract.shipment_type || 'DOMESTIC_NL',
        expected_outbounds: parseInt(expectedOutbounds, 10) || 1,
        notes: data.notes || null,
        status: 'PLANNED',
        created_by: userId,
      },
    });

    // 4. Create waste stream entries
    if (data.waste_streams && data.waste_streams.length > 0) {
      const contractWasteStreamById = new Map(contract.contract_waste_streams.map((cws) => [cws.id, cws]));
      const contractWasteStreamByWasteStreamId = new Map(contract.contract_waste_streams.map((cws) => [cws.waste_stream_id, cws]));

      await tx.outboundOrderWasteStream.createMany({
        data: data.waste_streams.map((ws) => {
          const matchedCws = ws.contract_waste_stream_id
            ? contractWasteStreamById.get(ws.contract_waste_stream_id)
            : contractWasteStreamByWasteStreamId.get(ws.waste_stream_id);
          const primaryRateLine = matchedCws?.rate_lines?.[0] || null;
          const wasteStreamId = ws.waste_stream_id || matchedCws?.waste_stream_id;

          if (!wasteStreamId) throwBadRequest('Waste stream is required for outbound order waste streams');
          if (ws.contract_waste_stream_id && !matchedCws) {
            throwBadRequest('Invalid contract waste stream for outbound order');
          }

          return {
            id: crypto.randomUUID(),
            outbound_order_id: order.id,
            waste_stream_id: wasteStreamId,
            receiver_id: ws.receiver_id || matchedCws?.receiver_id || null,
            asn: ws.asn || matchedCws?.afvalstroomnummer || null,
            material_id: ws.material_id || primaryRateLine?.material_id || null,
            processing_method: ws.processing_method || primaryRateLine?.processing_method || null,
            planned_amount_kg: ws.planned_amount_kg != null ? ws.planned_amount_kg : null,
          };
        }),
      });
    }

    // 5. Fetch full order with includes
    const full = await tx.outboundOrder.findUnique({
      where: { id: order.id },
      include: DETAIL_INCLUDE,
    });

    // 6. Audit log
    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'OutboundOrder',
      entityId: order.id,
      after: full,
    }, tx);

    return attachWasteStreamMaterials(tx, full);
  });
}

// ---------------------------------------------------------------------------
// Update (only when PLANNED)
// ---------------------------------------------------------------------------

async function updateOutboundOrder(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.outboundOrder.findUnique({ where: { id } });
    if (!existing) throwNotFound();

    if (existing.status !== 'PLANNED') {
      throwBadRequest('Can only update outbound orders in PLANNED status');
    }

    // Build update payload — only provided fields
    const updateData = {};
    if (data.contract_id !== undefined) updateData.contract_id = data.contract_id;
    if (data.buyer_id !== undefined) updateData.buyer_id = data.buyer_id;
    if (data.sender_id !== undefined) updateData.sender_id = data.sender_id;
    if (data.disposer_id !== undefined) updateData.disposer_id = data.disposer_id;
    if (data.disposer_site_id !== undefined) updateData.disposer_site_id = data.disposer_site_id || null;
    if (data.transporter_id !== undefined) updateData.transporter_id = data.transporter_id;
    if (data.outsourced_transporter_id !== undefined) updateData.outsourced_transporter_id = data.outsourced_transporter_id || null;
    if (data.vehicle_plate !== undefined) updateData.vehicle_plate = data.vehicle_plate || null;
    if (data.planned_date !== undefined) updateData.planned_date = new Date(data.planned_date);
    if (data.planned_time_start !== undefined) updateData.planned_time_start = data.planned_time_start ? new Date(data.planned_time_start) : null;
    if (data.planned_time_end !== undefined) updateData.planned_time_end = data.planned_time_end ? new Date(data.planned_time_end) : null;
    if (data.shipment_type !== undefined) updateData.shipment_type = data.shipment_type;
    if (data.expected_outbounds !== undefined) updateData.expected_outbounds = parseInt(data.expected_outbounds, 10);
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    // Sync waste streams if provided
    if (data.waste_streams && Array.isArray(data.waste_streams)) {
      await tx.outboundOrderWasteStream.deleteMany({
        where: { outbound_order_id: id },
      });
      if (data.waste_streams.length > 0) {
        await tx.outboundOrderWasteStream.createMany({
          data: data.waste_streams.map((ws) => ({
            id: crypto.randomUUID(),
            outbound_order_id: id,
            waste_stream_id: ws.waste_stream_id,
            receiver_id: ws.receiver_id,
            asn: ws.asn || null,
            material_id: ws.material_id || null,
            processing_method: ws.processing_method || null,
            planned_amount_kg: ws.planned_amount_kg != null ? ws.planned_amount_kg : null,
          })),
        });
      }
    }

    const updated = await tx.outboundOrder.update({
      where: { id },
      data: updateData,
      include: DETAIL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'OutboundOrder',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return attachWasteStreamMaterials(tx, updated);
  });
}

// ---------------------------------------------------------------------------
// Cancel (only when PLANNED)
// ---------------------------------------------------------------------------

async function cancelOutboundOrder(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.outboundOrder.findUnique({ where: { id } });
    if (!existing) throwNotFound();

    validateTransition(existing.status, 'CANCELLED');

    const updated = await tx.outboundOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: DETAIL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CANCEL',
      entityType: 'OutboundOrder',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return attachWasteStreamMaterials(tx, updated);
  });
}

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

async function updateOutboundOrderStatus(id, newStatus, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.outboundOrder.findUnique({ where: { id } });
    if (!existing) throwNotFound();

    validateTransition(existing.status, newStatus);

    const updated = await tx.outboundOrder.update({
      where: { id },
      data: { status: newStatus },
      include: DETAIL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType: 'OutboundOrder',
      entityId: id,
      before: { status: existing.status },
      after: { status: newStatus },
    }, tx);

    return attachWasteStreamMaterials(tx, updated);
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  listOutboundOrders,
  getOutboundOrder,
  createOutboundOrder,
  updateOutboundOrder,
  cancelOutboundOrder,
  updateOutboundOrderStatus,
};
