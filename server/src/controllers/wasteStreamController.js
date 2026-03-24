const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

// ── Waste Streams ──

async function listWasteStreams(req, res, next) {
  try {
    const where = {};
    if (req.query.active !== undefined) {
      where.is_active = req.query.active === 'true';
    }
    const streams = await prisma.wasteStream.findMany({
      where,
      include: {
        categories: {
          where: req.query.category_active !== undefined ? { is_active: req.query.category_active === 'true' } : undefined,
          orderBy: { code_cbs: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.json({ data: streams });
  } catch (err) {
    next(err);
  }
}

async function createWasteStream(req, res, next) {
  try {
    const { name, code, cbs_code, weeelabex_code, ewc_code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required' });
    }

    const stream = await prisma.$transaction(async (tx) => {
      const created = await tx.wasteStream.create({
        data: {
          name,
          code,
          cbs_code: cbs_code || null,
          weeelabex_code: weeelabex_code || null,
          ewc_code: ewc_code || null,
        },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'WasteStream',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });

    return res.status(201).json(stream);
  } catch (err) {
    next(err);
  }
}

async function updateWasteStream(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.wasteStream.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Waste stream not found' });
    }

    const { name, code, cbs_code, weeelabex_code, ewc_code, is_active } = req.body;

    const stream = await prisma.$transaction(async (tx) => {
      const updated = await tx.wasteStream.update({
        where: { id },
        data: {
          name,
          code,
          cbs_code,
          weeelabex_code,
          ewc_code,
          is_active,
        },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'WasteStream',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(stream);
  } catch (err) {
    next(err);
  }
}

// ── Product Categories ──

async function listProductCategories(req, res, next) {
  try {
    const { waste_stream_id, active } = req.query;
    const where = {};
    if (waste_stream_id) {
      where.waste_stream_id = waste_stream_id;
    }
    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    const categories = await prisma.productCategory.findMany({
      where,
      include: { waste_stream: { select: { id: true, name: true, code: true } } },
      orderBy: { code_cbs: 'asc' },
    });
    return res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}

async function createProductCategory(req, res, next) {
  try {
    const {
      code_cbs, description_en, description_nl, waste_stream_id,
      recycled_pct_default, reused_pct_default, disposed_pct_default,
    } = req.body;

    if (!code_cbs || !description_en || !description_nl || !waste_stream_id) {
      return res.status(400).json({ error: 'code_cbs, description_en, description_nl, and waste_stream_id are required' });
    }

    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.productCategory.create({
        data: {
          code_cbs, description_en, description_nl, waste_stream_id,
          recycled_pct_default: recycled_pct_default || 0,
          reused_pct_default: reused_pct_default || 0,
          disposed_pct_default: disposed_pct_default || 0,
        },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'ProductCategory',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });

    return res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

async function updateProductCategory(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Product category not found' });
    }

    const {
      code_cbs, description_en, description_nl, waste_stream_id,
      recycled_pct_default, reused_pct_default, disposed_pct_default, is_active,
    } = req.body;

    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id },
        data: {
          code_cbs, description_en, description_nl, waste_stream_id,
          recycled_pct_default, reused_pct_default, disposed_pct_default, is_active,
        },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'ProductCategory',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(category);
  } catch (err) {
    next(err);
  }
}

async function deleteProductCategory(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.productCategory.findUnique({
      where: { id },
      include: { sorting_lines: { select: { id: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Product category not found' });
    }
    if (existing.sorting_lines.length > 0) {
      return res.status(409).json({ error: 'Category is already used in sorting lines and cannot be deleted' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.productCategory.delete({ where: { id } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'ProductCategory',
        entityId: id,
        before: existing,
      }, tx);
    });

    return res.json({ message: 'Product category deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWasteStreams, createWasteStream, updateWasteStream,
  listProductCategories, createProductCategory, updateProductCategory, deleteProductCategory,
};
