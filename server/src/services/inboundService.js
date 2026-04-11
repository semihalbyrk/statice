const prisma = require('../utils/prismaClient');
const { canTransition, getAllowedTransitions } = require('../utils/inboundStateMachine');
const { canTransition: canOrderTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');
const { requestPfisterWeighing } = require('./pfisterGateway');
const { ALLOWED_DEVICES } = require('./pfisterSimulator');
const { generateInboundNumber } = require('../utils/inboundNumber');
const { generateAssetLabel, generateContainerLabel, CONTAINER_TARE_WEIGHTS } = require('../utils/assetLabel');
const { notifyRoles } = require('./notificationService');
const { findActiveContractForSupplier } = require('./contractService');

const TERMINAL_STATUSES = ['READY_FOR_SORTING', 'SORTED'];

const INBOUND_INCLUDE = {
  order: {
    include: {
      carrier: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, supplier_type: true } },
      waste_stream: { select: { id: true, name: true, code: true } },
      waste_streams: {
        include: {
          waste_stream: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
  vehicle: true,
  waste_stream: { select: { id: true, name: true, code: true } },
  gross_ticket: true,
  tare_ticket: true,
  assets: {
    include: {
      waste_stream: { select: { id: true, name: true, code: true } },
      material_category: { select: { id: true, code_cbs: true, description_en: true } },
      gross_weighing: { select: { id: true, sequence: true, weight_kg: true } },
      tare_weighing: { select: { id: true, sequence: true, weight_kg: true } },
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

function roundWeight(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function refreshOrderReceiptCounts(tx, orderId) {
  const total = await tx.asset.count({
    where: {
      inbound: {
        order_id: orderId,
      },
    },
  });

  return tx.inboundOrder.update({
    where: { id: orderId },
    data: { received_asset_count: total },
  });
}

async function recalculateInboundWeights(tx, inboundId) {
  const inbound = await tx.inbound.findUnique({
    where: { id: inboundId },
    include: {
      weighings: {
        include: { pfister_ticket: true },
        orderBy: { sequence: 'asc' },
      },
      assets: { orderBy: { sequence: 'asc' } },
    },
  });

  if (!inbound) return null;

  const mode = inbound.weighing_mode;
  const w1 = inbound.weighings.find((w) => w.sequence === 1);
  const w2 = inbound.weighings.find((w) => w.sequence === 2);

  for (const asset of inbound.assets) {
    let assetUpdate;

    if (mode && w1 && w2) {
      // New 1:1 mode (SWAP / DIRECT / BULK)
      const diff = roundWeight(Number(w1.weight_kg) - Number(w2.weight_kg));

      if (mode === 'DIRECT' && asset.estimated_tare_weight_kg) {
        // Known container: diff = container + cargo, net = diff - known tare
        assetUpdate = {
          gross_weighing_id: w1.id,
          tare_weighing_id: w2.id,
          gross_weight_kg: diff,
          tare_weight_kg: Number(asset.estimated_tare_weight_kg),
          net_weight_kg: roundWeight(diff - Number(asset.estimated_tare_weight_kg)),
        };
      } else {
        // SWAP or BULK: W1-W2 = net
        assetUpdate = {
          gross_weighing_id: w1.id,
          tare_weighing_id: w2.id,
          gross_weight_kg: Number(w1.weight_kg),
          tare_weight_kg: Number(w2.weight_kg),
          net_weight_kg: diff,
        };
      }
    } else {
      // Legacy interleaved mode (no weighing_mode set)
      const grossWeighing = inbound.weighings.find((w) => w.sequence === asset.sequence);
      const tareWeighing = inbound.weighings.find((w) => w.sequence === (asset.sequence || 0) + 1);
      assetUpdate = {
        gross_weighing_id: grossWeighing?.id || null,
        gross_weight_kg: grossWeighing ? Number(grossWeighing.weight_kg) : null,
        tare_weighing_id: tareWeighing?.id || null,
        tare_weight_kg: tareWeighing ? Number(tareWeighing.weight_kg) : null,
        net_weight_kg: grossWeighing && tareWeighing
          ? roundWeight(Number(grossWeighing.weight_kg) - Number(tareWeighing.weight_kg))
          : null,
      };
    }

    await tx.asset.update({ where: { id: asset.id }, data: assetUpdate });
  }

  // Inbound totals
  const firstWeighing = inbound.weighings[0];
  const tareWeighing = inbound.weighings.find((w) => w.is_tare) || null;

  const inboundUpdate = {
    gross_weight_kg: firstWeighing ? Number(firstWeighing.weight_kg) : null,
    tare_weight_kg: tareWeighing ? Number(tareWeighing.weight_kg) : null,
  };

  if (mode) {
    // New mode: sum asset nets after update
    const updatedAssets = await tx.asset.findMany({ where: { inbound_id: inboundId } });
    const totalNet = updatedAssets.reduce((sum, a) => sum + (a.net_weight_kg ? Number(a.net_weight_kg) : 0), 0);
    inboundUpdate.net_weight_kg = totalNet > 0 ? roundWeight(totalNet) : null;
  } else {
    // Legacy: first weighing minus tare weighing
    inboundUpdate.net_weight_kg = firstWeighing && tareWeighing
      ? roundWeight(Number(firstWeighing.weight_kg) - Number(tareWeighing.weight_kg))
      : null;
  }

  await tx.inbound.update({
    where: { id: inboundId },
    data: inboundUpdate,
  });

  return tx.inbound.findUnique({
    where: { id: inboundId },
    include: INBOUND_INCLUDE,
  });
}

function enrichOrderCounters(order) {
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

function enrichInbound(inbound) {
  if (!inbound) return inbound;

  const weighings = inbound.weighings || [];
  const assets = inbound.assets || [];
  const order = enrichOrderCounters(inbound.order);

  inbound.order = order;
  inbound.can_add_parcels = !TERMINAL_STATUSES.includes(inbound.status);
  inbound.allowed_transitions = getAllowedTransitions(inbound.status);

  // Sequential weighing computed states
  inbound.weighing_count = weighings.length;
  inbound.parcel_count = assets.length;
  inbound.receipt_asset_count = assets.length;
  inbound.expected_asset_count = order?.expected_asset_count ?? order?.expected_skip_count ?? 0;
  inbound.remaining_asset_count = Math.max((inbound.expected_asset_count || 0) - assets.length, 0);

  // Can trigger first weighing (gross)
  inbound.can_weigh_first = inbound.status === 'ARRIVED' && weighings.length === 0;

  // Max parcels per vehicle type (LZV = 3, normal = 2)
  const maxParcels = inbound.order?.is_lzv ? 3 : 2;
  inbound.max_parcels = maxParcels;
  inbound.at_max_parcels = assets.length >= maxParcels;

  // Can register a parcel (gap exists AND not at max capacity)
  inbound.can_register_parcel = inbound.status === 'WEIGHED_IN' && weighings.length > assets.length && assets.length < maxParcels;

  // Excess weighing: extra weighing exists but can't register more parcels (stuck state recovery)
  inbound.has_excess_weighing = inbound.status === 'WEIGHED_IN' && weighings.length > assets.length && assets.length >= maxParcels;

  // Can trigger next weighing (parcel registered since last weighing, counts are equal, at least 1 parcel)
  inbound.can_weigh_next = inbound.status === 'WEIGHED_IN' && weighings.length === assets.length && assets.length >= 1;

  // Can trigger tare (same as can_weigh_next, OR has excess weighing that needs recovery)
  inbound.can_weigh_tare = inbound.can_weigh_next || inbound.has_excess_weighing;

  // Current phase
  if (inbound.status === 'ARRIVED') {
    inbound.current_phase = 'awaiting_first_weighing';
  } else if (inbound.can_register_parcel) {
    inbound.current_phase = 'awaiting_parcel';
  } else if (inbound.has_excess_weighing) {
    inbound.current_phase = 'excess_weighing_recovery';
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

  const enriched = enrichInbound(inbound);

  let linkedContract = null;
  try {
    linkedContract = await findActiveContractForSupplier(
      inbound.order?.supplier_id,
      inbound.order?.planned_date || inbound.created_at,
    );
  } catch {
    // No match found — that's OK
  }
  enriched.linked_contract = linkedContract;

  return enriched;
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

  return { data: inbounds.map(enrichInbound), total, page: pageNum, limit: limitNum };
}

async function listInboundsByOrder(orderId) {
  const inbounds = await prisma.inbound.findMany({
    where: { order_id: orderId },
    include: INBOUND_INCLUDE,
    orderBy: { arrived_at: 'desc' },
  });
  return inbounds.map(enrichInbound);
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
        match_strategy: data.match_strategy || null,
        matched_by: data.match_strategy ? userId : null,
        matched_at: data.match_strategy ? new Date() : null,
        is_manual_match: Boolean(data.is_manual_match),
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
  let { is_tare = false, is_manual = false, manual_weight_kg, manual_reason, device_id } = options || {};

  // ── Phase 1: Read & validate (no transaction — just a query) ──────────────
  const inboundForValidation = await prisma.inbound.findUnique({
    where: { id: inboundId },
    include: {
      order: { select: { is_lzv: true, id: true, status: true } },
      assets: { orderBy: { sequence: 'asc' } },
      weighings: { orderBy: { sequence: 'asc' } },
    },
  });
  if (!inboundForValidation) throw new Error('Inbound not found');

  const weighings = inboundForValidation.weighings;
  const assets = inboundForValidation.assets;
  const nextSeq = weighings.length + 1;

  // New 1:1 mode: max 2 weighings
  if (inboundForValidation.weighing_mode && nextSeq > 2) {
    throw Object.assign(new Error('Maximum 2 weighings per inbound in 1:1 mode'), { statusCode: 400 });
  }

  // New 1:1 mode: W2 is always tare
  if (inboundForValidation.weighing_mode && nextSeq === 2) {
    is_tare = true;
  }

  // Validation
  if (nextSeq === 1) {
    if (inboundForValidation.status !== 'ARRIVED') {
      const err = new Error('Inbound must be in ARRIVED status for first weighing');
      err.statusCode = 409;
      throw err;
    }
  } else {
    const maxParcels = inboundForValidation.order?.is_lzv ? 3 : 2;
    const hasExcessWeighing = weighings.length > assets.length && assets.length >= maxParcels;
    if (assets.length !== weighings.length && !(is_tare && hasExcessWeighing)) {
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

  const previousWeight = weighings.length > 0 ? Number(weighings[weighings.length - 1].weight_kg) : null;

  // Server-side device allowlist validation
  const resolvedDeviceId = inboundForValidation.device_id || device_id || process.env.PFISTER_DEFAULT_DEVICE;
  if (!is_manual) {
    if (!resolvedDeviceId) {
      const err = new Error('Device ID is required for weighing');
      err.statusCode = 400;
      throw err;
    }
    if (!ALLOWED_DEVICES.includes(resolvedDeviceId)) {
      const err = new Error(`Invalid device ID: "${resolvedDeviceId}". Allowed: ${ALLOWED_DEVICES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
  }

  // ── Phase 2: Pfister HTTP call — OUTSIDE any transaction ─────────────────
  // External network I/O must not hold a DB connection open.
  let automaticTicket = null;
  if (!is_manual) {
    const weighingType = nextSeq === 1 ? 'GROSS' : is_tare ? 'TARE' : 'INTERMEDIATE';
    const pfisterContext = {
      inboundId,
      sequence: nextSeq,
      deviceId: resolvedDeviceId,
      inboundNumber: inboundForValidation.inbound_number,
    };
    automaticTicket = await requestPfisterWeighing(weighingType, previousWeight, pfisterContext);
  }

  // ── Phase 3: Write transaction — DB writes only, no network I/O ──────────
  return prisma.$transaction(async (tx) => {
    // Re-fetch for up-to-date inbound state inside the write lock
    const inbound = await tx.inbound.findUnique({
      where: { id: inboundId },
      include: {
        order: { select: { is_lzv: true, id: true, status: true } },
        assets: { orderBy: { sequence: 'asc' } },
        weighings: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!inbound) throw new Error('Inbound not found');

    // Determine weighing type and get/create ticket
    let ticket;

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
      await tx.pfisterIngressLog.create({
        data: {
          source: 'MANUAL_FALLBACK',
          protocol: 'MANUAL',
          payload: JSON.stringify({
            inbound_id: inboundId,
            sequence: nextSeq,
            weighing_type: weighingType,
            weight_kg: weightKg,
            reason: manual_reason || 'Pfister unavailable',
          }),
          status: 'MANUAL_ACCEPTED',
          processed_at: new Date(),
        },
      });

      // PFI-07: Alert admins on manual weight entry
      await notifyRoles(tx, ['ADMIN'], {
        type: 'MANUAL_WEIGHING_ALERT',
        title: 'Manual weight entry recorded',
        message: `Manual weight ${manual_weight_kg} kg for inbound ${inbound.inbound_number}, reason: ${manual_reason}`,
        entityType: 'Inbound',
        entityId: inboundId,
      });
    } else {
      // Ticket already created by Pfister HTTP call in Phase 2
      ticket = automaticTicket;
    }

    // Create InboundWeighing record
    const inboundWeighing = await tx.inboundWeighing.create({
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
      if (!is_manual) {
        updateData.device_id = resolvedDeviceId;
      }
      if (inbound.status === 'ARRIVED' && canTransition('ARRIVED', 'WEIGHED_IN')) {
        updateData.status = 'WEIGHED_IN';
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

    await tx.inbound.update({
      where: { id: inboundId },
      data: updateData,
    });

    let updated = await recalculateInboundWeights(tx, inboundId);
    if (!updated) {
      updated = await tx.inbound.findUnique({
        where: { id: inboundId },
        include: INBOUND_INCLUDE,
      });
    }

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
        inbound_weighing_id: inboundWeighing.id,
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

    // After inbound transitions to WEIGHED_OUT, check if order should go to IN_PROGRESS
    if (updateData.status === 'WEIGHED_OUT') {
      const order = await tx.inboundOrder.findUnique({
        where: { id: inbound.order_id },
        include: { inbounds: { select: { status: true } } },
      });
      if (order && order.status === 'ARRIVED' && canOrderTransition('ARRIVED', 'IN_PROGRESS')) {
        await tx.inboundOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' },
        });
        await writeAuditLog({
          userId,
          action: 'UPDATE',
          entityType: 'InboundOrder',
          entityId: order.id,
          before: { status: 'ARRIVED' },
          after: { status: 'IN_PROGRESS' },
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

    // Validate parcel type fields (container_registry_id also satisfies the requirement)
    if (data.parcel_type === 'CONTAINER' && !data.container_type && !data.existing_container_label && !data.container_registry_id) {
      const err = new Error('Container type is required for CONTAINER parcels');
      err.statusCode = 400;
      throw err;
    }

    // 1:1 mode enforcement: max 1 asset per inbound
    const currentParcelCount = await tx.asset.count({ where: { inbound_id: inboundId } });
    if (currentParcelCount >= 1) {
      throw Object.assign(new Error('Maximum 1 asset per inbound'), { statusCode: 400 });
    }

    // Determine and set weighing_mode
    let weighingMode;
    if (data.parcel_type === 'MATERIAL') {
      weighingMode = 'BULK';
    } else if (data.container_registry_id) {
      weighingMode = 'DIRECT';
      // Lookup registry container
      const registryContainer = await tx.containerRegistry.findUnique({
        where: { id: data.container_registry_id },
      });
      if (!registryContainer || !registryContainer.is_active) {
        throw Object.assign(new Error('Container not found or inactive'), { statusCode: 400 });
      }
      // Auto-populate fields from registry
      data.container_label = registryContainer.container_label;
      data.container_type = registryContainer.container_type;
      data.estimated_tare_weight_kg = Number(registryContainer.tare_weight_kg);
      if (registryContainer.volume_m3) {
        data.estimated_volume_m3 = Number(registryContainer.volume_m3);
      }
    } else {
      weighingMode = 'SWAP';
    }

    // Set weighing_mode on the inbound
    await tx.inbound.update({
      where: { id: inboundId },
      data: { weighing_mode: weighingMode },
    });

    const sequence = inbound.weighings.length;
    const assetLabel = await generateAssetLabel(tx);
    let containerLabel = null;
    let containerType = data.parcel_type === 'CONTAINER' ? data.container_type : null;
    let estimatedVolume = data.estimated_volume_m3 ? parseFloat(data.estimated_volume_m3) : null;
    let estimatedTare = data.estimated_tare_weight_kg != null ? parseFloat(data.estimated_tare_weight_kg) : null;

    // Existing container reuse — lookup by container_label
    if (data.existing_container_label) {
      const existingAsset = await tx.asset.findFirst({
        where: { container_label: data.existing_container_label },
        orderBy: { created_at: 'desc' },
      });
      if (!existingAsset) {
        const err = new Error(`Container with label ${data.existing_container_label} not found`);
        err.statusCode = 404;
        throw err;
      }
      containerLabel = existingAsset.container_label;
      containerType = existingAsset.container_type;
      estimatedVolume = estimatedVolume ?? (existingAsset.estimated_volume_m3 ? Number(existingAsset.estimated_volume_m3) : null);
      estimatedTare = estimatedTare ?? (existingAsset.estimated_tare_weight_kg ? Number(existingAsset.estimated_tare_weight_kg) : null);
    } else if (data.parcel_type === 'CONTAINER') {
      // New container — generate or use user-provided label
      containerLabel = data.container_label || await generateContainerLabel(tx);
      // Default tare weight from container type if not provided
      if (estimatedTare == null && containerType && CONTAINER_TARE_WEIGHTS[containerType] != null) {
        estimatedTare = CONTAINER_TARE_WEIGHTS[containerType];
      }
    }
    // MATERIAL (no container) — containerLabel stays null

    // Enforce container label uniqueness within inbound
    if (containerLabel) {
      const duplicate = await tx.asset.findFirst({
        where: { inbound_id: inboundId, container_label: containerLabel },
      });
      if (duplicate) {
        const err = new Error(`Container ${containerLabel} is already registered in this inbound`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Auto-fill waste stream from order if only one
    const wasteStreamId = data.waste_stream_id || (orderWsIds.length === 1 ? orderWsIds[0] : null);

    const asset = await tx.asset.create({
      data: {
        asset_label: assetLabel,
        inbound_id: inboundId,
        parcel_type: data.parcel_type || 'CONTAINER',
        container_type: containerType,
        container_label: containerLabel,
        estimated_tare_weight_kg: estimatedTare,
        material_category_id: data.material_category_id || null,
        waste_stream_id: wasteStreamId,
        sequence,
        estimated_volume_m3: estimatedVolume,
        gross_weighing_id: inbound.weighings[inbound.weighings.length - 1]?.id || null,
        gross_weight_kg: inbound.weighings[inbound.weighings.length - 1]
          ? Number(inbound.weighings[inbound.weighings.length - 1].weight_kg)
          : null,
        notes: data.notes || null,
      },
      include: {
        waste_stream: { select: { id: true, name: true, code: true } },
        material_category: { select: { id: true, code_cbs: true, description_en: true } },
        gross_weighing: { select: { id: true, sequence: true, weight_kg: true } },
        tare_weighing: { select: { id: true, sequence: true, weight_kg: true } },
      },
    });

    await refreshOrderReceiptCounts(tx, inbound.order_id);

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

    // After inbound reaches SORTED, check if all inbounds for the order are SORTED
    if (newStatus === 'SORTED') {
      const order = await tx.inboundOrder.findUnique({
        where: { id: inbound.order_id },
        include: { inbounds: { select: { status: true } } },
      });
      const allSorted = order.inbounds.every((ib) => ib.status === 'SORTED');
      if (allSorted && canOrderTransition(order.status, 'COMPLETED')) {
        await tx.inboundOrder.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });
        await writeAuditLog({
          userId,
          action: 'UPDATE',
          entityType: 'InboundOrder',
          entityId: order.id,
          before: { status: order.status },
          after: { status: 'COMPLETED' },
        }, tx);
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
    const reason = data.reason_code || 'OTHER';
    const reasonNotes = data.reason_notes || null;
    let replacementTicketId = targetWeighing.pfister_ticket_id;

    if (targetWeighing.pfister_ticket.is_confirmed) {
      const versionCount = await tx.weightAmendment.count({
        where: { pfister_ticket_id: targetWeighing.pfister_ticket_id },
      });

      const amendedTicket = await tx.pfisterTicket.create({
        data: {
          ticket_number: `${targetWeighing.pfister_ticket.ticket_number}-A${versionCount + 1}`,
          weighing_type: targetWeighing.pfister_ticket.weighing_type,
          weight_kg: weightKg,
          unit: targetWeighing.pfister_ticket.unit,
          timestamp: new Date(),
          raw_payload: JSON.stringify({
            amendment_of: targetWeighing.pfister_ticket.ticket_number,
            previous_ticket_id: targetWeighing.pfister_ticket.id,
            weight_kg: weightKg,
            reason,
            reason_notes: reasonNotes,
          }),
          is_manual_override: true,
          override_reason: reason,
          override_by: userId,
          is_confirmed: true,
          confirmed_by: userId,
          confirmed_at: new Date(),
        },
      });

      await tx.weightAmendment.create({
        data: {
          pfister_ticket_id: amendedTicket.id,
          original_weight_kg: targetWeighing.pfister_ticket.weight_kg,
          amended_weight_kg: weightKg,
          reason,
          reason_notes: reasonNotes,
          amended_by: userId,
        },
      });

      replacementTicketId = amendedTicket.id;

      await tx.inboundWeighing.update({
        where: { id: targetWeighing.id },
        data: {
          pfister_ticket_id: replacementTicketId,
          weight_kg: weightKg,
        },
      });

      if (inbound.gross_ticket_id === targetWeighing.pfister_ticket_id) {
        await tx.inbound.update({
          where: { id: inboundId },
          data: { gross_ticket_id: replacementTicketId },
        });
      }

      if (inbound.tare_ticket_id === targetWeighing.pfister_ticket_id) {
        await tx.inbound.update({
          where: { id: inboundId },
          data: { tare_ticket_id: replacementTicketId },
        });
      }
    } else {
      await tx.pfisterTicket.update({
        where: { id: targetWeighing.pfister_ticket_id },
        data: {
          weight_kg: weightKg,
          is_manual_override: true,
          override_reason: reason,
          override_by: userId,
        },
      });

      await tx.inboundWeighing.update({
        where: { id: targetWeighing.id },
        data: { weight_kg: weightKg },
      });

      await tx.weightAmendment.create({
        data: {
          pfister_ticket_id: targetWeighing.pfister_ticket_id,
          original_weight_kg: beforeWeight,
          amended_weight_kg: weightKg,
          reason,
          reason_notes: reasonNotes,
          amended_by: userId,
        },
      });
    }

    const updated = await recalculateInboundWeights(tx, inboundId);

    await writeAuditLog({
      userId,
      action: 'WEIGHT_OVERRIDE',
      entityType: 'Inbound',
      entityId: inboundId,
      before: { sequence: weighingSeq, weight_kg: beforeWeight, pfister_ticket_id: targetWeighing.pfister_ticket_id },
      after: { sequence: weighingSeq, weight_kg: weightKg, reason_code: reason, pfister_ticket_id: replacementTicketId },
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
        select: { id: true, name: true, code: true },
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
