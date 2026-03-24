const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next contamination incident number in format CON-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "CON-00001"
 */
async function generateContaminationNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'contaminationIncident', 'incident_number', 'CON-');
}

module.exports = { generateContaminationNumber };
