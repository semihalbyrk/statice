const prisma = require('../utils/prismaClient');
const { canTransition } = require('../utils/weighingStateMachine');
const { canTransition: canOrderTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');
const { requestWeighing } = require('./pfisterSimulator');

const EVENT_INCLUDE = {
  order: {
    include: {
      carrier: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, supplier_type: true } },
      waste_stream: { select: { id: true, name_en: true, code: true } },
    },
  },
  vehicle: true,
  gross_ticket: true,
  tare_ticket: true,
  assets: {
    include: {
      material_category: { select: { id: true, code_cbs: true, description_en: true } },
    },
    orderBy: { created_at: 'asc' },
  },
  confirmed_by_user: { select: { id: true, full_name: true } },
  sorting_session: { select: { id: true, status: true } },
};

async function getWeighingEvent(id) {
  const event = await prisma.weighingEvent.findUnique({
    where: { id },
    include: EVENT_INCLUDE,
  });
  if (!event) return null;

  // Add computed field
  event.can_add_skips = !['CONFIRMED'].includes(event.status);
  return event;
}

async function listWeighingEvents(orderId) {
  return prisma.weighingEvent.findMany({
    where: { order_id: orderId },
    include: EVENT_INCLUDE,
    orderBy: { arrived_at: 'desc' },
  });
}

async function createWeighingEvent(data, userId) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.inboundOrder.findUnique({ where: { id: data.order_id } });
    if (!order) throw new Error('Order not found');

    if (!['ARRIVED', 'IN_PROGRESS'].includes(order.status)) {
      const err = new Error(`Order must be ARRIVED or IN_PROGRESS to create a weighing event (current: ${order.status})`);
      err.statusCode = 409;
      throw err;
    }

    // Find or create vehicle
    let vehicle = await tx.vehicle.findUnique({
      where: { registration_plate: data.registration_plate },
    });

    if (!vehicle) {
      vehicle = await tx.vehicle.create({
        data: {
          registration_plate: data.registration_plate,
          carrier_id: order.carrier_id,
          type: data.vehicle_type || null,
        },
      });
    }

    const event = await tx.weighingEvent.create({
      data: {
        order_id: data.order_id,
        vehicle_id: vehicle.id,
        status: 'PENDING_GROSS',
        notes: data.notes || null,
      },
      include: EVENT_INCLUDE,
    });

    // Transition order to IN_PROGRESS if currently ARRIVED
    if (order.status === 'ARRIVED' && canOrderTransition('ARRIVED', 'IN_PROGRESS')) {
      await tx.inboundOrder.update({
        where: { id: order.id },
        data: { status: 'IN_PROGRESS' },
      });

      await writeAuditLog({
        userId,
        action: 'STATUS_CHANGE',
        entityType: 'InboundOrder',
        entityId: order.id,
        before: { status: order.status },
        after: { status: 'IN_PROGRESS' },
      }, tx);
    }

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'WeighingEvent',
      entityId: event.id,
      after: { order_id: event.order_id, vehicle_id: event.vehicle_id, status: event.status },
    }, tx);

    event.can_add_skips = true;
    return event;
  });
}

async function triggerGrossWeighing(eventId, userId) {
  // Fetch event to validate status before the slow weighing call
  const existing = await prisma.weighingEvent.findUnique({ where: { id: eventId } });
  if (!existing) throw new Error('Weighing event not found');

  if (existing.status !== 'PENDING_GROSS') {
    const err = new Error(`Cannot trigger gross weighing from status ${existing.status}`);
    err.statusCode = 409;
    throw err;
  }

  // Call Pfister simulator (1500ms delay)
  const ticket = await requestWeighing('GROSS');

  // Update event in transaction
  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.update({
      where: { id: eventId },
      data: {
        gross_ticket_id: ticket.id,
        gross_weight_kg: ticket.weight_kg,
        status: 'GROSS_COMPLETE',
      },
      include: EVENT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'GROSS_WEIGHING',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { status: 'PENDING_GROSS' },
      after: { status: 'GROSS_COMPLETE', gross_weight_kg: Number(ticket.weight_kg), ticket_number: ticket.ticket_number },
    }, tx);

    event.can_add_skips = true;
    return event;
  });
}

