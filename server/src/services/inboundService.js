const prisma = require('../utils/prismaClient');
const { canTransition, getAllowedTransitions } = require('../utils/inboundStateMachine');
const { canTransition: canOrderTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');
const { requestWeighing } = require('./pfisterSimulator');
const { generateInboundNumber } = require('../utils/inboundNumber');

const TERMINAL_STATUSES = ['READY_FOR_SORTING', 'SORTED'];

const INBOUND_INCLUDE = {
  order: {
    include: {
      carrier: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, supplier_type: true } },
      waste_stream: { select: { id: true, name_en: true, code: true } },
    },
  },
  vehicle: true,
  waste_stream: { select: { id: true, name_en: true, code: true } },
  gross_ticket: true,
  tare_ticket: true,
  assets: {
    include: {
      waste_stream: { select: { id: true, name_en: true, code: true } },
    },
    orderBy: { created_at: 'asc' },
  },
  confirmed_by_user: { select: { id: true, full_name: true } },
  sorting_session: { select: { id: true, status: true } },
};

function enrichInbound(inbound) {
  inbound.can_add_skips = !TERMINAL_STATUSES.includes(inbound.status);
  inbound.allowed_transitions = getAllowedTransitions(inbound.status);
  return inbound;
}

async function getInbound(id) {
  const inbound = await prisma.inbound.findUnique({
    where: { id },
    include: INBOUND_INCLUDE,
  });
  if (!inbound) return null;
  return enrichInbound(inbound);
}

async function listInbounds({ status, search, order_id, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (status) where.status = status;
  if (order_id) where.order_id = order_id;
  if (search) {
    where.OR = [
      { order: { order_number: { contains: search, mode: 'insensitive' } } },
      { inbound_number: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [inbounds, total] = await Promise.all([
    prisma.inbound.findMany({
      where, skip, take: limitNum,
      include: INBOUND_INCLUDE,
      orderBy: { arrived_at: 'desc' },
    }),
    prisma.inbound.count({ where }),
  ]);

  return { data: inbounds, total, page: pageNum, limit: limitNum };
}

async function listInboundsByOrder(orderId) {
  return prisma.inbound.findMany({
    where: { order_id: orderId },
    include: INBOUND_INCLUDE,
    orderBy: { arrived_at: 'desc' },
  });
}

async function createInbound(data, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.inboundOrder.findUnique({ where: { id: data.order_id } });
    if (!order) throw new Error('Order not found');

    if (!['PLANNED', 'ARRIVED', 'IN_PROGRESS'].includes(order.status)) {
      const err = new Error(`Order must be PLANNED, ARRIVED or IN_PROGRESS to create an inbound (current: ${order.status})`);
      err.statusCode = 409;
      throw err;
    }

    // Find or create vehicle
    const plate = data.registration_plate || order.vehicle_plate;
    let vehicle = await tx.vehicle.findUnique({
      where: { registration_plate: plate },
    });

    if (!vehicle) {
      vehicle = await tx.vehicle.create({
        data: {
          registration_plate: plate,
          carrier_id: order.carrier_id,
        },
      });
    }

    const inboundNumber = await generateInboundNumber(tx);

    const inbound = await tx.inbound.create({
      data: {
        inbound_number: inboundNumber,
        order_id: data.order_id,
        vehicle_id: vehicle.id,
        waste_stream_id: data.waste_stream_id || null,
        status: 'ARRIVED',
        notes: data.notes || null,
      },
      include: INBOUND_INCLUDE,
    });

    // Transition order PLANNED → ARRIVED
    if (order.status === 'PLANNED' && canOrderTransition('PLANNED', 'ARRIVED')) {
      await tx.inboundOrder.update({
        where: { id: order.id },
        data: { status: 'ARRIVED' },
      });

      await writeAuditLog({
        userId,
        action: 'STATUS_CHANGE',
        entityType: 'InboundOrder',
        entityId: order.id,
        before: { status: 'PLANNED' },
        after: { status: 'ARRIVED' },
      }, tx);
    }

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'Inbound',
      entityId: inbound.id,
      after: { inbound_number: inboundNumber, order_id: inbound.order_id, vehicle_id: inbound.vehicle_id, status: inbound.status },
    }, tx);

    return enrichInbound(inbound);
  });
}

