const prisma = require('./prismaClient');

/**
 * Generate the next inbound number in format INB-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "INB-00001"
 */
async function generateInboundNumber(tx) {
  const client = tx || prisma;
  const prefix = 'INB-';

  const lastInbound = await client.inbound.findFirst({
    where: { inbound_number: { startsWith: prefix } },
    orderBy: { inbound_number: 'desc' },
    select: { inbound_number: true },
  });

  let nextSeq = 1;
  if (lastInbound) {
    const lastSeq = parseInt(lastInbound.inbound_number.replace(prefix, ''), 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

module.exports = { generateInboundNumber };