async function advanceToTare(eventId, userId) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.findUnique({
      where: { id: eventId },
      include: { assets: true },
    });
    if (!event) throw new Error('Weighing event not found');

    if (event.status !== 'GROSS_COMPLETE') {
      const err = new Error(`Cannot advance to tare from status ${event.status}`);
      err.statusCode = 409;
      throw err;
    }

    if (event.assets.length === 0) {
      const err = new Error('At least one skip/asset is required before tare weighing');
      err.statusCode = 400;
      throw err;
    }

    const updated = await tx.weighingEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING_TARE' },
      include: EVENT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { status: 'GROSS_COMPLETE' },
      after: { status: 'PENDING_TARE' },
    }, tx);

    updated.can_add_skips = true;
    return updated;
  });
}

async function triggerTareWeighing(eventId, userId) {
  const existing = await prisma.weighingEvent.findUnique({
    where: { id: eventId },
    include: { assets: true },
  });
  if (!existing) throw new Error('Weighing event not found');

  if (existing.status !== 'PENDING_TARE') {
    const err = new Error(`Cannot trigger tare weighing from status ${existing.status}`);
    err.statusCode = 409;
    throw err;
  }

  if (existing.assets.length === 0) {
    const err = new Error('At least one skip/asset is required before tare weighing');
    err.statusCode = 400;
    throw err;
  }

  // Call Pfister simulator with gross weight for capping
  const grossWeightKg = Number(existing.gross_weight_kg);
  const ticket = await requestWeighing('TARE', grossWeightKg);

  const tareWeightKg = Number(ticket.weight_kg);
  const netWeightKg = grossWeightKg - tareWeightKg;

  return prisma.$transaction(async (tx) => {
    // Distribute net weight across assets
    const assets = await tx.asset.findMany({
      where: { weighing_event_id: eventId },
      orderBy: { created_at: 'asc' },
    });

    const totalVolume = assets.reduce((sum, a) => sum + (Number(a.estimated_volume_m3) || 0), 0);
    const useVolumeDistribution = totalVolume > 0;

    let distributed = 0;
    for (let i = 0; i < assets.length; i++) {
      let assetNet;
      if (i === assets.length - 1) {
        // Last asset gets remainder to avoid rounding issues
        assetNet = Math.round((netWeightKg - distributed) * 100) / 100;
      } else if (useVolumeDistribution) {
        const proportion = (Number(assets[i].estimated_volume_m3) || 0) / totalVolume;
        assetNet = Math.round(netWeightKg * proportion * 100) / 100;
      } else {
        assetNet = Math.round((netWeightKg / assets.length) * 100) / 100;
      }
      distributed += assetNet;

      // Distribute gross/tare proportionally to net
      const proportion = netWeightKg > 0 ? assetNet / netWeightKg : 1 / assets.length;
      const assetGross = Math.round(grossWeightKg * proportion * 100) / 100;
      const assetTare = Math.round(tareWeightKg * proportion * 100) / 100;

      await tx.asset.update({
        where: { id: assets[i].id },
        data: {
          net_weight_kg: assetNet,
          gross_weight_kg: assetGross,
          tare_weight_kg: assetTare,
        },
      });
    }

    const event = await tx.weighingEvent.update({
      where: { id: eventId },
      data: {
        tare_ticket_id: ticket.id,
        tare_weight_kg: tareWeightKg,
        net_weight_kg: netWeightKg,
        status: 'TARE_COMPLETE',
      },
      include: EVENT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'TARE_WEIGHING',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { status: 'PENDING_TARE' },
      after: {
        status: 'TARE_COMPLETE',
        tare_weight_kg: tareWeightKg,
        net_weight_kg: netWeightKg,
        ticket_number: ticket.ticket_number,
      },
    }, tx);

    event.can_add_skips = true;
    return event;
  });
}

