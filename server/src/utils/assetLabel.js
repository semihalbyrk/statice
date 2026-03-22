const prisma = require('./prismaClient');

/** Static tare weights (kg) per container type */
const CONTAINER_TARE_WEIGHTS = {
  OPEN_TOP: 300,
  CLOSED_TOP: 350,
  GITTERBOX: 85,
  PALLET: 25,
  OTHER: 0,
};

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

/**
 * Generate the next container label in format CNT-NNNNN (global sequential counter).
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "CNT-00001"
 */
async function generateContainerLabel(tx) {
  const client = tx || prisma;
  const prefix = 'CNT-';

  const lastAsset = await client.asset.findFirst({
    where: { container_label: { startsWith: prefix } },
    orderBy: { container_label: 'desc' },
    select: { container_label: true },
  });

  let nextSeq = 1;
  if (lastAsset) {
    const lastSeq = parseInt(lastAsset.container_label.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Preview the next container label.
 *
 * @returns {Promise<string>}
 */
async function previewNextContainerLabel() {
  return generateContainerLabel();
}

module.exports = {
  generateAssetLabel,
  previewNextLabel,
  generateContainerLabel,
  previewNextContainerLabel,
  CONTAINER_TARE_WEIGHTS,
};
