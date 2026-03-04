const prisma = require('./prismaClient');

/**
 * Generate the next asset label in format SKP-YYYYMMDD-NNN (daily counter).
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "SKP-20260303-001"
 */
async function generateAssetLabel(tx) {
  const client = tx || prisma;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SKP-${dateStr}-`;

  const lastAsset = await client.asset.findFirst({
    where: { asset_label: { startsWith: prefix } },
    orderBy: { asset_label: 'desc' },
    select: { asset_label: true },
  });

  let nextSeq = 1;
  if (lastAsset) {
    const lastSeq = parseInt(lastAsset.asset_label.replace(prefix, ''), 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Preview the next asset label without being inside a transaction.
 * Used by the UI to show what label will be assigned.
 *
 * @returns {Promise<string>}
 */
async function previewNextLabel() {
  return generateAssetLabel();
}

module.exports = { generateAssetLabel, previewNextLabel };
