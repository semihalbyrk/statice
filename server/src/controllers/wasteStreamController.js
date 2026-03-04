const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

// ── Waste Streams ──

async function listWasteStreams(req, res, next) {
  try {
    const streams = await prisma.wasteStream.findMany({
      include: { categories: { orderBy: { code_cbs: 'asc' } } },
      orderBy: { name_en: 'asc' },
    });
    return res.json({ data: streams });
  } catch (err) {
    next(err);
  }
}

async function createWasteStream(req, res, next) {
  try {
    const { name_en, name_nl, code } = req.body;
    if (!name_en || !name_nl || !code) {
      return res.status(400).json({ error: 'name_en, name_nl, and code are required' });
    }

    const stream = await prisma.$transaction(async (tx) => {
      const created = await tx.wasteStream.create({ data: { name_en, name_nl, code } });
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

    const { name_en, name_nl, code, is_active } = req.body;

    const stream = await prisma.$transaction(async (tx) => {
      const updated = await tx.wasteStream.update({
        where: { id },
        data: { name_en, name_nl, code, is_active },
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
    const { waste_stream_id } = req.query;
    const where = {};
    if (waste_stream_id) {
      where.waste_stream_id = waste_stream_id;
    }

    const categories = await prisma.productCategory.findMany({
      where,
      include: { waste_stream: { select: { id: true, name_en: true, code: true } } },
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
      recycled_pct_default, reused_pct_default, disposed_pct_default, landfill_pct_default,
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
          landfill_pct_default: landfill_pct_default || 0,
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
      recycled_pct_default, reused_pct_default, disposed_pct_default, landfill_pct_default, is_active,
    } = req.body;

    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id },
        data: {
          code_cbs, description_en, description_nl, waste_stream_id,
          recycled_pct_default, reused_pct_default, disposed_pct_default, landfill_pct_default, is_active,
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

module.exports = {
  listWasteStreams, createWasteStream, updateWasteStream,
  listProductCategories, createProductCategory, updateProductCategory,
};
