const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next outbound parcel label in format OPR-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "OPR-00001"
 */
async function generateOutboundParcelLabel(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'outboundParcel', 'parcel_label', 'OPR-');
}

module.exports = { generateOutboundParcelLabel };
