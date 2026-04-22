const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

const LINE_INCLUDE = { material: true };

const VOLUME_CAPS = { M3: 1000, L: 50000 };
const CONTAINER_TYPES = ['OPEN_TOP', 'CLOSED_TOP', 'GITTERBOX', 'PALLET', 'OTHER'];
const VOLUME_UOMS = ['M3', 'L'];
const MUTABLE_OUTBOUND_STATUSES = ['CREATED', 'LOADING'];

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

function notFound(message = 'Not found') {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function validatePayload(payload) {
  if (!payload.material_id) badRequest('material_id is required');
  if (!CONTAINER_TYPES.includes(payload.container_type)) badRequest('invalid container_type');
  if (!VOLUME_UOMS.includes(payload.volume_uom)) badRequest('invalid volume_uom');
  const volume = Number(payload.volume);
  if (!Number.isFinite(volume) || volume <= 0) badRequest('volume must be > 0');
  const cap = VOLUME_CAPS[payload.volume_uom];
  if (volume > cap) {
    badRequest(`volume exceeds ${cap}${payload.volume_uom === 'M3' ? 'm³' : 'L'} cap`);
  }
}

async function assertMaterialPlanned(tx, outboundId, materialId) {
  const outbound = await tx.outbound.findUnique({
    where: { id: outboundId },
    include: { outbound_order: { include: { waste_streams: true } } },
  });
  if (!outbound) notFound('outbound not found');
  if (!MUTABLE_OUTBOUND_STATUSES.includes(outbound.status)) {
    badRequest(
      `outbound is ${outbound.status}; lines can only be mutated in CREATED or LOADING`,
    );
  }
  const material = await tx.materialMaster.findUnique({ where: { id: materialId } });
  if (!material) notFound('material not found');
  if (!material.is_active) badRequest('material is inactive');
  const planned = outbound.outbound_order.waste_streams.some(
    (ws) => ws.material_id === materialId,
  );
  if (!planned) badRequest('material not planned for this shipment');
  return outbound;
}

async function listByOutbound(outboundId) {
  return prisma.outboundLine.findMany({
    where: { outbound_id: outboundId },
    include: LINE_INCLUDE,
    orderBy: { created_at: 'asc' },
  });
}

async function createLine(outboundId, data, userId) {
  validatePayload(data);
  return prisma.$transaction(async (tx) => {
    await assertMaterialPlanned(tx, outboundId, data.material_id);
    const line = await tx.outboundLine.create({
      data: {
        outbound_id: outboundId,
        material_id: data.material_id,
        container_type: data.container_type,
        volume: data.volume,
        volume_uom: data.volume_uom,
      },
      include: LINE_INCLUDE,
    });
    await writeAuditLog(
      {
        userId,
        action: 'CREATE_OUTBOUND_LINE',
        entityType: 'OutboundLine',
        entityId: line.id,
        after: { outbound_id: outboundId, payload: data },
      },
      tx,
    );
    return line;
  });
}

async function updateLine(/* outboundId, lineId, data, userId */) {
  throw new Error('not implemented');
}

async function deleteLine(/* outboundId, lineId, userId */) {
  throw new Error('not implemented');
}

module.exports = { listByOutbound, createLine, updateLine, deleteLine };
