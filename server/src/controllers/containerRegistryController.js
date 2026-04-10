const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

async function list(req, res, next) {
  try {
    const { search, page = 1, limit = 50, active } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.container_label = { contains: search, mode: 'insensitive' };
    }
    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    const [containers, total] = await Promise.all([
      prisma.containerRegistry.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { container_label: 'asc' },
      }),
      prisma.containerRegistry.count({ where }),
    ]);

    return res.json({ data: containers, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const container = await prisma.containerRegistry.findUnique({
      where: { id: req.params.id },
    });
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.json(container);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { container_label, container_type, tare_weight_kg, volume_m3, notes } = req.body;
    if (!container_label || !container_type || tare_weight_kg === undefined) {
      return res.status(400).json({ error: 'container_label, container_type, and tare_weight_kg are required' });
    }

    let container;
    try {
      container = await prisma.$transaction(async (tx) => {
        const created = await tx.containerRegistry.create({
          data: { container_label, container_type, tare_weight_kg, volume_m3, notes },
        });
        await writeAuditLog({
          userId: req.user.userId,
          action: 'CREATE',
          entityType: 'ContainerRegistry',
          entityId: created.id,
          after: created,
        }, tx);
        return created;
      });
    } catch (txErr) {
      if (txErr.code === 'P2002') {
        return res.status(409).json({ error: 'Container label already exists' });
      }
      throw txErr;
    }

    return res.status(201).json(container);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.containerRegistry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const { container_label, container_type, tare_weight_kg, volume_m3, notes, is_active } = req.body;
    const data = {};
    if (container_label !== undefined) data.container_label = container_label;
    if (container_type !== undefined) data.container_type = container_type;
    if (tare_weight_kg !== undefined) data.tare_weight_kg = tare_weight_kg;
    if (volume_m3 !== undefined) data.volume_m3 = volume_m3;
    if (notes !== undefined) data.notes = notes;
    if (is_active !== undefined) data.is_active = is_active;

    let container;
    try {
      container = await prisma.$transaction(async (tx) => {
        const updated = await tx.containerRegistry.update({ where: { id }, data });
        await writeAuditLog({
          userId: req.user.userId,
          action: 'UPDATE',
          entityType: 'ContainerRegistry',
          entityId: id,
          before: existing,
          after: updated,
        }, tx);
        return updated;
      });
    } catch (txErr) {
      if (txErr.code === 'P2002') {
        return res.status(409).json({ error: 'Container label already exists' });
      }
      throw txErr;
    }

    return res.json(container);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.containerRegistry.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const deactivated = await prisma.$transaction(async (tx) => {
      const updated = await tx.containerRegistry.update({
        where: { id },
        data: { is_active: false },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'ContainerRegistry',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(deactivated);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
