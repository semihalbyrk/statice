const prisma = require('../utils/prismaClient');
const { generateAssetLabel } = require('../utils/assetLabel');
const { writeAuditLog } = require('../utils/auditLog');

const TERMINAL_STATUSES = ['READY_FOR_SORTING', 'SORTED'];

const ASSET_INCLUDE = {
  waste_stream: {
    select: { id: true, name_en: true, code: true },
  },
  inbound: {
    select: { id: true, status: true, order_id: true, waste_stream_id: true },
  },
};

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
    orderBy: { created_at: 'asc' },
  });
}

async function createAsset(data, userId) {
  return prisma.$transaction(async (tx) => {
    const inbound = await tx.inbound.findUnique({ where: { id: data.inbound_id } });
    if (!inbound) throw new Error('Inbound not found');

    if (TERMINAL_STATUSES.includes(inbound.status)) {
      const err = new Error('Cannot add assets to this inbound');
      err.statusCode = 409;
      throw err;
    }

    const assetLabel = await generateAssetLabel(tx);

    const asset = await tx.asset.create({
      data: {
        asset_label: assetLabel,
        inbound_id: data.inbound_id,
        skip_type: data.skip_type,
        waste_stream_id: data.waste_stream_id || null,
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
      after: { asset_label: asset.asset_label, inbound_id: asset.inbound_id, skip_type: asset.skip_type },
    }, tx);

    return asset;
  });
}

async function updateAsset(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({
      where: { id },
      include: { inbound: { select: { status: true } } },
    });
    if (!existing) return null;

    if (TERMINAL_STATUSES.includes(existing.inbound.status)) {
      const err = new Error('Cannot update assets on this inbound');
      err.statusCode = 409;
      throw err;
    }

    const updateData = {};
    if (data.skip_type !== undefined) updateData.skip_type = data.skip_type;
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
      before: { skip_type: existing.skip_type, waste_stream_id: existing.waste_stream_id },
      after: { skip_type: updated.skip_type, waste_stream_id: updated.waste_stream_id },
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

async function setAssetGrossWeight(assetId, weightKg, userId) {
  const weight = parseFloat(weightKg);
  if (isNaN(weight) || weight <= 0) {
    const err = new Error('Gross weight must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: { inbound: { select: { id: true, status: true } } },
    });
    if (!asset) throw new Error('Asset not found');

    if (TERMINAL_STATUSES.includes(asset.inbound.status)) {
      const err = new Error('Cannot update weights on this inbound');
      err.statusCode = 409;
      throw err;
    }

    const updateData = { gross_weight_kg: weight };
    if (asset.tare_weight_kg != null) {
      updateData.net_weight_kg = weight - Number(asset.tare_weight_kg);
    }

    const updated = await tx.asset.update({
      where: { id: assetId },
      data: updateData,
      include: ASSET_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'SET_GROSS_WEIGHT',
      entityType: 'Asset',
      entityId: assetId,
      before: { gross_weight_kg: asset.gross_weight_kg ? Number(asset.gross_weight_kg) : null },
      after: { gross_weight_kg: weight },
    }, tx);

    return updated;
  });
}

async function setAssetTareWeight(assetId, weightKg, userId) {
  const weight = parseFloat(weightKg);
  if (isNaN(weight) || weight <= 0) {
    const err = new Error('Tare weight must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      include: { inbound: { select: { id: true, status: true } } },
    });
    if (!asset) throw new Error('Asset not found');

    if (TERMINAL_STATUSES.includes(asset.inbound.status)) {
      const err = new Error('Cannot update weights on this inbound');
      err.statusCode = 409;
      throw err;
    }

    if (asset.gross_weight_kg == null) {
      const err = new Error('Gross weight must be set before tare weight');
      err.statusCode = 400;
      throw err;
    }

    const grossKg = Number(asset.gross_weight_kg);
    const netKg = grossKg - weight;

    const updated = await tx.asset.update({
      where: { id: assetId },
      data: { tare_weight_kg: weight, net_weight_kg: netKg },
      include: ASSET_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'SET_TARE_WEIGHT',
      entityType: 'Asset',
      entityId: assetId,
      before: { tare_weight_kg: asset.tare_weight_kg ? Number(asset.tare_weight_kg) : null },
      after: { tare_weight_kg: weight, net_weight_kg: netKg },
    }, tx);

    return updated;
  });
}

module.exports = {
  getAsset, listAssets, createAsset, updateAsset, deleteAsset,
  setAssetGrossWeight, setAssetTareWeight,
};