async function updateInboundStatus(id, newStatus, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id },
      include: { assets: true },
    });
    if (!inbound) throw new Error('Inbound not found');

    if (!canTransition(inbound.status, newStatus)) {
      const err = new Error(`Cannot transition from ${inbound.status} to ${newStatus}`);
      err.statusCode = 409;
      throw err;
    }

    // Validate before READY_FOR_SORTING
    if (newStatus === 'READY_FOR_SORTING') {
      if (inbound.assets.length === 0) {
        const err = new Error('At least one skip is required');
        err.statusCode = 400;
        throw err;
      }

      const incompleteAssets = inbound.assets.filter(
        (a) => a.gross_weight_kg == null || a.tare_weight_kg == null
      );
      if (incompleteAssets.length > 0) {
        const err = new Error(`${incompleteAssets.length} skip(s) missing gross or tare weight`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updateData = { status: newStatus };
    if (newStatus === 'READY_FOR_SORTING') {
      updateData.confirmed_by = userId;
      updateData.confirmed_at = new Date();
    }

    const updated = await tx.inbound.update({
      where: { id },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType: 'Inbound',
      entityId: id,
      before: { status: inbound.status },
      after: { status: newStatus },
    }, tx);

    // On READY_FOR_SORTING: auto-create SortingSession
    if (newStatus === 'READY_FOR_SORTING') {
      const session = await tx.sortingSession.create({
        data: {
          inbound_id: id,
          order_id: inbound.order_id,
          recorded_by: userId,
          status: 'PLANNED',
        },
      });

      await writeAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'SortingSession',
        entityId: session.id,
        after: { inbound_id: id, order_id: inbound.order_id },
      }, tx);

      updated.sorting_session = { id: session.id, status: session.status };
    }

    // Auto-complete order when total skips across confirmed inbounds >= expected_skip_count
    if (['READY_FOR_SORTING', 'SORTED'].includes(newStatus)) {
      const order = await tx.inboundOrder.findUnique({ where: { id: inbound.order_id } });
      if (order && order.status === 'IN_PROGRESS' && canOrderTransition('IN_PROGRESS', 'COMPLETED')) {
        const confirmedInbounds = await tx.inbound.findMany({
          where: {
            order_id: order.id,
            status: { in: ['READY_FOR_SORTING', 'SORTED'] },
          },
          include: { assets: { select: { id: true } } },
        });
        const totalSkips = confirmedInbounds.reduce((sum, ib) => sum + ib.assets.length, 0);
        if (totalSkips >= order.expected_skip_count) {
          await tx.inboundOrder.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          });
          await writeAuditLog({
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'InboundOrder',
            entityId: order.id,
            before: { status: 'IN_PROGRESS' },
            after: { status: 'COMPLETED', reason: `All expected skips confirmed (${totalSkips}/${order.expected_skip_count})` },
          }, tx);
        }
      }
    }

    return enrichInbound(updated);
  });
}

async function setInboundWasteStream(id, wasteStreamId, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({ where: { id } });
    if (!inbound) throw new Error('Inbound not found');
    if (TERMINAL_STATUSES.includes(inbound.status)) {
      const err = new Error('Cannot change waste stream on this inbound');
      err.statusCode = 409;
      throw err;
    }

    const updated = await tx.inbound.update({
      where: { id },
      data: { waste_stream_id: wasteStreamId },
      include: INBOUND_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'Inbound',
      entityId: id,
      before: { waste_stream_id: inbound.waste_stream_id },
      after: { waste_stream_id: wasteStreamId },
    }, tx);

    return enrichInbound(updated);
  });
}

