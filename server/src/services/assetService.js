const prisma = require('../utils/prismaClient');
const { generateAssetLabel } = require('../utils/assetLabel');
const { writeAuditLog } = require('../utils/auditLog');

const ASSET_INCLUDE = {
  material_category: {
    select: { id: true, code_cbs: true, description_en: true, description_nl: true },
  },
  weighing_event: {
    select: { id: true, status: true, order_id: true },
  },
};

async function getAsset(id) {
  return prisma.asset.findUnique({
    where: { id },
    include: ASSET_INCLUDE,
  });
}

async function listAssets(weighingEventId) {
  return prisma.asset.findMany({
    where: { weighing_event_id: weighingEventId },
    include: ASSET_INCLUDE,
    orderBy: { created_at: 'asc' },
  });
}

async function createAsset(data, userId) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.weighingEvent.findUnique({ where: { id: data.weighing_event_id } });
    if (!event) throw new Error('Weighing event not found');

    if (event.status === 'CONFIRMED') {
      const err = new Error('Cannot add assets to a confirmed weighing event');
      err.statusCode = 409;
      throw err;
    }

    const assetLabel = await generateAssetLabel(tx);

    const asset = await tx.asset.create({
      data: {
        asset_label: assetLabel,
        weighing_event_id: data.weighing_event_id,
        skip_type: data.skip_type,
        material_category_id: data.material_category_id,
        estimated_volume_m3: data.estimated_volume_m3 ? parseFloat(data.estimated_volume_m3) : null,
        notes: data.notes || null,
      },
      include: ASSET_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'Asset',
      entityId: asset.id,
      after: { asset_label: asset.asset_label, weighing_event_id: asset.weighing_event_id, skip_type: asset.skip_type },
    }, tx);

    return asset;
  });
}

async function updateAsset(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({
      where: { id },
      include: { weighing_event: { select: { status: true } } },
    });
    if (!existing) return null;

    if (existing.weighing_event.status === 'CONFIRMED') {
      const err = new Error('Cannot update assets on a confirmed weighing event');
      err.statusCode = 409;
      throw err;
    }

    const updateData = {};
    if (data.skip_type !== undefined) updateData.skip_type = data.skip_type;
    if (data.material_category_id !== undefined) updateData.material_category_id = data.material_category_id;
    if (data.estimated_volume_m3 !== undefined) updateData.estimated_volume_m3 = data.estimated_volume_m3 != null ? parseFloat(data.estimated_volume_m3) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await tx.asset.update({
      where: { id },
      data: updateData,
      include: ASSET_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'Asset',
      entityId: id,
      before: { skip_type: existing.skip_type, material_category_id: existing.material_category_id },
      after: { skip_type: updated.skip_type, material_category_id: updated.material_category_id },
    }, tx);

    return updated;
  });
}

async function deleteAsset(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({
      where: { id },
      include: { weighing_event: { select: { status: true } } },
    });
    if (!existing) return null;

    if (existing.weighing_event.status === 'CONFIRMED') {
      const err = new Error('Cannot delete assets from a confirmed weighing event');
      err.statusCode = 409;
      throw err;
    }

    await tx.asset.delete({ where: { id } });

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'Asset',
      entityId: id,
      before: { asset_label: existing.asset_label, skip_type: existing.skip_type },
    }, tx);

    return existing;
  });
}

module.exports = { getAsset, listAssets, createAsset, updateAsset, deleteAsset };
