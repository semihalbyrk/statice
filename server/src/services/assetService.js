const prisma = require('../utils/prismaClient');
const { generateAssetLabel } = require('../utils/assetLabel');
const { writeAuditLog } = require('../utils/auditLog');

const TERMINAL_STATUSES = ['READY_FOR_SORTING', 'SORTED'];

const ASSET_INCLUDE = {
  waste_stream: {
    select: { id: true, name: true, code: true },
  },
  material_category: {
    select: { id: true, code_cbs: true, description_en: true },
  },
  gross_weighing: {
    select: { id: true, sequence: true, weight_kg: true },
  },
  tare_weighing: {
    select: { id: true, sequence: true, weight_kg: true },
  },
  inbound: {
    include: {
      order: {
        select: {
          id: true,
          order_number: true,
          vehicle_plate: true,
          supplier: { select: { id: true, name: true } },
          carrier: { select: { id: true, name: true } },
        },
      },
      vehicle: {
        select: {
          id: true,
          registration_plate: true,
        },
      },
    },
  },
};

async function refreshOrderReceiptCounts(tx, orderId) {
  const total = await tx.asset.count({
    where: {
      inbound: {
        order_id: orderId,
      },
    },
  });

  await tx.inboundOrder.update({
    where: { id: orderId },
    data: { received_asset_count: total },
  });
}

async function getAsset(id) {
  return prisma.asset.findUnique({
    where: { id },
    include: ASSET_INCLUDE,
  });
}

async function listAssets(inboundId) {
  return prisma.asset.findMany({
    where: { inbound_id: inboundId },
    include: ASSET_INCLUDE,
    orderBy: { sequence: 'asc' },
  });
}

async function createAsset(data, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({
      where: { id: data.inbound_id },
      select: { id: true, status: true, order_id: true },
    });
    if (!inbound) throw new Error('Inbound not found');

    if (TERMINAL_STATUSES.includes(inbound.status)) {
      const err = new Error('Cannot add assets to this inbound');
      err.statusCode = 409;
      throw err;
    }

    const parcelType = data.parcel_type || 'CONTAINER';
    const assetLabel = await generateAssetLabel(tx, parcelType);

    const asset = await tx.asset.create({
      data: {
        asset_label: assetLabel,
        inbound_id: data.inbound_id,
        parcel_type: parcelType,
        container_type: parcelType === 'CONTAINER' ? data.container_type : null,
        material_category_id: data.material_category_id || null,
        waste_stream_id: data.waste_stream_id || null,
        sequence: data.sequence || null,
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
      after: { asset_label: asset.asset_label, parcel_type: asset.parcel_type, container_type: asset.container_type },
    }, tx);

    await refreshOrderReceiptCounts(tx, inbound.order_id);

    return asset;
  });
}

async function updateAsset(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({
      where: { id },
      include: { inbound: { select: { status: true, order_id: true } } },
    });
    if (!existing) return null;

    if (TERMINAL_STATUSES.includes(existing.inbound.status)) {
      const err = new Error('Cannot update assets on this inbound');
      err.statusCode = 409;
      throw err;
    }

    const updateData = {};
    if (data.parcel_type !== undefined) updateData.parcel_type = data.parcel_type;
    if (data.container_type !== undefined) updateData.container_type = data.container_type;
    if (data.material_category_id !== undefined) updateData.material_category_id = data.material_category_id || null;
    if (data.waste_stream_id !== undefined) updateData.waste_stream_id = data.waste_stream_id || null;
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
      before: { parcel_type: existing.parcel_type, container_type: existing.container_type },
      after: { parcel_type: updated.parcel_type, container_type: updated.container_type },
    }, tx);

    return updated;
  });
}

async function deleteAsset(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({
      where: { id },
      include: { inbound: { select: { status: true } } },
    });
    if (!existing) return null;

    if (TERMINAL_STATUSES.includes(existing.inbound.status)) {
      const err = new Error('Cannot delete assets from this inbound');
      err.statusCode = 409;
      throw err;
    }

    await tx.asset.delete({ where: { id } });

    await refreshOrderReceiptCounts(tx, existing.inbound.order_id);

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'Asset',
      entityId: id,
      before: { asset_label: existing.asset_label, parcel_type: existing.parcel_type },
    }, tx);

    return existing;
  });
}

async function lookupByLabel(label) {
  return prisma.asset.findUnique({
    where: { asset_label: label },
    include: ASSET_INCLUDE,
  });
}

async function lookupByContainerLabel(label) {
  return prisma.asset.findFirst({
    where: { container_label: label },
    orderBy: { created_at: 'desc' },
    include: ASSET_INCLUDE,
  });
}

async function listAllAssets(query = {}) {
  const { search, status, page = 1, limit = 20 } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (search) {
    where.asset_label = { contains: search, mode: 'insensitive' };
  }
  if (status) {
    where.inbound = { status };
  }

  const [data, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        ...ASSET_INCLUDE,
        inbound: {
          include: {
            order: {
              select: {
                id: true,
                order_number: true,
                supplier: { select: { id: true, name: true } },
                carrier: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.asset.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum };
}

module.exports = {
  getAsset, listAssets, listAllAssets, createAsset, updateAsset, deleteAsset, lookupByLabel, lookupByContainerLabel,
};