// Pfister gross weighing — auto-transitions ARRIVED → WEIGHED_IN
async function triggerGrossWeighing(inboundId, userId) {
  const existing = await prisma.inbound.findUnique({ where: { id: inboundId } });
  if (!existing) throw new Error('Inbound not found');

  if (existing.gross_ticket_id) {
    const err = new Error('Gross weighing already recorded');
    err.statusCode = 409;
    throw err;
  }

  const ticket = await requestWeighing('GROSS');

  return prisma.$transaction(async (tx) => {
    const updateData = {
      gross_ticket_id: ticket.id,
      gross_weight_kg: ticket.weight_kg,
    };

    // Auto-transition ARRIVED → WEIGHED_IN
    if (existing.status === 'ARRIVED' && canTransition('ARRIVED', 'WEIGHED_IN')) {
      updateData.status = 'WEIGHED_IN';
    }

    const inbound = await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'GROSS_WEIGHING',
      entityType: 'Inbound',
      entityId: inboundId,
      after: { gross_weight_kg: Number(ticket.weight_kg), ticket_number: ticket.ticket_number, status: inbound.status },
    }, tx);

    // Transition order ARRIVED → IN_PROGRESS when inbound gets WEIGHED_IN
    if (inbound.status === 'WEIGHED_IN') {
      const order = await tx.inboundOrder.findUnique({ where: { id: existing.order_id } });
      if (order && order.status === 'ARRIVED' && canOrderTransition('ARRIVED', 'IN_PROGRESS')) {
        await tx.inboundOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' },
        });
        await writeAuditLog({
          userId,
          action: 'STATUS_CHANGE',
          entityType: 'InboundOrder',
          entityId: order.id,
          before: { status: 'ARRIVED' },
          after: { status: 'IN_PROGRESS', trigger: 'inbound_weighed_in' },
        }, tx);
      }
    }

    return enrichInbound(inbound);
  });
}

// Pfister tare weighing — auto-distributes to skips, transitions WEIGHED_IN → WEIGHED_OUT
async function triggerTareWeighing(inboundId, userId) {
  const existing = await prisma.inbound.findUnique({
    where: { id: inboundId },
    include: { assets: true },
  });
  if (!existing) throw new Error('Inbound not found');

  if (!existing.gross_ticket_id) {
    const err = new Error('Gross weighing must be completed before tare');
    err.statusCode = 400;
    throw err;
  }
  if (existing.tare_ticket_id) {
    const err = new Error('Tare weighing already recorded');
    err.statusCode = 409;
    throw err;
  }

  // Validate at least one skip with gross weight
  const assetsWithGross = existing.assets.filter((a) => a.gross_weight_kg != null && Number(a.gross_weight_kg) > 0);
  if (assetsWithGross.length === 0) {
    const err = new Error('At least one skip with gross weight is required before tare');
    err.statusCode = 400;
    throw err;
  }

  const grossWeightKg = Number(existing.gross_weight_kg);
  const ticket = await requestWeighing('TARE', grossWeightKg);
  const tareWeightKg = Number(ticket.weight_kg);
  const netWeightKg = grossWeightKg - tareWeightKg;

  return prisma.$transaction(async (tx) => {
    const updateData = {
      tare_ticket_id: ticket.id,
      tare_weight_kg: tareWeightKg,
      net_weight_kg: netWeightKg,
    };

    // Auto-transition WEIGHED_IN → WEIGHED_OUT
    if (existing.status === 'WEIGHED_IN' && canTransition('WEIGHED_IN', 'WEIGHED_OUT')) {
      updateData.status = 'WEIGHED_OUT';
    }

    const inbound = await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    // Auto-distribute tare to skips proportionally based on gross weights
    const totalSkipGross = assetsWithGross.reduce((sum, a) => sum + Number(a.gross_weight_kg), 0);
    let distributedTare = 0;

    for (let i = 0; i < assetsWithGross.length; i++) {
      const asset = assetsWithGross[i];
      const assetGross = Number(asset.gross_weight_kg);
      let assetTare;

      if (i === assetsWithGross.length - 1) {
        // Last asset gets remainder to avoid rounding errors
        assetTare = Math.round((tareWeightKg - distributedTare) * 100) / 100;
      } else {
        assetTare = Math.round((tareWeightKg * (assetGross / totalSkipGross)) * 100) / 100;
        distributedTare += assetTare;
      }

      const assetNet = Math.round((assetGross - assetTare) * 100) / 100;

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          tare_weight_kg: assetTare,
          net_weight_kg: assetNet,
        },
      });
    }

    await writeAuditLog({
      userId,
      action: 'TARE_WEIGHING',
      entityType: 'Inbound',
      entityId: inboundId,
      after: { tare_weight_kg: tareWeightKg, net_weight_kg: netWeightKg, ticket_number: ticket.ticket_number, status: inbound.status, assets_distributed: assetsWithGross.length },
    }, tx);

    // Re-fetch to get updated asset weights
    const refreshed = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: INBOUND_INCLUDE,
    });

    return enrichInbound(refreshed);
  });
}

