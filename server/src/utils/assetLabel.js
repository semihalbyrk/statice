const prisma = require('./prismaClient');
const { generateSequentialId } = require('./sequentialId');

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
 *
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 * @returns {Promise<string>} e.g. "P-00001"
 */
async function generateAssetLabel(tx) {
  const client = tx || prisma;
  return generateSequentialId(client, 'asset', 'asset_label', 'P-');
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
  return generateSequentialId(client, 'asset', 'container_label', 'CNT-');
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