async function confirmWeighingEvent(eventId, userId) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.findUnique({
      where: { id: eventId },
      include: { assets: true },
    });
    if (!event) throw new Error('Weighing event not found');

    if (event.status !== 'TARE_COMPLETE') {
      const err = new Error(`Cannot confirm from status ${event.status}`);
      err.statusCode = 409;
      throw err;
    }

    if (event.assets.length === 0) {
      const err = new Error('At least one skip/asset is required to confirm');
      err.statusCode = 400;
      throw err;
    }

    const updated = await tx.weighingEvent.update({
      where: { id: eventId },
      data: {
        status: 'CONFIRMED',
        confirmed_by: userId,
        confirmed_at: new Date(),
      },
      include: EVENT_INCLUDE,
    });

    // Create SortingSession (DRAFT)
    const session = await tx.sortingSession.create({
      data: {
        weighing_event_id: eventId,
        order_id: event.order_id,
        recorded_by: userId,
        status: 'PLANNED',
      },
    });

    await writeAuditLog({
      userId,
      action: 'CONFIRM',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { status: 'TARE_COMPLETE' },
      after: { status: 'CONFIRMED', sorting_session_id: session.id },
    }, tx);

    updated.can_add_skips = false;
    updated.sorting_session = { id: session.id, status: session.status };
    return updated;
  });
}

async function overrideWeight(eventId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.findUnique({
      where: { id: eventId },
      include: { gross_ticket: true, tare_ticket: true, assets: true },
    });
    if (!event) throw new Error('Weighing event not found');

    const ticketField = data.weight_type === 'GROSS' ? 'gross_ticket' : 'tare_ticket';
    const ticket = event[ticketField];
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

    // Update PfisterTicket with override fields
    await tx.pfisterTicket.update({
      where: { id: ticket.id },
      data: {
        weight_kg: weightKg,
        is_manual_override: true,
        override_reason: data.reason_code || null,
        override_by: userId,
      },
    });

    // Recompute event weights
    const updateData = {};
    if (data.weight_type === 'GROSS') {
      updateData.gross_weight_kg = weightKg;
      if (event.tare_weight_kg) {
        updateData.net_weight_kg = weightKg - Number(event.tare_weight_kg);
      }
    } else {
      updateData.tare_weight_kg = weightKg;
      if (event.gross_weight_kg) {
        updateData.net_weight_kg = Number(event.gross_weight_kg) - weightKg;
      }
    }

    const updated = await tx.weighingEvent.update({
      where: { id: eventId },
      data: updateData,
      include: EVENT_INCLUDE,
    });

    // Redistribute net weight to assets if both weights exist
    if (updated.net_weight_kg && event.assets.length > 0) {
      const netWeightKg = Number(updated.net_weight_kg);
      const grossWeightKg = Number(updated.gross_weight_kg);
      const tareWeightKg = Number(updated.tare_weight_kg);
      const totalVolume = event.assets.reduce((sum, a) => sum + (Number(a.estimated_volume_m3) || 0), 0);
      const useVolume = totalVolume > 0;

      let distributed = 0;
      for (let i = 0; i < event.assets.length; i++) {
        let assetNet;
        if (i === event.assets.length - 1) {
          assetNet = Math.round((netWeightKg - distributed) * 100) / 100;
        } else if (useVolume) {
          const proportion = (Number(event.assets[i].estimated_volume_m3) || 0) / totalVolume;
          assetNet = Math.round(netWeightKg * proportion * 100) / 100;
        } else {
          assetNet = Math.round((netWeightKg / event.assets.length) * 100) / 100;
        }
        distributed += assetNet;

        const proportion = netWeightKg > 0 ? assetNet / netWeightKg : 1 / event.assets.length;
        await tx.asset.update({
          where: { id: event.assets[i].id },
          data: {
            net_weight_kg: assetNet,
            gross_weight_kg: Math.round(grossWeightKg * proportion * 100) / 100,
            tare_weight_kg: Math.round(tareWeightKg * proportion * 100) / 100,
          },
        });
      }
    }

    await writeAuditLog({
      userId,
      action: 'WEIGHT_OVERRIDE',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { weight_type: data.weight_type, weight_kg: beforeWeight },
      after: { weight_type: data.weight_type, weight_kg: data.weight_kg, reason_code: data.reason_code, notes: data.notes },
    }, tx);

    updated.can_add_skips = !['CONFIRMED'].includes(updated.status);
    return updated;
  });
}

