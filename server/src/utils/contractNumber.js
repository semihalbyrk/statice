const prisma = require('./prismaClient');

/**
 * Generate the next contract number in format CTR-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "CTR-00001"
 */
async function generateContractNumber(tx) {
  const client = tx || prisma;
  const prefix = 'CTR-';

  const last = await client.supplierContract.findFirst({
    where: { contract_number: { startsWith: prefix } },
    orderBy: { contract_number: 'desc' },
    select: { contract_number: true },
  });

  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.contract_number.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

module.exports = { generateContractNumber };
