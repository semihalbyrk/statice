const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next outbound order number in format OBO-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "OBO-00001"
 */
async function generateOutboundOrderNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'outboundOrder', 'order_number', 'OBO-');
}

module.exports = { generateOutboundOrderNumber };
