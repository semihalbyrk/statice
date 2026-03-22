const prisma = require('../utils/prismaClient');
const { generateOrderNumber } = require('../utils/orderNumber');
const { canTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');
const { notifyRoles } = require('./notificationService');

const VALID_ORDER_STATUSES = ['PLANNED', 'ARRIVED', 'IN_PROGRESS', 'DISPUTE', 'COMPLETED', 'INVOICED', 'CANCELLED'];

const ORDER_INCLUDE = {
  carrier: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true, supplier_type: true } },
  waste_stream: { select: { id: true, name_en: true, code: true } },
  waste_streams: {
    include: {
      waste_stream: { select: { id: true, name_en: true, code: true } },
    },
  },
  created_by_user: { select: { id: true, full_name: true } },
};

function enrichOrder(order) {
  if (!order) return order;

  const expected = order.expected_asset_count ?? order.expected_skip_count ?? 0;
  const received = order.received_asset_count ?? 0;

  return {
    ...order,
    expected_asset_count: expected,
    received_asset_count: received,
    remaining_asset_count: Math.max(expected - received, 0),
    is_partial_delivery: received > 0 && received < expected,
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysBetween(a, b) {
  const first = new Date(a);
  first.setHours(0, 0, 0, 0);
  const second = new Date(b);
  second.setHours(0, 0, 0, 0);
  return Math.round((first.getTime() - second.getTime()) / (24 * 60 * 60 * 1000));
}

function serializeMatchCandidate(order, matchStrategy, options = {}) {
  const dayDelta = Math.abs(daysBetween(order.planned_date, new Date()));
  return {
    ...enrichOrder(order),
    match_strategy: matchStrategy,
    match_label: options.matchLabel || matchStrategy.replace(/_/g, ' '),
    day_delta: dayDelta,
    is_plate_match: options.isPlateMatch !== false,
    is_manual_override: matchStrategy === 'MANUAL',
    match_score: options.matchScore ?? (
      matchStrategy === 'EXACT_SAME_DAY'
        ? 100
        : matchStrategy === 'EXACT_WINDOW'
          ? 80 - dayDelta
          : 40 - dayDelta
    ),
  };
}

async function syncOrderWasteStreams(tx, orderId, wasteStreamIds) {
  await tx.orderWasteStream.deleteMany({ where: { order_id: orderId } });
  if (wasteStreamIds && wasteStreamIds.length > 0) {
    await tx.orderWasteStream.createMany({
      data: wasteStreamIds.map((wsId) => ({
        id: require('crypto').randomUUID(),
        order_id: orderId,
        waste_stream_id: wsId,
      })),
    });
  }
}

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

  return { data: orders.map(enrichOrder), total, page: pageNum, limit: limitNum };
}

async function getOrder(id) {
  const order = await prisma.inboundOrder.findUnique({
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
  return enrichOrder(order);
}

async function createOrder(data, userId) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);

    // waste_stream_ids: array of waste stream IDs. First one becomes primary waste_stream_id.
    const wasteStreamIds = data.waste_stream_ids && data.waste_stream_ids.length > 0
      ? data.waste_stream_ids
      : [data.waste_stream_id];
    const primaryWsId = wasteStreamIds[0];

    // PRO afvalstroomnummer validation (SUP-D02)
    if (data.afvalstroomnummer) {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplier_id }, select: { supplier_type: true } });
      if (supplier && supplier.supplier_type === 'PRO') {
        const validAfs = await tx.supplierAfvalstroomnummer.findFirst({
          where: {
            supplier_id: data.supplier_id,
            afvalstroomnummer: data.afvalstroomnummer,
            is_active: true,
          },
        });
        if (!validAfs) {
          const err = new Error('Afvalstroomnummer is not registered for this PRO supplier');
          err.statusCode = 400;
          throw err;
        }
      }
    }

    const order = await tx.inboundOrder.create({
      data: {
        order_number: orderNumber,
        carrier_id: data.carrier_id,
        supplier_id: data.supplier_id,
        waste_stream_id: primaryWsId,
        planned_date: new Date(data.planned_date),
        planned_time_window_start: data.planned_time_window_start ? new Date(data.planned_time_window_start) : null,
        planned_time_window_end: data.planned_time_window_end ? new Date(data.planned_time_window_end) : null,
        expected_skip_count: parseInt(data.expected_skip_count, 10) || 1,
        vehicle_plate: data.vehicle_plate || null,
        afvalstroomnummer: data.afvalstroomnummer || null,
        notes: data.notes || null,
        is_lzv: data.is_lzv || false,
        client_reference: data.client_reference || null,
        status: 'PLANNED',
        is_adhoc: false,
        created_by: userId,
      },
    });

    await syncOrderWasteStreams(tx, order.id, wasteStreamIds);

    const full = await tx.inboundOrder.findUnique({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'InboundOrder',
      entityId: order.id,
      after: full,
    }, tx);

    return enrichOrder(full);
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
    if (data.planned_date !== undefined) updateData.planned_date = new Date(data.planned_date);
    if (data.planned_time_window_start !== undefined) updateData.planned_time_window_start = data.planned_time_window_start ? new Date(data.planned_time_window_start) : null;
    if (data.planned_time_window_end !== undefined) updateData.planned_time_window_end = data.planned_time_window_end ? new Date(data.planned_time_window_end) : null;
    if (data.expected_skip_count !== undefined) updateData.expected_skip_count = parseInt(data.expected_skip_count, 10);
    if (data.vehicle_plate !== undefined) updateData.vehicle_plate = data.vehicle_plate;
    if (data.afvalstroomnummer !== undefined) updateData.afvalstroomnummer = data.afvalstroomnummer;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    // If waste_stream_ids provided, update primary + junction table
    if (data.waste_stream_ids && data.waste_stream_ids.length > 0) {
      updateData.waste_stream_id = data.waste_stream_ids[0];
      await syncOrderWasteStreams(tx, id, data.waste_stream_ids);
    } else if (data.waste_stream_id !== undefined) {
      updateData.waste_stream_id = data.waste_stream_id;
      await syncOrderWasteStreams(tx, id, [data.waste_stream_id]);
    }

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

    return enrichOrder(updated);
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

    return enrichOrder(updated);
  });
}

