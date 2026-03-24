const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next contract number in format CTR-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "CTR-00001"
 */
async function generateContractNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'supplierContract', 'contract_number', 'CTR-');
}

module.exports = { generateContractNumber };
