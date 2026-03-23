const prisma = require('./prismaClient');

/**
 * Generate the next order number in format ORD-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "ORD-00001"
 */
async function generateOrderNumber(tx) {
  const client = tx || prisma;
  const prefix = 'ORD-';

  const lastOrder = await client.inboundOrder.findFirst({
    where: { order_number: { startsWith: prefix } },
    orderBy: { order_number: 'desc' },
    select: { order_number: true },
  });

  let nextSeq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.order_number.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

module.exports = { generateOrderNumber };