async function manualWeighing(inboundId, data, userId) {
  const weightKg = parseFloat(data.weight_kg);
  if (isNaN(weightKg) || weightKg <= 0) {
    const err = new Error('weight_kg must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: { assets: true },
    });
    if (!inbound) throw new Error('Inbound not found');

    const isGross = data.weight_type === 'GROSS';

    if (isGross && inbound.gross_ticket_id) {
      const err = new Error('Gross weighing already recorded');
      err.statusCode = 409;
      throw err;
    }
    if (!isGross && inbound.tare_ticket_id) {
      const err = new Error('Tare weighing already recorded');
      err.statusCode = 409;
      throw err;
    }
    if (!isGross && !inbound.gross_ticket_id) {
      const err = new Error('Gross weighing must be completed before tare');
      err.statusCode = 400;
      throw err;
    }

    const ticket = await tx.pfisterTicket.create({
      data: {
        ticket_number: `MAN-${Date.now()}`,
        weighing_type: data.weight_type,
        weight_kg: weightKg,
        unit: 'kg',
        timestamp: new Date(),
        raw_payload: JSON.stringify({ manual_entry: true, reason: data.reason || 'Pfister unavailable' }),
        is_manual_override: true,
        override_reason: data.reason || 'Pfister unavailable',
        override_by: userId,
      },
    });

    const updateData = {};
    if (isGross) {
      updateData.gross_ticket_id = ticket.id;
      updateData.gross_weight_kg = weightKg;
      // Auto-transition ARRIVED → WEIGHED_IN
      if (inbound.status === 'ARRIVED' && canTransition('ARRIVED', 'WEIGHED_IN')) {
        updateData.status = 'WEIGHED_IN';
      }
    } else {
      updateData.tare_ticket_id = ticket.id;
      updateData.tare_weight_kg = weightKg;
      updateData.net_weight_kg = Number(inbound.gross_weight_kg) - weightKg;
      // Auto-transition WEIGHED_IN → WEIGHED_OUT
      if (inbound.status === 'WEIGHED_IN' && canTransition('WEIGHED_IN', 'WEIGHED_OUT')) {
        updateData.status = 'WEIGHED_OUT';
      }

      // Auto-distribute tare to skips proportionally
      const assetsWithGross = inbound.assets.filter((a) => a.gross_weight_kg != null && Number(a.gross_weight_kg) > 0);
      if (assetsWithGross.length > 0) {
        const totalSkipGross = assetsWithGross.reduce((sum, a) => sum + Number(a.gross_weight_kg), 0);
        let distributedTare = 0;

        for (let i = 0; i < assetsWithGross.length; i++) {
          const asset = assetsWithGross[i];
          const assetGross = Number(asset.gross_weight_kg);
          let assetTare;
          if (i === assetsWithGross.length - 1) {
            assetTare = Math.round((weightKg - distributedTare) * 100) / 100;
          } else {
            assetTare = Math.round((weightKg * (assetGross / totalSkipGross)) * 100) / 100;
            distributedTare += assetTare;
          }
          const assetNet = Math.round((assetGross - assetTare) * 100) / 100;
          await tx.asset.update({
            where: { id: asset.id },
            data: { tare_weight_kg: assetTare, net_weight_kg: assetNet },
          });
        }
      }
    }

    const updated = await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: isGross ? 'GROSS_WEIGHING' : 'TARE_WEIGHING',
      entityType: 'Inbound',
      entityId: inboundId,
      after: { weight_kg: weightKg, manual: true, status: updated.status },
    }, tx);

    // Transition order ARRIVED → IN_PROGRESS when inbound gets WEIGHED_IN
    if (isGross && updated.status === 'WEIGHED_IN') {
      const order = await tx.inboundOrder.findUnique({ where: { id: inbound.order_id } });
      if (order && order.status === 'ARRIVED' && canOrderTransition('ARRIVED', 'IN_PROGRESS')) {
        await tx.inboundOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' },
        });
        await writeAuditLog({
          userId,
          action: 'STATUS_CHANGE',
          entityType: 'InboundOrder',
          entityId: order.id,
          before: { status: 'ARRIVED' },
          after: { status: 'IN_PROGRESS', trigger: 'inbound_weighed_in' },
        }, tx);
      }
    }

    return enrichInbound(updated);
  });
}

