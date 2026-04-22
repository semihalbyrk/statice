const prisma = require('../utils/prismaClient');

const LINE_INCLUDE = { material: true };

async function listByOutbound(outboundId) {
  return prisma.outboundLine.findMany({
    where: { outbound_id: outboundId },
    include: LINE_INCLUDE,
    orderBy: { created_at: 'asc' },
  });
}

async function createLine(/* outboundId, data, userId */) {
  throw new Error('not implemented');
}

async function updateLine(/* outboundId, lineId, data, userId */) {
  throw new Error('not implemented');
}

async function deleteLine(/* outboundId, lineId, userId */) {
  throw new Error('not implemented');
}

module.exports = { listByOutbound, createLine, updateLine, deleteLine };
