const prisma = require('../utils/prismaClient');
const { canTransition, getAllowedTransitions } = require('../utils/inboundStateMachine');
const { canTransition: canOrderTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');
const { requestWeighing } = require('./pfisterSimulator');
const { generateInboundNumber } = require('../utils/inboundNumber');
const { generateAssetLabel } = require('../utils/assetLabel');
const { notifyRoles } = require('./notificationService');

const TERMINAL_STATUSES = ['READY_FOR_SORTING', 'SORTED'];

const INBOUND_INCLUDE = {
  order: {
    include: {
      carrier: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, supplier_type: true } },
      waste_stream: { select: { id: true, name_en: true, code: true } },
      waste_streams: {
        include: {
          waste_stream: { select: { id: true, name_en: true, code: true } },
        },
      },
    },
  },
  vehicle: true,
  waste_stream: { select: { id: true, name_en: true, code: true } },
  gross_ticket: true,
  tare_ticket: true,
  assets: {
    include: {
      waste_stream: { select: { id: true, name_en: true, code: true } },
      material_category: { select: { id: true, code_cbs: true, description_en: true } },
    },
    orderBy: { sequence: 'asc' },
  },
  weighings: {
    include: {
      pfister_ticket: true,
    },
    orderBy: { sequence: 'asc' },
  },
  confirmed_by_user: { select: { id: true, full_name: true } },
  sorting_session: { select: { id: true, status: true } },
};

