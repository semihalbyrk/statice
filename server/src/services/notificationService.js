const prisma = require('../utils/prismaClient');

/**
 * Send notifications to all active users with specified roles.
 * @param {object} tx - Prisma transaction client (or prisma itself)
 * @param {string[]} roles - Array of role names to notify
 * @param {object} opts - { type, title, message, entityType, entityId }
 */
async function notifyRoles(tx, roles, { type, title, message, entityType, entityId }) {
  const client = tx || prisma;
  const users = await client.user.findMany({
    where: { role: { in: roles }, is_active: true },
    select: { id: true },
  });
  if (users.length > 0) {
    await client.notification.createMany({
      data: users.map((u) => ({
        user_id: u.id,
        type,
        title,
        message,
        entity_type: entityType || null,
        entity_id: entityId || null,
      })),
    });
  }
  return users.length;
}

module.exports = { notifyRoles };