async function setIncident(orderId, incidentCategory, incidentNotes, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.inboundOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    const updateData = {
      incident_category: incidentCategory,
      incident_notes: incidentNotes || null,
    };

    // DAMAGE or DISPUTE -> auto transition to DISPUTE status
    if ((incidentCategory === 'DAMAGE' || incidentCategory === 'DISPUTE') && order.status !== 'DISPUTE') {
      if (canTransition(order.status, 'DISPUTE')) {
        updateData.status = 'DISPUTE';
      }
    }

    const updated = await tx.inboundOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    // Notify LOGISTICS_PLANNER and FINANCE_MANAGER on DAMAGE or DISPUTE
    if (incidentCategory === 'DAMAGE' || incidentCategory === 'DISPUTE') {
      await notifyRoles(tx, ['LOGISTICS_PLANNER', 'FINANCE_MANAGER'], {
        type: 'INCIDENT_ALERT',
        title: `Incident: ${incidentCategory} on order ${order.order_number}`,
        message: incidentNotes || `${incidentCategory} incident reported on order ${order.order_number}`,
        entityType: 'InboundOrder',
        entityId: orderId,
      });
    }

    await writeAuditLog({
      userId,
      action: 'SET_INCIDENT',
      entityType: 'InboundOrder',
      entityId: orderId,
      before: { incident_category: order.incident_category, incident_notes: order.incident_notes, status: order.status },
      after: { incident_category: updateData.incident_category, incident_notes: updateData.incident_notes, status: updateData.status || order.status },
    }, tx);

    return enrichOrder(updated);
  });
}

async function getPlanningBoard({ date, carrier_id, supplier_id, supplier_type, waste_stream_id, status }) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const where = {
    planned_date: { gte: startOfDay, lte: endOfDay },
  };
  if (carrier_id) where.carrier_id = carrier_id;
  if (supplier_id) where.supplier_id = supplier_id;
  if (supplier_type) where.supplier = { supplier_type };
  if (waste_stream_id) where.waste_stream_id = waste_stream_id;
  if (status) where.status = status;

  const orders = await prisma.inboundOrder.findMany({
    where,
    include: {
      carrier: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, supplier_type: true } },
      waste_stream: { select: { id: true, name_en: true, code: true } },
      waste_streams: { include: { waste_stream: { select: { id: true, name_en: true, code: true } } } },
      inbounds: {
        select: {
          id: true,
          inbound_number: true,
          status: true,
          net_weight_kg: true,
        },
      },
    },
    orderBy: [
      { planned_time_window_start: 'asc' },
      { order_number: 'asc' },
    ],
  });

  return orders.map((o) => enrichOrder({
    ...o,
    inbound_count: o.inbounds.length,
    total_net_weight_kg: o.inbounds.reduce((sum, i) => sum + (i.net_weight_kg ? Number(i.net_weight_kg) : 0), 0),
    completed_inbounds: o.inbounds.filter((i) => ['READY_FOR_SORTING', 'SORTED'].includes(i.status)).length,
  }));
}