function enrichInbound(inbound) {
  const weighings = inbound.weighings || [];
  const assets = inbound.assets || [];

  inbound.can_add_parcels = !TERMINAL_STATUSES.includes(inbound.status);
  inbound.allowed_transitions = getAllowedTransitions(inbound.status);

  // Sequential weighing computed states
  inbound.weighing_count = weighings.length;
  inbound.parcel_count = assets.length;

  // Can trigger first weighing (gross)
  inbound.can_weigh_first = inbound.status === 'ARRIVED' && weighings.length === 0;

  // Can register a parcel (gap exists: last weighing has no corresponding parcel)
  inbound.can_register_parcel = inbound.status === 'WEIGHED_IN' && weighings.length > assets.length;

  // Can trigger next weighing (parcel registered since last weighing, counts are equal, at least 1 parcel)
  inbound.can_weigh_next = inbound.status === 'WEIGHED_IN' && weighings.length === assets.length && assets.length >= 1;

  // Can trigger tare (same as can_weigh_next)
  inbound.can_weigh_tare = inbound.can_weigh_next;

  // Current phase
  if (inbound.status === 'ARRIVED') {
    inbound.current_phase = 'awaiting_first_weighing';
  } else if (inbound.can_register_parcel) {
    inbound.current_phase = 'awaiting_parcel';
  } else if (inbound.can_weigh_next) {
    inbound.current_phase = 'awaiting_next_weighing';
  } else if (['WEIGHED_OUT', 'READY_FOR_SORTING', 'SORTED'].includes(inbound.status)) {
    inbound.current_phase = 'weighing_complete';
  } else {
    inbound.current_phase = 'unknown';
  }

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
        incident_category: data.incident_category || null,
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

/**
 * Unified sequential weighing function.
 * Handles first weighing (gross), intermediate weighings, and final weighing (tare).
 */
async function triggerNextWeighing(inboundId, options, userId) {
  const { is_tare = false, is_manual = false, manual_weight_kg, manual_reason } = options || {};

  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: {
        assets: { orderBy: { sequence: 'asc' } },
        weighings: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!inbound) throw new Error('Inbound not found');

    const weighings = inbound.weighings;
    const assets = inbound.assets;
    const nextSeq = weighings.length + 1;

    // Validation
    if (nextSeq === 1) {
      // First weighing (gross): status must be ARRIVED
      if (inbound.status !== 'ARRIVED') {
        const err = new Error('Inbound must be in ARRIVED status for first weighing');
        err.statusCode = 409;
        throw err;
      }
    } else {
      // Subsequent weighings: a parcel must have been registered since last weighing
      // 1:1 rule: assets.length must equal weighings.length (one parcel per gap)
      if (assets.length !== weighings.length) {
        const err = new Error('A parcel must be registered before the next weighing');
        err.statusCode = 400;
        throw err;
      }
      if (is_tare && assets.length === 0) {
        const err = new Error('At least one parcel must be registered before tare weighing');
        err.statusCode = 400;
        throw err;
      }
    }

    // Determine weighing type and get/create ticket
    let ticket;
    const previousWeight = weighings.length > 0 ? Number(weighings[weighings.length - 1].weight_kg) : null;

    if (is_manual) {
      const weightKg = parseFloat(manual_weight_kg);
      if (isNaN(weightKg) || weightKg <= 0) {
        const err = new Error('weight_kg must be a positive number');
        err.statusCode = 400;
        throw err;
      }
      const weighingType = nextSeq === 1 ? 'GROSS' : is_tare ? 'TARE' : 'INTERMEDIATE';
      ticket = await tx.pfisterTicket.create({
        data: {
          ticket_number: `MAN-${Date.now()}`,
          weighing_type: weighingType,
          weight_kg: weightKg,
          unit: 'kg',
          timestamp: new Date(),
          raw_payload: JSON.stringify({ manual_entry: true, reason: manual_reason || 'Pfister unavailable' }),
          is_manual_override: true,
          override_reason: manual_reason || 'Pfister unavailable',
          override_by: userId,
        },
      });

      // PFI-07: Alert admins on manual weight entry
      if (is_manual) {
        await notifyRoles(tx, ['ADMIN'], {
          type: 'MANUAL_WEIGHING_ALERT',
          title: 'Manual weight entry recorded',
          message: `Manual weight ${manual_weight_kg} kg for inbound ${inbound.inbound_number}, reason: ${manual_reason}`,
          entityType: 'Inbound',
          entityId: inboundId,
        });
      }
    } else {
      if (nextSeq === 1) {
        ticket = await requestWeighing('GROSS');
      } else if (is_tare) {
        ticket = await requestWeighing('TARE', previousWeight);
      } else {
        ticket = await requestWeighing('INTERMEDIATE', previousWeight);
      }
    }

    // Create InboundWeighing record
    await tx.inboundWeighing.create({
      data: {
        inbound_id: inboundId,
        sequence: nextSeq,
        pfister_ticket_id: ticket.id,
        weight_kg: ticket.weight_kg,
        is_tare: is_tare,
      },
    });

    // Update inbound fields
    const updateData = {};

    if (nextSeq === 1) {
      // First weighing = gross
      updateData.gross_ticket_id = ticket.id;
      updateData.gross_weight_kg = ticket.weight_kg;
      if (inbound.status === 'ARRIVED' && canTransition('ARRIVED', 'WEIGHED_IN')) {
        updateData.status = 'WEIGHED_IN';
      }
    }

    if (nextSeq > 1) {
      // Calculate net weight for the previous parcel
      const prevParcel = assets[nextSeq - 2]; // parcel at index (seq-2)
      if (prevParcel) {
        const prevWeighingWeight = Number(weighings[nextSeq - 2].weight_kg);
        const currentWeight = Number(ticket.weight_kg);
        const parcelNet = Math.round((prevWeighingWeight - currentWeight) * 100) / 100;

        await tx.asset.update({
          where: { id: prevParcel.id },
          data: { net_weight_kg: parcelNet },
        });
      }
    }

    if (is_tare) {
      updateData.tare_ticket_id = ticket.id;
      updateData.tare_weight_kg = ticket.weight_kg;
      updateData.net_weight_kg = Number(inbound.gross_weight_kg || updateData.gross_weight_kg || 0) - Number(ticket.weight_kg);
      if (canTransition(inbound.status, 'WEIGHED_OUT')) {
        updateData.status = 'WEIGHED_OUT';
      }
    }

    const updated = await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
      include: INBOUND_INCLUDE,
    });

    // Audit log
    const weighingLabel = nextSeq === 1 ? 'FIRST_WEIGHING' : is_tare ? 'TARE_WEIGHING' : `WEIGHING_${nextSeq}`;
    await writeAuditLog({
      userId,
      action: weighingLabel,
      entityType: 'Inbound',
      entityId: inboundId,
      after: {
        sequence: nextSeq,
        weight_kg: Number(ticket.weight_kg),
        ticket_number: ticket.ticket_number,
        is_tare,
        is_manual,
        status: updated.status,
      },
    }, tx);

    // Order transitions
    if (nextSeq === 1 && updated.status === 'WEIGHED_IN') {
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

/**
 * Register a parcel (container or material) after unloading from the vehicle.
 */
async function registerParcel(inboundId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: {
        order: {
          include: {
            waste_streams: { select: { waste_stream_id: true } },
          },
        },
        assets: { orderBy: { sequence: 'asc' } },
        weighings: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!inbound) throw new Error('Inbound not found');

    if (inbound.status !== 'WEIGHED_IN') {
      const err = new Error('Inbound must be in WEIGHED_IN status to register parcels');
      err.statusCode = 409;
      throw err;
    }

    // 1:1 rule: can only register if weighings > assets (gap exists)
    if (inbound.weighings.length <= inbound.assets.length) {
      const err = new Error('A weighing must be taken before registering another parcel');
      err.statusCode = 400;
      throw err;
    }

    // Validate waste stream is in order's waste streams
    const orderWsIds = inbound.order.waste_streams.map((ws) => ws.waste_stream_id);
    if (data.waste_stream_id && !orderWsIds.includes(data.waste_stream_id)) {
      const err = new Error('Waste stream must be one of the order\'s assigned waste streams');
      err.statusCode = 400;
      throw err;
    }

    // Validate parcel type fields
    if (data.parcel_type === 'CONTAINER' && !data.container_type) {
      const err = new Error('Container type is required for CONTAINER parcels');
      err.statusCode = 400;
      throw err;
    }

    // LZV enforcement (SKP-01)
    const currentParcelCount = await tx.asset.count({ where: { inbound_id: inboundId } });
    const maxParcels = inbound.order.is_lzv ? 3 : 2;
    if (currentParcelCount >= maxParcels) {
      const err = new Error(`Maximum ${maxParcels} parcels allowed for this vehicle${inbound.order.is_lzv ? ' (LZV)' : ''}. Currently ${currentParcelCount} registered.`);
      err.statusCode = 400;
      throw err;
    }

    const sequence = inbound.weighings.length;
    let assetLabel;
    let existingAsset = null;

    // Check for existing container reuse
    if (data.existing_asset_label) {
      existingAsset = await tx.asset.findUnique({
        where: { asset_label: data.existing_asset_label },
      });
      if (!existingAsset) {
        const err = new Error(`Container with label ${data.existing_asset_label} not found`);
        err.statusCode = 404;
        throw err;
      }
      assetLabel = data.existing_asset_label;
    } else {
      assetLabel = await generateAssetLabel(tx, data.parcel_type || 'CONTAINER');
    }

    // Auto-fill waste stream from order if only one
    const wasteStreamId = data.waste_stream_id || (orderWsIds.length === 1 ? orderWsIds[0] : null);

    const asset = await tx.asset.create({
      data: {
        asset_label: assetLabel,
        inbound_id: inboundId,
        parcel_type: data.parcel_type || 'CONTAINER',
        container_type: data.parcel_type === 'CONTAINER' ? data.container_type : null,
        material_category_id: data.material_category_id || null,
        waste_stream_id: wasteStreamId,
        sequence,
        estimated_volume_m3: data.estimated_volume_m3 ? parseFloat(data.estimated_volume_m3) : null,
        notes: data.notes || null,
      },
      include: {
        waste_stream: { select: { id: true, name_en: true, code: true } },
        material_category: { select: { id: true, code_cbs: true, description_en: true } },
      },
    });

    await writeAuditLog({
      userId,
      action: 'REGISTER_PARCEL',
      entityType: 'Asset',
      entityId: asset.id,
      after: {
        asset_label: asset.asset_label,
        parcel_type: asset.parcel_type,
        container_type: asset.container_type,
        sequence: asset.sequence,
        inbound_id: inboundId,
      },
    }, tx);

    return asset;
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
        const err = new Error('At least one parcel is required');
        err.statusCode = 400;
        throw err;
      }

      const incompleteParcels = inbound.assets.filter((a) => a.net_weight_kg == null);
      if (incompleteParcels.length > 0) {
        const err = new Error(`${incompleteParcels.length} parcel(s) missing net weight`);
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

    // Auto-complete order when total parcels across confirmed inbounds >= expected_skip_count
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
        const totalParcels = confirmedInbounds.reduce((sum, ib) => sum + ib.assets.length, 0);
        if (totalParcels >= order.expected_skip_count) {
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
            after: { status: 'COMPLETED', reason: `All expected parcels confirmed (${totalParcels}/${order.expected_skip_count})` },
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

async function overrideWeight(inboundId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: {
        weighings: { orderBy: { sequence: 'asc' }, include: { pfister_ticket: true } },
        assets: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!inbound) throw new Error('Inbound not found');

    const weighingSeq = parseInt(data.sequence, 10);
    const targetWeighing = inbound.weighings.find((w) => w.sequence === weighingSeq);
    if (!targetWeighing) {
      const err = new Error(`Weighing with sequence ${weighingSeq} not found`);
      err.statusCode = 404;
      throw err;
    }

    const weightKg = parseFloat(data.weight_kg);
    if (isNaN(weightKg) || weightKg <= 0) {
      const err = new Error('weight_kg must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    const beforeWeight = Number(targetWeighing.weight_kg);

    // PFI-08: If ticket is confirmed, create a versioned amendment instead of in-place edit
    if (targetWeighing.pfister_ticket.is_confirmed) {
      await tx.weightAmendment.create({
        data: {
          pfister_ticket_id: targetWeighing.pfister_ticket_id,
          original_weight_kg: targetWeighing.pfister_ticket.weight_kg,
          amended_weight_kg: data.new_weight_kg,
          reason: data.reason_code || 'OTHER',
          reason_notes: data.reason_notes || null,
          amended_by: userId,
        },
      });
    }

    // Update the PfisterTicket
    await tx.pfisterTicket.update({
      where: { id: targetWeighing.pfister_ticket_id },
      data: {
        weight_kg: weightKg,
        is_manual_override: true,
        override_reason: data.reason_code || null,
        override_by: userId,
      },
    });

    // Update the InboundWeighing
    await tx.inboundWeighing.update({
      where: { id: targetWeighing.id },
      data: { weight_kg: weightKg },
    });

    // Recalculate affected parcel net weights
    const allWeighings = inbound.weighings.map((w) =>
      w.sequence === weighingSeq ? { ...w, weight_kg: weightKg } : w
    );

    for (let i = 0; i < inbound.assets.length; i++) {
      const asset = inbound.assets[i];
      const wBefore = allWeighings.find((w) => w.sequence === i + 1);
      const wAfter = allWeighings.find((w) => w.sequence === i + 2);
      if (wBefore && wAfter) {
        const net = Math.round((Number(wBefore.weight_kg) - Number(wAfter.weight_kg)) * 100) / 100;
        await tx.asset.update({
          where: { id: asset.id },
          data: { net_weight_kg: net },
        });
      }
    }

    // Update inbound summary fields
    const updateData = {};
    const firstWeighing = allWeighings.find((w) => w.sequence === 1);
    const tareWeighing = allWeighings.find((w) => w.is_tare);
    if (firstWeighing) updateData.gross_weight_kg = Number(firstWeighing.weight_kg);
    if (tareWeighing) {
      updateData.tare_weight_kg = Number(tareWeighing.weight_kg);
      if (firstWeighing) {
        updateData.net_weight_kg = Number(firstWeighing.weight_kg) - Number(tareWeighing.weight_kg);
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
      before: { sequence: weighingSeq, weight_kg: beforeWeight },
      after: { sequence: weighingSeq, weight_kg: weightKg, reason_code: data.reason_code },
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
      material_category: {
        select: { id: true, code_cbs: true, description_en: true },
      },
    },
  });
}

async function setIncidentCategory(inboundId, category, notes, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: { order: true },
    });
    if (!inbound) {
      const err = new Error('Inbound not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await tx.inbound.update({
      where: { id: inboundId },
      data: {
        incident_category: category,
        notes: notes || inbound.notes,
      },
    });

    // DAMAGE or DISPUTE → notify logistics planner + finance manager
    if (category === 'DAMAGE' || category === 'DISPUTE') {
      await notifyRoles(tx, ['LOGISTICS_PLANNER', 'FINANCE_MANAGER'], {
        type: 'INCIDENT_ALERT',
        title: `Incident: ${category} on inbound ${inbound.inbound_number}`,
        message: notes || `${category} incident on inbound ${inbound.inbound_number}`,
        entityType: 'Inbound',
        entityId: inboundId,
      });
    }

    await writeAuditLog({
      userId,
      action: 'SET_INCIDENT',
      entityType: 'Inbound',
      entityId: inboundId,
      before: { incident_category: inbound.incident_category, notes: inbound.notes },
      after: { incident_category: category, notes: notes || inbound.notes },
    }, tx);

    return updated;
  });
}

