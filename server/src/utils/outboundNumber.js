const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next outbound number in format OUT-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "OUT-00001"
 */
async function generateOutboundNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'outbound', 'outbound_number', 'OUT-');
}

module.exports = { generateOutboundNumber };
