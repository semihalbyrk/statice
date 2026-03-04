const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

async function list(req, res, next) {
  try {
    const { search, supplier_type, page = 1, limit = 20, active } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (supplier_type) {
      where.supplier_type = supplier_type;
    }
    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limitNum, orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);

    return res.json({ data: suppliers, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    return res.json(supplier);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, supplier_type, kvk_number, contact_name, contact_email } = req.body;
    if (!name || !supplier_type) {
      return res.status(400).json({ error: 'Name and supplier_type are required' });
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: { name, supplier_type, kvk_number, contact_name, contact_email },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'Supplier',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });

    return res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, supplier_type, kvk_number, contact_name, contact_email } = req.body;

    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: { name, supplier_type, kvk_number, contact_name, contact_email },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(supplier);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { is_active: false } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'Supplier',
        entityId: id,
        before: existing,
        after: { ...existing, is_active: false },
      }, tx);
    });

    return res.json({ message: 'Supplier deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
