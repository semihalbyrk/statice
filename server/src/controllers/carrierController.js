const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

async function list(req, res, next) {
  try {
    const { search, page = 1, limit = 20, active } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    const [carriers, total] = await Promise.all([
      prisma.carrier.findMany({ where, skip, take: limitNum, orderBy: { name: 'asc' } }),
      prisma.carrier.count({ where }),
    ]);

    return res.json({ data: carriers, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const carrier = await prisma.carrier.findUnique({
      where: { id: req.params.id },
      include: { vehicles: true },
    });
    if (!carrier) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    return res.json(carrier);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, kvk_number, contact_name, contact_email, contact_phone, licence_number } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const carrier = await prisma.$transaction(async (tx) => {
      const created = await tx.carrier.create({
        data: { name, kvk_number, contact_name, contact_email, contact_phone, licence_number },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'Carrier',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });

    return res.status(201).json(carrier);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.carrier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    const { name, kvk_number, contact_name, contact_email, contact_phone, licence_number } = req.body;

    const carrier = await prisma.$transaction(async (tx) => {
      const updated = await tx.carrier.update({
        where: { id },
        data: { name, kvk_number, contact_name, contact_email, contact_phone, licence_number },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'Carrier',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(carrier);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.carrier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.carrier.update({ where: { id }, data: { is_active: false } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'Carrier',
        entityId: id,
        before: existing,
        after: { ...existing, is_active: false },
      }, tx);
    });

    return res.json({ message: 'Carrier deactivated' });
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }

    const existing = await prisma.carrier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    if (existing.is_active === is_active) {
      return res.json(existing);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.carrier.update({
        where: { id },
        data: { is_active },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'Carrier',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove, toggleStatus };