async function matchPlate(plate) {
  // Search window: 7 days back to 7 days forward
  const from = new Date();
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 7);
  to.setHours(23, 59, 59, 999);

  const activeStatuses = ['PLANNED', 'ARRIVED', 'IN_PROGRESS', 'DISPUTE'];
  const [plateMatches, manualOverridePool] = await Promise.all([
    prisma.inboundOrder.findMany({
      where: {
        status: { in: activeStatuses },
        vehicle_plate: { equals: plate, mode: 'insensitive' },
        planned_date: { gte: from, lte: to },
      },
      include: ORDER_INCLUDE,
      orderBy: { planned_date: 'asc' },
      take: 20,
    }),
    prisma.inboundOrder.findMany({
      where: {
        status: { in: activeStatuses },
        planned_date: { gte: from, lte: to },
      },
      include: ORDER_INCLUDE,
      orderBy: [
        { planned_date: 'asc' },
        { order_number: 'asc' },
      ],
      take: 30,
    }),
  ]);

  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const exactSameDay = plateMatches
    .filter((order) => {
      const plannedDate = new Date(order.planned_date);
      return plannedDate >= todayStart && plannedDate <= todayEnd;
    })
    .map((order) => serializeMatchCandidate(order, 'EXACT_SAME_DAY', { matchLabel: 'Exact plate + same day' }));

  const exactWindow = plateMatches
    .filter((order) => !exactSameDay.some((candidate) => candidate.id === order.id))
    .map((order) => serializeMatchCandidate(order, 'EXACT_WINDOW', { matchLabel: 'Exact plate within +/- 7 days' }));

  const manualOverrideCandidates = manualOverridePool
    .filter((order) => !plateMatches.some((candidate) => candidate.id === order.id))
    .slice(0, 10)
    .map((order) => serializeMatchCandidate(order, 'MANUAL', {
      matchLabel: 'Manual override candidate',
      isPlateMatch: false,
      matchScore: 20 - Math.abs(daysBetween(order.planned_date, new Date())),
    }));

  return {
    plate,
    exact_same_day: exactSameDay,
    exact_window: exactWindow,
    manual_override_candidates: manualOverrideCandidates,
    ranked_candidates: [...exactSameDay, ...exactWindow, ...manualOverrideCandidates],
    can_create_adhoc: true,
  };
}

async function createAdhocArrival(data, userId) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);

    const wasteStreamIds = data.waste_stream_ids && data.waste_stream_ids.length > 0
      ? data.waste_stream_ids
      : [data.waste_stream_id];
    const primaryWsId = wasteStreamIds[0];

    // PRO afvalstroomnummer validation (SUP-D02)
    if (data.afvalstroomnummer) {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplier_id }, select: { supplier_type: true } });
      if (supplier && supplier.supplier_type === 'PRO') {
        const validAfs = await tx.supplierAfvalstroomnummer.findFirst({
          where: {
            supplier_id: data.supplier_id,
            afvalstroomnummer: data.afvalstroomnummer,
            is_active: true,
          },
        });
        if (!validAfs) {
          const err = new Error('Afvalstroomnummer is not registered for this PRO supplier');
          err.statusCode = 400;
          throw err;
        }
      }
    }

    const order = await tx.inboundOrder.create({
      data: {
        order_number: orderNumber,
        carrier_id: data.carrier_id,
        supplier_id: data.supplier_id,
        waste_stream_id: primaryWsId,
        planned_date: new Date(),
        expected_skip_count: parseInt(data.expected_skip_count, 10) || 1,
        vehicle_plate: data.vehicle_plate || null,
        notes: data.notes || null,
        adhoc_person_name: data.adhoc_person_name || null,
        adhoc_id_reference: data.adhoc_id_reference || null,
        status: 'PLANNED',
        is_adhoc: true,
        created_by: userId,
      },
    });

    await syncOrderWasteStreams(tx, order.id, wasteStreamIds);

    const full = await tx.inboundOrder.findUnique({
      where: { id: order.id },
      include: ORDER_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE_ADHOC',
      entityType: 'InboundOrder',
      entityId: full.id,
      after: full,
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
            message: `Ad-hoc order: ${full.order_number} — plate ${data.vehicle_plate || 'N/A'}`,
            entity_type: 'InboundOrder',
            entity_id: full.id,
          })),
        });
      }
    } catch {
      // notification is non-critical
    }

    return enrichOrder(full);
  });
}

module.exports = {
  listOrders, getOrder, createOrder, updateOrder, cancelOrder,
  setIncident, getPlanningBoard,
  matchPlate, createAdhocArrival,
};
