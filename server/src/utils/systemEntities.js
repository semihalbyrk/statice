const prisma = require('./prismaClient');

/**
 * Get the protected Statice entity ID.
 * @param {import('@prisma/client').PrismaClient} [tx] - Optional transaction client
 * @returns {Promise<string|null>}
 */
async function getStaticeEntityId(tx) {
  const client = tx || prisma;
  const statice = await client.entity.findFirst({
    where: { is_protected: true },
    select: { id: true },
  });
  return statice?.id || null;
}

/**
 * Get the full protected Statice entity.
 * @param {import('@prisma/client').PrismaClient} [tx] - Optional transaction client
 * @returns {Promise<object|null>}
 */
async function getStaticeEntity(tx) {
  const client = tx || prisma;
  return client.entity.findFirst({
    where: { is_protected: true },
  });
}

module.exports = { getStaticeEntityId, getStaticeEntity };
