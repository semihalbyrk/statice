const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

/**
 * Generate the next invoice number in format INV-NNNNN.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "INV-00001"
 */
async function generateInvoiceNumber(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'invoice', 'invoice_number', 'INV-');
}

module.exports = { generateInvoiceNumber };
