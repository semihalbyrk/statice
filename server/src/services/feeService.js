const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listFees({ fee_type, active, search }) {
  const where = {};
  if (fee_type) where.fee_type = fee_type;
  if (active !== undefined) where.is_active = active === 'true';
  if (search) {
    where.OR = [
      { fee_type: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const fees = await prisma.feeMaster.findMany({
    where,
    orderBy: { fee_type: 'asc' },
  });

  return fees;
}

async function getFee(id) {
  const fee = await prisma.feeMaster.findUnique({ where: { id } });
  if (!fee) throw createError('Fee not found', 404);
  return fee;
}

async function createFee(data, userId) {
  return prisma.$transaction(async (tx) => {
    const fee = await tx.feeMaster.create({
      data: {
        fee_type: data.fee_type,
        description: data.description,
        rate_type: data.rate_type,
        rate_value: data.rate_value,
        min_cap: data.min_cap ?? null,
        max_cap: data.max_cap ?? null,
        is_active: data.is_active ?? true,
      },
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'FeeMaster',
      entityId: fee.id,
      after: fee,
    }, tx);

    return fee;
  });
}

async function updateFee(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeMaster.findUnique({ where: { id } });
    if (!existing) throw createError('Fee not found', 404);

    const updated = await tx.feeMaster.update({
      where: { id },
      data: {
        fee_type: data.fee_type ?? existing.fee_type,
        description: data.description ?? existing.description,
        rate_type: data.rate_type ?? existing.rate_type,
        rate_value: data.rate_value !== undefined ? data.rate_value : existing.rate_value,
        min_cap: data.min_cap !== undefined ? data.min_cap : existing.min_cap,
        max_cap: data.max_cap !== undefined ? data.max_cap : existing.max_cap,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active,
      },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'FeeMaster',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return updated;
  });
}

async function deactivateFee(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feeMaster.findUnique({ where: { id } });
    if (!existing) throw createError('Fee not found', 404);

    const updated = await tx.feeMaster.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'FeeMaster',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return updated;
  });
}

module.exports = { listFees, getFee, createFee, updateFee, deactivateFee };
