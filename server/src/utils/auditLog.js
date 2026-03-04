const prisma = require('./prismaClient');

/**
 * Write an entry to the AuditLog table.
 *
 * @param {object} opts
 * @param {string} opts.userId   - ID of the acting user
 * @param {string} opts.action   - e.g. "CREATE", "UPDATE", "DELETE"
 * @param {string} opts.entityType - e.g. "Carrier", "InboundOrder"
 * @param {string} opts.entityId   - UUID of the affected entity
 * @param {object} [opts.before]   - snapshot before the change
 * @param {object} [opts.after]    - snapshot after the change
 * @param {string} [opts.ipAddress] - client IP
 * @param {import('@prisma/client').PrismaClient} [tx] - optional transaction client
 */
async function writeAuditLog({ userId, action, entityType, entityId, before, after, ipAddress }, tx) {
  const client = tx || prisma;
  return client.auditLog.create({
    data: {
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      diff_json: { before: before || null, after: after || null },
      ip_address: ipAddress || null,
    },
  });
}

module.exports = { writeAuditLog };