async function manualWeighing(eventId, data, userId) {
  const weightKg = parseFloat(data.weight_kg);
  if (isNaN(weightKg) || weightKg <= 0) {
    const err = new Error('weight_kg must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Weighing event not found');

    const isGross = data.weight_type === 'GROSS';
    const expectedStatus = isGross ? 'PENDING_GROSS' : 'PENDING_TARE';

    if (event.status !== expectedStatus) {
      const err = new Error(`Cannot manually enter ${data.weight_type} weight from status ${event.status}`);
      err.statusCode = 409;
      throw err;
    }

    // Create a PfisterTicket with is_manual_override = true
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
      updateData.status = 'GROSS_COMPLETE';
    } else {
      updateData.tare_ticket_id = ticket.id;
      updateData.tare_weight_kg = weightKg;
      updateData.net_weight_kg = Number(event.gross_weight_kg) - weightKg;
      updateData.status = 'TARE_COMPLETE';

      // Distribute net weight if tare
      const assets = await tx.asset.findMany({
        where: { weighing_event_id: eventId },
        orderBy: { created_at: 'asc' },
      });
      const netWeightKg = Number(event.gross_weight_kg) - weightKg;
      const grossWeightKg = Number(event.gross_weight_kg);
      const totalVolume = assets.reduce((sum, a) => sum + (Number(a.estimated_volume_m3) || 0), 0);
      const useVolume = totalVolume > 0;
      let distributed = 0;

      for (let i = 0; i < assets.length; i++) {
        let assetNet;
        if (i === assets.length - 1) {
          assetNet = Math.round((netWeightKg - distributed) * 100) / 100;
        } else if (useVolume) {
          const proportion = (Number(assets[i].estimated_volume_m3) || 0) / totalVolume;
          assetNet = Math.round(netWeightKg * proportion * 100) / 100;
        } else {
          assetNet = Math.round((netWeightKg / assets.length) * 100) / 100;
        }
        distributed += assetNet;
        const proportion = netWeightKg > 0 ? assetNet / netWeightKg : 1 / assets.length;
        await tx.asset.update({
          where: { id: assets[i].id },
          data: {
            net_weight_kg: assetNet,
            gross_weight_kg: Math.round(grossWeightKg * proportion * 100) / 100,
            tare_weight_kg: Math.round(weightKg * proportion * 100) / 100,
          },
        });
      }
    }

    const updated = await tx.weighingEvent.update({
      where: { id: eventId },
      data: updateData,
      include: EVENT_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: isGross ? 'GROSS_WEIGHING' : 'TARE_WEIGHING',
      entityType: 'WeighingEvent',
      entityId: eventId,
      before: { status: event.status },
      after: { status: updated.status, weight_kg: weightKg, manual: true },
    }, tx);

    updated.can_add_skips = !['CONFIRMED'].includes(updated.status);
    return updated;
  });
}

async function lookupAsset(assetLabel) {
  return prisma.asset.findUnique({
    where: { asset_label: assetLabel },
    include: {
      weighing_event: {
        select: { id: true, order_id: true, status: true },
      },
      material_category: {
        select: { id: true, code_cbs: true, description_en: true },
      },
    },
  });
}

module.exports = {
  getWeighingEvent,
  listWeighingEvents,
  createWeighingEvent,
  triggerGrossWeighing,
  triggerTareWeighing,
  advanceToTare,
  confirmWeighingEvent,
  overrideWeight,
  manualWeighing,
  lookupAsset,
};