async function confirmWeighingTicket(inboundId, sequence, userId) {
  return prisma.$transaction(async (tx) => {
    const weighing = await tx.inboundWeighing.findUnique({
      where: { inbound_id_sequence: { inbound_id: inboundId, sequence: parseInt(sequence, 10) } },
      include: { pfister_ticket: true },
    });
    if (!weighing) {
      const err = new Error('Weighing not found');
      err.statusCode = 404;
      throw err;
    }
    if (weighing.pfister_ticket.is_confirmed) {
      const err = new Error('Weighing already confirmed');
      err.statusCode = 400;
      throw err;
    }

    await tx.pfisterTicket.update({
      where: { id: weighing.pfister_ticket_id },
      data: {
        is_confirmed: true,
        confirmed_by: userId,
        confirmed_at: new Date(),
      },
    });

    await writeAuditLog({
      userId,
      action: 'CONFIRM_WEIGHING',
      entityType: 'PfisterTicket',
      entityId: weighing.pfister_ticket_id,
      before: { is_confirmed: false },
      after: { is_confirmed: true, confirmed_by: userId },
    }, tx);

    return { confirmed: true, sequence: weighing.sequence };
  });
}

async function getWeighingAmendments(inboundId, sequence) {
  const weighing = await prisma.inboundWeighing.findUnique({
    where: { inbound_id_sequence: { inbound_id: inboundId, sequence: parseInt(sequence, 10) } },
  });
  if (!weighing) {
    const err = new Error('Weighing not found');
    err.statusCode = 404;
    throw err;
  }

  return prisma.weightAmendment.findMany({
    where: { pfister_ticket_id: weighing.pfister_ticket_id },
    include: { amended_by_user: { select: { id: true, full_name: true, role: true } } },
    orderBy: { created_at: 'desc' },
  });
}

module.exports = {
  getInbound,
  listInbounds,
  listInboundsByOrder,
  createInbound,
  updateInboundStatus,
  setInboundWasteStream,
  triggerNextWeighing,
  registerParcel,
  overrideWeight,
  lookupAsset,
  setIncidentCategory,
  confirmWeighingTicket,
  getWeighingAmendments,
};
