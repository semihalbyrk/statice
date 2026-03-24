const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next order number in format ORD-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "ORD-00001"
 */
async function generateOrderNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'inboundOrder', 'order_number', 'ORD-');
}

module.exports = { generateOrderNumber };
