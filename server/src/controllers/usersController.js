const bcrypt = require('bcryptjs');
const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../middleware/AppError');

const VALID_ROLES = ['GATE_OPERATOR', 'LOGISTICS_PLANNER', 'REPORTING_MANAGER', 'ADMIN'];
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_SELECT = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  is_active: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
};

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where = {};
  if (req.query.search) {
    where.OR = [
      { email: { contains: req.query.search, mode: 'insensitive' } },
      { full_name: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }
  if (req.query.role && VALID_ROLES.includes(req.query.role)) {
    where.role = req.query.role;
  }
  if (req.query.is_active !== undefined && req.query.is_active !== '') {
    where.is_active = req.query.is_active === 'true';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, orderBy: { created_at: 'desc' }, skip, take: limit }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SELECT });
  if (!user) throw new AppError('User not found', 404);
  res.json({ data: user });
});

const create = asyncHandler(async (req, res) => {
  const { email, full_name, role, password, is_active } = req.body;

  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError('Valid email is required', 422);
  }
  if (!full_name || full_name.length < 2 || full_name.length > 100) {
    throw new AppError('Full name must be 2-100 characters', 422);
  }
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Invalid role. Valid: ${VALID_ROLES.join(', ')}`, 422);
  }
  if (!password || !PASSWORD_REGEX.test(password)) {
    throw new AppError('Password must be at least 8 characters with at least one uppercase letter and one number', 422);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, full_name, role, password_hash, is_active: is_active !== false },
      select: USER_SELECT,
    });

    await writeAuditLog({
      userId: req.user.userId,
      action: 'CREATE',
      entityType: 'User',
      entityId: u.id,
      after: { email, full_name, role },
    }, tx);

    return u;
  });

  res.status(201).json({ data: user });
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!existing) throw new AppError('User not found', 404);

  const { full_name, role, is_active } = req.body;
  const updateData = {};
  const before = {};

  if (full_name !== undefined) {
    if (full_name.length < 2 || full_name.length > 100) {
      throw new AppError('Full name must be 2-100 characters', 422);
    }
    before.full_name = existing.full_name;
    updateData.full_name = full_name;
  }

  if (role !== undefined) {
    if (req.user.userId === id) {
      throw new AppError('Cannot change your own role', 403);
    }
    if (!VALID_ROLES.includes(role)) {
      throw new AppError(`Invalid role. Valid: ${VALID_ROLES.join(', ')}`, 422);
    }
    before.role = existing.role;
    updateData.role = role;
  }

  if (is_active !== undefined) {
    if (req.user.userId === id && is_active === false) {
      throw new AppError('Cannot deactivate your own account', 403);
    }
    before.is_active = existing.is_active;
    updateData.is_active = is_active;
  }

  if (Object.keys(updateData).length === 0) {
    return res.json({ data: existing });
  }

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: updateData, select: USER_SELECT });

    await writeAuditLog({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      before,
      after: updateData,
    }, tx);

    return u;
  });

  res.json({ data: user });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError('User not found', 404);

  if (!new_password || !PASSWORD_REGEX.test(new_password)) {
    throw new AppError('Password must be at least 8 characters with at least one uppercase letter and one number', 422);
  }

  const password_hash = await bcrypt.hash(new_password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { password_hash } });

    await writeAuditLog({
      userId: req.user.userId,
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: id,
      after: { note: 'Password reset by admin' },
    }, tx);
  });

  res.json({ message: 'Password reset successfully' });
});

const getActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new AppError('User not found', 404);

  const entries = await prisma.auditLog.findMany({
    where: { user_id: id },
    select: { id: true, action: true, entity_type: true, entity_id: true, timestamp: true },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  res.json({ data: entries });
});

const toggleStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    throw new AppError('is_active (boolean) is required', 400);
  }

  if (id === req.user.userId && !is_active) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('User not found', 404);
  if (existing.is_active === is_active) {
    const { password_hash: _, ...safeExisting } = existing;
    return res.json(safeExisting);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { is_active },
    });
    await writeAuditLog({
      userId: req.user.userId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      before: { is_active: existing.is_active },
      after: { is_active: updated.is_active },
    }, tx);
    return updated;
  });

  const { password_hash, ...safeUser } = result;
  res.json(safeUser);
});

module.exports = { list, getById, create, update, resetPassword, getActivity, toggleStatus };
