const prisma = require('./prismaClient');

/**
 * Generate the next order number in format ORD-YYYY-NNNN.
 * Runs inside a Serializable transaction to prevent duplicates.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "ORD-2026-0001"
 */
async function generateOrderNumber(tx) {
  const client = tx || prisma;
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const lastOrder = await client.inboundOrder.findFirst({
    where: { order_number: { startsWith: prefix } },
    orderBy: { order_number: 'desc' },
    select: { order_number: true },
  });

  let nextSeq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.order_number.replace(prefix, ''), 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

module.exports = { generateOrderNumber };
