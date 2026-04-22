const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { generateOutboundNumber } = require('../utils/outboundNumber');
const { validateTransition } = require('../utils/outboundStateMachine');
const { validateTransition: validateOrderTransition } = require('../utils/outboundOrderStateMachine');
const { requestPfisterWeighing } = require('./pfisterGateway');

// ---------------------------------------------------------------------------
// Shared includes
// ---------------------------------------------------------------------------

const OUTBOUND_LIST_INCLUDE = {
  outbound_order: {
    include: {
      buyer: true,
      contract: true,
    },
  },
};

const OUTBOUND_DETAIL_INCLUDE = {
  outbound_order: {
    include: {
      contract: true,
      buyer: true,
      sender: true,
      disposer: true,
      transporter: true,
      outsourced_transporter: true,
      waste_streams: {
        include: {
          waste_stream: true,
          receiver: true,
        },
      },
    },
  },
  weighing_records: {
    orderBy: { recorded_at: 'asc' },
  },
  documents: {
    orderBy: { generated_at: 'desc' },
  },
  lines: {
    include: { material: true },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(message = 'Outbound not found') {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

// ---------------------------------------------------------------------------
// listOutbounds
// ---------------------------------------------------------------------------

async function listOutbounds(query = {}) {
  const {
    outbound_order_id,
    status,
    search,
    page = 1,
    limit = 25,
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (outbound_order_id) {
    where.outbound_order_id = outbound_order_id;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.outbound_number = { contains: search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.outbound.findMany({
      where,
      include: OUTBOUND_LIST_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.outbound.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum };
}

// ---------------------------------------------------------------------------
// getOutbound
// ---------------------------------------------------------------------------

async function getOutbound(id) {
  const outbound = await prisma.outbound.findUnique({
    where: { id },
    include: OUTBOUND_DETAIL_INCLUDE,
  });

  if (!outbound) notFound();
  return outbound;
}

// ---------------------------------------------------------------------------
// createOutbound
// ---------------------------------------------------------------------------

async function createOutbound(orderId, data, userId) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate order exists and is in a valid status
    const order = await tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: { outbounds: { select: { id: true } } },
    });

    if (!order) {
      const err = new Error('Outbound order not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['PLANNED', 'IN_PROGRESS'].includes(order.status)) {
      badRequest(`Cannot create outbound for order in status ${order.status}`);
    }

    // 2. Check outbound count limit
    if (order.outbounds.length >= order.expected_outbounds) {
      badRequest(
        `Order already has ${order.outbounds.length}/${order.expected_outbounds} outbounds`
      );
    }

    // 3. Generate outbound number
    const outboundNumber = await generateOutboundNumber(tx);

    // 4. Create outbound
    const outbound = await tx.outbound.create({
      data: {
        outbound_number: outboundNumber,
        outbound_order_id: orderId,
        vehicle_plate: data.vehicle_plate || order.vehicle_plate || null,
        notes: data.notes || null,
        created_by: userId,
      },
      include: OUTBOUND_DETAIL_INCLUDE,
    });

    // 5. Auto-transition order from PLANNED to IN_PROGRESS
    if (order.status === 'PLANNED') {
      validateOrderTransition('PLANNED', 'IN_PROGRESS');
      await tx.outboundOrder.update({
        where: { id: orderId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // 6. Audit log
    await writeAuditLog(
      {
        userId,
        action: 'CREATE',
        entityType: 'Outbound',
        entityId: outbound.id,
        after: {
          outbound_number: outbound.outbound_number,
          outbound_order_id: orderId,
          vehicle_plate: outbound.vehicle_plate,
        },
      },
      tx
    );

    return outbound;
  });
}

// ---------------------------------------------------------------------------
// recordWeighing
// ---------------------------------------------------------------------------

async function recordWeighing(outboundId, data, userId) {
  const { weighingType, weightKg, source, ticketNumber, notes, deviceId } = data;

  if (!['GROSS', 'TARE'].includes(weighingType)) {
    badRequest('weighingType must be GROSS or TARE');
  }

  if (!['SCALE', 'MANUAL'].includes(source)) {
    badRequest('source must be SCALE or MANUAL');
  }

  if (source === 'MANUAL' && (weightKg == null || weightKg <= 0)) {
    badRequest('weightKg is required for MANUAL source');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Validate outbound exists and status
    const outbound = await tx.outbound.findUnique({
      where: { id: outboundId },
      include: {
        weighing_records: true,
        outbound_order: { select: { order_number: true } },
      },
    });

    if (!outbound) notFound();

    if (!['CREATED', 'LOADING'].includes(outbound.status)) {
      badRequest(`Cannot record weighing for outbound in status ${outbound.status}`);
    }

    // 2. Check this weighing type doesn't already exist
    const existingRecord = outbound.weighing_records.find(
      (r) => r.weighing_type === weighingType
    );
    if (existingRecord) {
      badRequest(`${weighingType} weighing already recorded for this outbound`);
    }

    // 3. Determine weight: SCALE or MANUAL
    let resolvedWeightKg = weightKg;
    let pfisterTicketId = null;
    let resolvedTicketNumber = ticketNumber || null;

    if (source === 'SCALE') {
      // Call Pfister gateway
      const previousWeightKg = weighingType === 'TARE'
        ? outbound.weighing_records.find((r) => r.weighing_type === 'GROSS')?.weight_kg
        : null;

      const ticket = await requestPfisterWeighing(weighingType, previousWeightKg, {
        outboundId: outbound.id,
        outboundNumber: outbound.outbound_number,
        source: 'OUTBOUND_WEIGHING',
        deviceId: deviceId || undefined,
      });

      resolvedWeightKg = Number(ticket.weight_kg);
      pfisterTicketId = ticket.id;
      resolvedTicketNumber = ticket.ticket_number;
    }

    // 4. Create OutboundWeighingRecord
    const weighingRecord = await tx.outboundWeighingRecord.create({
      data: {
        outbound_id: outboundId,
        weighing_type: weighingType,
        weight_kg: resolvedWeightKg,
        source,
        pfister_ticket_id: pfisterTicketId,
        ticket_number: resolvedTicketNumber,
        recorded_by: userId,
        notes: notes || null,
      },
    });

    // 5. If first weighing: auto-transition CREATED -> LOADING
    if (outbound.status === 'CREATED') {
      validateTransition('CREATED', 'LOADING');
      await tx.outbound.update({
        where: { id: outboundId },
        data: {
          status: 'LOADING',
          loading_started_at: new Date(),
        },
      });
    }

    // 6. Check if BOTH gross and tare now exist
    const allRecords = [
      ...outbound.weighing_records,
      weighingRecord,
    ];
    const grossRecord = allRecords.find((r) => r.weighing_type === 'GROSS');
    const tareRecord = allRecords.find((r) => r.weighing_type === 'TARE');

    if (grossRecord && tareRecord) {
      const grossKg = Number(grossRecord.weight_kg);
      const tareKg = Number(tareRecord.weight_kg);
      const netKg = Math.abs(grossKg - tareKg);

      // Guard: outbound must have at least one line before it can be WEIGHED
      const lineCount = await tx.outboundLine.count({
        where: { outbound_id: outboundId },
      });
      if (lineCount === 0) {
        badRequest('Outbound must have at least one line before weighing');
      }

      // Current status might be CREATED (just transitioned to LOADING above) or LOADING
      // We need to transition to WEIGHED from LOADING
      validateTransition('LOADING', 'WEIGHED');
      await tx.outbound.update({
        where: { id: outboundId },
        data: {
          status: 'WEIGHED',
          gross_weight_kg: grossKg,
          tare_weight_kg: tareKg,
          net_weight_kg: netKg,
          weighing_completed_at: new Date(),
        },
      });
    }

    // 7. Audit log
    await writeAuditLog(
      {
        userId,
        action: 'RECORD_WEIGHING',
        entityType: 'Outbound',
        entityId: outboundId,
        before: { status: outbound.status },
        after: {
          weighing_type: weighingType,
          weight_kg: resolvedWeightKg,
          source,
          ticket_number: resolvedTicketNumber,
        },
      },
      tx
    );

    // 8. Return updated outbound
    return tx.outbound.findUnique({
      where: { id: outboundId },
      include: OUTBOUND_DETAIL_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// generateBgl
// ---------------------------------------------------------------------------

async function generateBgl(outboundId, userId) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate outbound status
    const outbound = await tx.outbound.findUnique({
      where: { id: outboundId },
      include: {
        outbound_order: {
          include: {
            contract: true,
            buyer: true,
            sender: true,
            disposer: true,
            transporter: true,
            outsourced_transporter: true,
            waste_streams: {
              include: { waste_stream: true, receiver: true },
            },
          },
        },
      },
    });

    if (!outbound) notFound();

    if (outbound.status !== 'WEIGHED') {
      badRequest(`Cannot generate BGL for outbound in status ${outbound.status}. Must be WEIGHED.`);
    }

    // 2. Create document record as PENDING
    const fileName = `BGL-${outbound.outbound_number}.pdf`;
    const storagePath = `storage/outbound-documents/${outbound.id}/${fileName}`;

    const document = await tx.outboundDocument.create({
      data: {
        outbound_id: outboundId,
        document_type: 'BEGELEIDINGSBRIEF',
        status: 'PENDING',
        file_name: fileName,
        storage_path: storagePath,
        generated_by: userId,
      },
    });

    // 3. Try to generate BGL PDF via mapping service + PDF generator
    let bglGenerated = false;
    try {
      const { mapBegeleidingsbrief } = require('./begeleidingsbriefService');
      const { generateBegeleidingsbriefPDF } = require('./begeleidingsbriefGenerator');

      const mappedData = await mapBegeleidingsbrief(outboundId);
      const pdfResult = await generateBegeleidingsbriefPDF(mappedData);
      bglGenerated = true;

      // Update document with actual file details from PDF generator
      await tx.outboundDocument.update({
        where: { id: document.id },
        data: {
          file_name: pdfResult.fileName,
          storage_path: pdfResult.filePath,
        },
      });
    } catch (genErr) {
      // If modules not found, proceed without actual PDF (status still transitions)
      if (genErr.code === 'MODULE_NOT_FOUND') {
        // Services not available — skip PDF generation, proceed with transition
      } else {
        // Real generation error — mark document as FAILED but still transition
        console.error('BGL generation error:', genErr.message);
        await tx.outboundDocument.update({
          where: { id: document.id },
          data: { status: 'FAILED' },
        });

        await writeAuditLog(
          {
            userId,
            action: 'GENERATE_BGL_FAILED',
            entityType: 'Outbound',
            entityId: outboundId,
            after: { error: genErr.message, document_id: document.id },
          },
          tx
        );

        throw genErr;
      }
    }

    // 4. Mark document as GENERATED
    await tx.outboundDocument.update({
      where: { id: document.id },
      data: {
        status: 'GENERATED',
        generated_at: new Date(),
      },
    });

    // 5. Transition WEIGHED -> DOCUMENTS_READY
    validateTransition('WEIGHED', 'DOCUMENTS_READY');
    await tx.outbound.update({
      where: { id: outboundId },
      data: {
        status: 'DOCUMENTS_READY',
        documents_ready_at: new Date(),
      },
    });

    // 6. Audit log
    await writeAuditLog(
      {
        userId,
        action: 'GENERATE_BGL',
        entityType: 'Outbound',
        entityId: outboundId,
        before: { status: 'WEIGHED' },
        after: {
          status: 'DOCUMENTS_READY',
          document_id: document.id,
          bgl_service_available: bglGenerated,
        },
      },
      tx
    );

    return tx.outbound.findUnique({
      where: { id: outboundId },
      include: OUTBOUND_DETAIL_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// confirmDeparture
// ---------------------------------------------------------------------------

async function confirmDeparture(outboundId, userId) {
  return prisma.$transaction(async (tx) => {
    const outbound = await tx.outbound.findUnique({
      where: { id: outboundId },
    });

    if (!outbound) notFound();

    validateTransition(outbound.status, 'DEPARTED');

    const updated = await tx.outbound.update({
      where: { id: outboundId },
      data: {
        status: 'DEPARTED',
        departed_at: new Date(),
      },
      include: OUTBOUND_DETAIL_INCLUDE,
    });

    await writeAuditLog(
      {
        userId,
        action: 'CONFIRM_DEPARTURE',
        entityType: 'Outbound',
        entityId: outboundId,
        before: { status: outbound.status },
        after: { status: 'DEPARTED' },
      },
      tx
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// confirmDelivery
// ---------------------------------------------------------------------------

async function confirmDelivery(outboundId, userId) {
  return prisma.$transaction(async (tx) => {
    const outbound = await tx.outbound.findUnique({
      where: { id: outboundId },
    });

    if (!outbound) notFound();

    validateTransition(outbound.status, 'DELIVERED');

    const updated = await tx.outbound.update({
      where: { id: outboundId },
      data: {
        status: 'DELIVERED',
        delivered_at: new Date(),
      },
      include: OUTBOUND_DETAIL_INCLUDE,
    });

    await writeAuditLog(
      {
        userId,
        action: 'CONFIRM_DELIVERY',
        entityType: 'Outbound',
        entityId: outboundId,
        before: { status: outbound.status },
        after: { status: 'DELIVERED' },
      },
      tx
    );

    // Check if ALL outbounds for the parent order are DELIVERED
    const siblingOutbounds = await tx.outbound.findMany({
      where: { outbound_order_id: outbound.outbound_order_id },
      select: { id: true, status: true },
    });

    const allDelivered = siblingOutbounds.every((ob) => ob.status === 'DELIVERED');

    if (allDelivered) {
      const order = await tx.outboundOrder.findUnique({
        where: { id: outbound.outbound_order_id },
        select: { id: true, status: true },
      });

      if (order && order.status === 'IN_PROGRESS') {
        validateOrderTransition('IN_PROGRESS', 'COMPLETED');
        await tx.outboundOrder.update({
          where: { id: outbound.outbound_order_id },
          data: { status: 'COMPLETED' },
        });

        await writeAuditLog(
          {
            userId,
            action: 'AUTO_COMPLETE_ORDER',
            entityType: 'OutboundOrder',
            entityId: outbound.outbound_order_id,
            before: { status: 'IN_PROGRESS' },
            after: { status: 'COMPLETED' },
          },
          tx
        );
      }
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// getDocument (for download)
// ---------------------------------------------------------------------------

async function getDocument(outboundId, documentId) {
  const document = await prisma.outboundDocument.findFirst({
    where: {
      id: documentId,
      outbound_id: outboundId,
    },
  });

  if (!document) {
    const err = new Error('Document not found');
    err.statusCode = 404;
    throw err;
  }

  if (document.status !== 'GENERATED') {
    badRequest(`Document is not ready. Current status: ${document.status}`);
  }

  return document;
}

module.exports = {
  listOutbounds,
  getOutbound,
  createOutbound,
  recordWeighing,
  generateBgl,
  confirmDeparture,
  confirmDelivery,
  getDocument,
};
