const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

/**
 * Maps an Entity record to the legacy Carrier response shape.
 */
function mapEntityToCarrier(entity) {
  return {
    id: entity.id,
    name: entity.company_name,
    kvk_number: entity.kvk_number,
    contact_name: entity.contact_name,
    contact_email: entity.contact_email,
    contact_phone: entity.contact_phone,
    licence_number: entity.vihb_number,
    is_active: entity.status === 'ACTIVE',
    created_at: entity.created_at,
  };
}

async function list(req, res, next) {
  try {
    const { search, page = 1, limit = 20, active } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = { is_transporter: true };
    if (search) {
      where.company_name = { contains: search, mode: 'insensitive' };
    }
    if (active !== undefined) {
      where.status = active === 'true' ? 'ACTIVE' : 'INACTIVE';
    }

    const [entities, total] = await Promise.all([
      prisma.entity.findMany({ where, skip, take: limitNum, orderBy: { company_name: 'asc' } }),
      prisma.entity.count({ where }),
    ]);

    return res.json({ data: entities.map(mapEntityToCarrier), total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const entity = await prisma.entity.findFirst({
      where: { id: req.params.id, is_transporter: true },
    });
    if (!entity) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    return res.json(mapEntityToCarrier(entity));
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

    const entity = await prisma.$transaction(async (tx) => {
      const created = await tx.entity.create({
        data: {
          company_name: name,
          kvk_number,
          contact_name,
          contact_email,
          contact_phone,
          vihb_number: licence_number,
          street_and_number: '',
          postal_code: '',
          city: '',
          is_transporter: true,
        },
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

    return res.status(201).json(mapEntityToCarrier(entity));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.entity.findFirst({ where: { id, is_transporter: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    const { name, kvk_number, contact_name, contact_email, contact_phone, licence_number } = req.body;

    const data = {};
    if (name !== undefined) data.company_name = name;
    if (kvk_number !== undefined) data.kvk_number = kvk_number;
    if (contact_name !== undefined) data.contact_name = contact_name;
    if (contact_email !== undefined) data.contact_email = contact_email;
    if (contact_phone !== undefined) data.contact_phone = contact_phone;
    if (licence_number !== undefined) data.vihb_number = licence_number;

    const entity = await prisma.$transaction(async (tx) => {
      const updated = await tx.entity.update({
        where: { id },
        data,
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

    return res.json(mapEntityToCarrier(entity));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.entity.findFirst({ where: { id, is_transporter: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.entity.update({ where: { id }, data: { status: 'INACTIVE' } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'Carrier',
        entityId: id,
        before: existing,
        after: { ...existing, status: 'INACTIVE' },
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

    const existing = await prisma.entity.findFirst({ where: { id, is_transporter: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    const currentlyActive = existing.status === 'ACTIVE';
    if (currentlyActive === is_active) {
      return res.json(mapEntityToCarrier(existing));
    }

    const newStatus = is_active ? 'ACTIVE' : 'INACTIVE';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.entity.update({
        where: { id },
        data: { status: newStatus },
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

    return res.json(mapEntityToCarrier(result));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove, toggleStatus };
