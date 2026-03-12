const prisma = require('../utils/prismaClient');
const { generateOrderNumber } = require('../utils/orderNumber');
const { canTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');

const VALID_ORDER_STATUSES = ['PLANNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const ORDER_INCLUDE = {
  carrier: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true, supplier_type: true } },
  waste_stream: { select: { id: true, name_en: true, code: true } },
  created_by_user: { select: { id: true, full_name: true } },
};

async function listOrders({ status, search, carrier_id, page = 1, limit = 20, date_from, date_to }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (carrier_id) where.carrier_id = carrier_id;
  if (search) {
    where.order_number = { contains: search, mode: 'insensitive' };
  }
  if (date_from || date_to) {
    where.planned_date = {};
    if (date_from) where.planned_date.gte = new Date(date_from);
    if (date_to) where.planned_date.lte = new Date(date_to);
  }

  const [orders, total] = await Promise.all([
    prisma.inboundOrder.findMany({
      where, skip, take: limitNum,
      include: ORDER_INCLUDE,
      orderBy: { created_at: 'desc' },
    }),
    prisma.inboundOrder.count({ where }),
  ]);

  return { data: orders, total, page: pageNum, limit: limitNum };
}

async function getOrder(id) {
  return prisma.inboundOrder.findUnique({
    where: { id },
    include: {
      ...ORDER_INCLUDE,
      inbounds: {
        include: {
          vehicle: true,
          sorting_session: { select: { id: true, status: true } },
        },
        orderBy: { arrived_at: 'desc' },
      },
    },
  });
}

async function createOrder(data, userId) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);

    const order = await tx.inboundOrder.create({
      data: {
        order_number: orderNumber,
        carrier_id: data.carrier_id,
        supplier_id: data.supplier_id,
        waste_stream_id: data.waste_stream_id,
        planned_date: new Date(data.planned_date),
        planned_time_window_start: data.planned_time_window_start ? new Date(data.planned_time_window_start) : null,
        planned_time_window_end: data.planned_time_window_end ? new Date(data.planned_time_window_end) : null,
        expected_skip_count: parseInt(data.expected_skip_count, 10) || 1,
        vehicle_plate: data.vehicle_plate || null,
        afvalstroomnummer: data.afvalstroomnummer || null,
        notes: data.notes || null,
        status: 'PLANNED',
        is_adhoc: false,
        created_by: userId,
      },
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'InboundOrder',
      entityId: order.id,
      after: order,
    }, tx);

    return order;
  });
}

async function updateOrder(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inboundOrder.findUnique({ where: { id } });
    if (!existing) return null;

    if (data.status && data.status !== existing.status) {
      if (!VALID_ORDER_STATUSES.includes(data.status)) {
        throw new Error(`Invalid order status: ${data.status}`);
      }
      if (!canTransition(existing.status, data.status)) {
        throw new Error(`Cannot transition from ${existing.status} to ${data.status}`);
      }
    }

    const updateData = {};
    if (data.carrier_id !== undefined) updateData.carrier_id = data.carrier_id;
    if (data.supplier_id !== undefined) updateData.supplier_id = data.supplier_id;
    if (data.waste_stream_id !== undefined) updateData.waste_stream_id = data.waste_stream_id;
    if (data.planned_date !== undefined) updateData.planned_date = new Date(data.planned_date);
    if (data.planned_time_window_start !== undefined) updateData.planned_time_window_start = data.planned_time_window_start ? new Date(data.planned_time_window_start) : null;
    if (data.planned_time_window_end !== undefined) updateData.planned_time_window_end = data.planned_time_window_end ? new Date(data.planned_time_window_end) : null;
    if (data.expected_skip_count !== undefined) updateData.expected_skip_count = parseInt(data.expected_skip_count, 10);
    if (data.vehicle_plate !== undefined) updateData.vehicle_plate = data.vehicle_plate;
    if (data.afvalstroomnummer !== undefined) updateData.afvalstroomnummer = data.afvalstroomnummer;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await tx.inboundOrder.update({
      where: { id },
      data: updateData,
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'InboundOrder',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return updated;
  });
}

async function cancelOrder(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inboundOrder.findUnique({ where: { id } });
    if (!existing) return null;

    if (!canTransition(existing.status, 'CANCELLED')) {
      throw new Error(`Cannot cancel order in ${existing.status} status`);
    }

    const updated = await tx.inboundOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CANCEL',
      entityType: 'InboundOrder',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return updated;
  });
}

async function matchPlate(plate) {
  // Search window: 7 days back to 7 days forward
  const from = new Date();
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 7);
  to.setHours(23, 59, 59, 999);

  return prisma.inboundOrder.findMany({
    where: {
      status: { in: ['PLANNED', 'ARRIVED', 'IN_PROGRESS'] },
      vehicle_plate: { contains: plate, mode: 'insensitive' },
      planned_date: { gte: from, lte: to },
    },
    include: ORDER_INCLUDE,
    orderBy: { planned_date: 'asc' },
    take: 10,
  });
}

async function createAdhocArrival(data, userId) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);

    const order = await tx.inboundOrder.create({
      data: {
        order_number: orderNumber,
        carrier_id: data.carrier_id,
        supplier_id: data.supplier_id,
        waste_stream_id: data.waste_stream_id,
        planned_date: new Date(),
        expected_skip_count: parseInt(data.expected_skip_count, 10) || 1,
        vehicle_plate: data.vehicle_plate || null,
        notes: data.notes || null,
        status: 'PLANNED',
        is_adhoc: true,
        created_by: userId,
      },
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE_ADHOC',
      entityType: 'InboundOrder',
      entityId: order.id,
      after: order,
    }, tx);

    // Notify logistics planners
    try {
      const planners = await tx.user.findMany({
        where: { role: 'LOGISTICS_PLANNER', is_active: true },
        select: { id: true },
      });
      if (planners.length > 0) {
        await tx.notification.createMany({
          data: planners.map((p) => ({
            user_id: p.id,
            type: 'ADHOC_ARRIVAL',
            title: 'Unplanned vehicle arrival',
            message: `Ad-hoc order: ${order.order_number} — plate ${data.vehicle_plate || 'N/A'}`,
            entity_type: 'InboundOrder',
            entity_id: order.id,
          })),
        });
      }
    } catch {
      // notification is non-critical
    }

    return order;
  });
}

module.exports = {
  listOrders, getOrder, createOrder, updateOrder, cancelOrder,
  matchPlate, createAdhocArrival,
};
