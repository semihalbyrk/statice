const prisma = require('./prismaClient');

/**
 * Generate the next parcel label in format P-NNNNN (global sequential counter).
 * Short and universal for all parcel types.
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "P-00001"
 */
async function generateAssetLabel(tx) {
  const client = tx || prisma;
  const prefix = 'P-';

  const lastAsset = await client.asset.findFirst({
    where: { asset_label: { startsWith: prefix } },
    orderBy: { asset_label: 'desc' },
    select: { asset_label: true },
  });

  let nextSeq = 1;
  if (lastAsset) {
    const lastSeq = parseInt(lastAsset.asset_label.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Preview the next parcel label.
 *
 * @returns {Promise<string>}
 */
async function previewNextLabel() {
  return generateAssetLabel();
}

module.exports = { generateAssetLabel, previewNextLabel };