async function overrideWeight(inboundId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: { gross_ticket: true, tare_ticket: true },
    });
    if (!inbound) throw new Error('Inbound not found');

    const ticketField = data.weight_type === 'GROSS' ? 'gross_ticket' : 'tare_ticket';
    const ticket = inbound[ticketField];
    if (!ticket) {
      const err = new Error(`No ${data.weight_type} ticket exists to override`);
      err.statusCode = 400;
      throw err;
    }

    const weightKg = parseFloat(data.weight_kg);
    if (isNaN(weightKg) || weightKg <= 0) {
      const err = new Error('weight_kg must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    const beforeWeight = Number(ticket.weight_kg);

    await tx.pfisterTicket.update({
      where: { id: ticket.id },
      data: {
        weight_kg: weightKg,
        is_manual_override: true,
        override_reason: data.reason_code || null,
        override_by: userId,
      },
    });

    const updateData = {};
    if (data.weight_type === 'GROSS') {
      updateData.gross_weight_kg = weightKg;
      if (inbound.tare_weight_kg) {
        updateData.net_weight_kg = weightKg - Number(inbound.tare_weight_kg);
      }
    } else {
      updateData.tare_weight_kg = weightKg;
      if (inbound.gross_weight_kg) {
        updateData.net_weight_kg = Number(inbound.gross_weight_kg) - weightKg;
      }
    }

    const updated = await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'WEIGHT_OVERRIDE',
      entityType: 'Inbound',
      entityId: inboundId,
      before: { weight_type: data.weight_type, weight_kg: beforeWeight },
      after: { weight_type: data.weight_type, weight_kg: weightKg, reason_code: data.reason_code },
    }, tx);

    return enrichInbound(updated);
  });
}

async function lookupAsset(assetLabel) {
  return prisma.asset.findUnique({
    where: { asset_label: assetLabel },
    include: {
      inbound: {
        select: { id: true, order_id: true, status: true },
      },
      waste_stream: {
        select: { id: true, name_en: true, code: true },
      },
    },
  });
}

module.exports = {
  getInbound,
  listInbounds,
  listInboundsByOrder,
  createInbound,
  updateInboundStatus,
  setInboundWasteStream,
  triggerGrossWeighing,
  triggerTareWeighing,
  manualWeighing,
  overrideWeight,
  lookupAsset,
};
