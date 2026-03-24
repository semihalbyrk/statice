const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next inbound number in format INB-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "INB-00001"
 */
async function generateInboundNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'inbound', 'inbound_number', 'INB-');
}

module.exports = { generateInboundNumber };
