const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const {
  MATERIAL_INCLUDE,
  CATALOGUE_ENTRY_INCLUDE,
  PROCESSING_RECORD_INCLUDE,
  updateSessionWorkflowStates,
} = require('./sortingWorkflowService');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapMaterialForResponse(material) {
  if (!material) return material;
  return {
    ...material,
    label_en: material.name,
    annex_iii_category: material.weee_category,
  };
}

function mapFractionForResponse(fraction) {
  if (!fraction) return fraction;
  return {
    ...fraction,
    label_en: fraction.name,
  };
}

function mapMaterialFractionForResponse(link) {
  if (!link) return link;
  return {
    ...link,
    fraction: mapFractionForResponse(link.fraction),
  };
}

function mapCatalogueEntryForResponse(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    product_type_id: entry.material_id,
    material: mapMaterialForResponse(entry.material),
    product_type: mapMaterialForResponse(entry.material),
  };
}

function mapProcessingRecordForResponse(record) {
  if (!record) return record;
  return {
    ...record,
    product_type_id: record.material_id,
    product_code_snapshot: record.material_code_snapshot,
    product_label_snapshot: record.material_name_snapshot,
    annex_iii_category_snapshot: record.weee_category_snapshot,
    material: mapMaterialForResponse(record.material),
  };
}

function buildMaterialSnapshot(material) {
  return {
    material_id: material.id,
    material_code_snapshot: material.code,
    material_name_snapshot: material.name,
    weee_category_snapshot: material.weee_category,
  };
}

function buildMaterialWhere({ active, waste_stream_id, search }) {
  const where = {};
  if (active !== undefined) where.is_active = active === 'true';
  if (waste_stream_id) where.waste_stream_id = waste_stream_id;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { cbs_code: { contains: search, mode: 'insensitive' } },
      { eural_code: { contains: search, mode: 'insensitive' } },
      { weee_category: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

async function listMaterials(filters = {}) {
  const materials = await prisma.materialMaster.findMany({
    where: buildMaterialWhere(filters),
    include: MATERIAL_INCLUDE,
    orderBy: [
      { waste_stream: { name: 'asc' } },
      { code: 'asc' },
    ],
  });

  return materials.map((material) => ({
    ...mapMaterialForResponse(material),
    fractions: material.fractions.map(mapMaterialFractionForResponse),
  }));
}

async function createMaterial(data, userId) {
  return prisma.$transaction(async (tx) => {
    const material = await tx.materialMaster.create({
      data: {
        code: data.code,
        name: data.name || data.name_en || data.label_en,
        waste_stream_id: data.waste_stream_id,
        cbs_code: data.cbs_code,
        weeelabex_group: data.weeelabex_group,
        eural_code: data.eural_code,
        weee_category: data.weee_category || data.annex_iii_category,
        legacy_category_id: data.legacy_category_id || null,
        default_process_description: data.default_process_description || null,
        is_active: data.is_active ?? true,
      },
      include: MATERIAL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'MaterialMaster',
      entityId: material.id,
      after: material,
    }, tx);

    return mapMaterialForResponse(material);
  });
}

async function updateMaterial(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.materialMaster.findUnique({
      where: { id },
      include: MATERIAL_INCLUDE,
    });
    if (!existing) throw createError('Material not found', 404);

    const updated = await tx.materialMaster.update({
      where: { id },
      data: {
        code: data.code ?? existing.code,
        name: data.name ?? data.name_en ?? data.label_en ?? existing.name,
        waste_stream_id: data.waste_stream_id ?? existing.waste_stream_id,
        cbs_code: data.cbs_code ?? existing.cbs_code,
        weeelabex_group: data.weeelabex_group ?? existing.weeelabex_group,
        eural_code: data.eural_code ?? existing.eural_code,
        weee_category: data.weee_category ?? data.annex_iii_category ?? existing.weee_category,
        legacy_category_id: data.legacy_category_id !== undefined ? data.legacy_category_id || null : existing.legacy_category_id,
        default_process_description: data.default_process_description !== undefined
          ? data.default_process_description || null
          : existing.default_process_description,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active,
      },
      include: MATERIAL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'MaterialMaster',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return mapMaterialForResponse(updated);
  });
}

async function listFractions({ active, material_id, search } = {}) {
  const where = {};
  if (active !== undefined) where.is_active = active === 'true';
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { eural_code: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (material_id) {
    where.materials = {
      some: {
        material_id,
        is_active: true,
      },
    };
  }

  const fractions = await prisma.fractionMaster.findMany({
    where,
    include: {
      materials: {
        where: { is_active: true },
        select: { id: true, material_id: true, sort_order: true, is_active: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  return fractions.map(mapFractionForResponse);
}

async function createFraction(data, userId) {
  return prisma.$transaction(async (tx) => {
    const fraction = await tx.fractionMaster.create({
      data: {
        code: data.code,
        name: data.name || data.name_en || data.label_en,
        eural_code: data.eural_code,
        default_acceptant_stage: data.default_acceptant_stage || 'FIRST_ACCEPTANT',
        default_process_description: data.default_process_description || null,
        prepared_for_reuse_pct_default: data.prepared_for_reuse_pct_default ?? 0,
        recycling_pct_default: data.recycling_pct_default ?? 0,
        other_material_recovery_pct_default: data.other_material_recovery_pct_default ?? 0,
        energy_recovery_pct_default: data.energy_recovery_pct_default ?? 0,
        thermal_disposal_pct_default: data.thermal_disposal_pct_default ?? 0,
        landfill_disposal_pct_default: data.landfill_disposal_pct_default ?? 0,
        is_active: data.is_active ?? true,
      },
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'FractionMaster',
      entityId: fraction.id,
      after: fraction,
    }, tx);

    return mapFractionForResponse(fraction);
  });
}

async function updateFraction(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fractionMaster.findUnique({ where: { id } });
    if (!existing) throw createError('Fraction not found', 404);

    const updated = await tx.fractionMaster.update({
      where: { id },
      data: {
        code: data.code ?? existing.code,
        name: data.name ?? data.name_en ?? data.label_en ?? existing.name,
        eural_code: data.eural_code ?? existing.eural_code,
        default_acceptant_stage: data.default_acceptant_stage ?? existing.default_acceptant_stage,
        default_process_description: data.default_process_description !== undefined
          ? data.default_process_description || null
          : existing.default_process_description,
        prepared_for_reuse_pct_default: data.prepared_for_reuse_pct_default ?? existing.prepared_for_reuse_pct_default,
        recycling_pct_default: data.recycling_pct_default ?? existing.recycling_pct_default,
        other_material_recovery_pct_default: data.other_material_recovery_pct_default ?? existing.other_material_recovery_pct_default,
        energy_recovery_pct_default: data.energy_recovery_pct_default ?? existing.energy_recovery_pct_default,
        thermal_disposal_pct_default: data.thermal_disposal_pct_default ?? existing.thermal_disposal_pct_default,
        landfill_disposal_pct_default: data.landfill_disposal_pct_default ?? existing.landfill_disposal_pct_default,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active,
      },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'FractionMaster',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return mapFractionForResponse(updated);
  });
}

async function upsertMaterialFractions(materialId, fractionIds, userId) {
  return prisma.$transaction(async (tx) => {
    const material = await tx.materialMaster.findUnique({ where: { id: materialId } });
    if (!material) throw createError('Material not found', 404);

    const uniqueIds = [...new Set((fractionIds || []).filter(Boolean))];
    const fractions = await tx.fractionMaster.findMany({
      where: { id: { in: uniqueIds }, is_active: true },
      select: { id: true },
    });
    if (fractions.length !== uniqueIds.length) {
      throw createError('All linked fractions must exist and be active', 400);
    }

    await tx.materialFraction.deleteMany({ where: { material_id: materialId } });
    if (uniqueIds.length > 0) {
      await tx.materialFraction.createMany({
        data: uniqueIds.map((fractionId, index) => ({
          material_id: materialId,
          fraction_id: fractionId,
          sort_order: index,
        })),
      });
    }

    const refreshed = await tx.materialMaster.findUnique({
      where: { id: materialId },
      include: MATERIAL_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'MaterialMaster',
      entityId: materialId,
      after: {
        material_id: materialId,
        fraction_ids: uniqueIds,
      },
    }, tx);

    return {
      ...mapMaterialForResponse(refreshed),
      fractions: (refreshed?.fractions || []).map(mapMaterialFractionForResponse),
    };
  });
}

async function listSessionEntries(sessionId, assetId) {
  const where = { session_id: sessionId };
  if (assetId) where.asset_id = assetId;

  const entries = await prisma.assetCatalogueEntry.findMany({
    where,
    include: CATALOGUE_ENTRY_INCLUDE,
    orderBy: [
      { asset: { asset_label: 'asc' } },
      { entry_order: 'asc' },
      { created_at: 'asc' },
    ],
  });

  return entries.map(mapCatalogueEntryForResponse);
}

async function createEntry(sessionId, assetId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const materialId = data.material_id || data.product_type_id;
    const [session, asset, material] = await Promise.all([
      tx.sortingSession.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true, inbound_id: true },
      }),
      tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, inbound_id: true },
      }),
      tx.materialMaster.findUnique({
        where: { id: materialId },
        include: MATERIAL_INCLUDE,
      }),
    ]);

    if (!session) throw createError('Sorting session not found', 404);
    if (session.status !== 'PLANNED') throw createError('Session is locked', 409);
    if (!asset || asset.inbound_id !== session.inbound_id) throw createError('Asset does not belong to this session', 400);
    if (!material || !material.is_active) throw createError('Active material is required', 400);

    const weightKg = parseFloat(data.weight_kg);
    const reuseEligibleQuantity = parseInt(data.reuse_eligible_quantity || 0, 10);
    if (Number.isNaN(weightKg) || weightKg <= 0) {
      throw createError('weight_kg must be greater than 0', 400);
    }
    if (Number.isNaN(reuseEligibleQuantity) || reuseEligibleQuantity < 0) {
      throw createError('reuse_eligible_quantity must be 0 or greater', 400);
    }

    const lastEntry = await tx.assetCatalogueEntry.findFirst({
      where: { session_id: sessionId, asset_id: assetId },
      orderBy: { entry_order: 'desc' },
      select: { entry_order: true },
    });

    const entry = await tx.assetCatalogueEntry.create({
      data: {
        session_id: sessionId,
        asset_id: assetId,
        material_id: material.id,
        weight_kg: weightKg,
        reuse_eligible_quantity: reuseEligibleQuantity,
        notes: data.notes || null,
        entry_order: data.entry_order !== undefined ? parseInt(data.entry_order, 10) : (lastEntry?.entry_order || 0) + 1,
      },
      include: CATALOGUE_ENTRY_INCLUDE,
    });

    // Auto-create reusable items if reuse_eligible_quantity > 0
    if (reuseEligibleQuantity > 0) {
      await tx.reusableItem.createMany({
        data: Array.from({ length: reuseEligibleQuantity }, () => ({
          catalogue_entry_id: entry.id,
          material_id: material.id,
        })),
      });
    }

    const processingRecord = await tx.processingRecord.create({
      data: {
        session_id: sessionId,
        asset_id: assetId,
        catalogue_entry_id: entry.id,
        ...buildMaterialSnapshot(material),
      },
      include: PROCESSING_RECORD_INCLUDE,
    });

    await updateSessionWorkflowStates(tx, sessionId);

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'AssetCatalogueEntry',
      entityId: entry.id,
      after: { ...entry, processing_record_id: processingRecord.id },
    }, tx);

    return mapCatalogueEntryForResponse(entry);
  });
}

async function updateEntry(entryId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetCatalogueEntry.findUnique({
      where: { id: entryId },
      include: {
        ...CATALOGUE_ENTRY_INCLUDE,
        processing_records: {
          where: { is_current: true },
          include: { outcomes: true },
        },
      },
    });
    if (!existing) throw createError('Catalogue entry not found', 404);

    const activeRecord = existing.processing_records[0] || null;
    if (activeRecord && activeRecord.status !== 'DRAFT') {
      throw createError('Confirmed or finalized catalogue entries must be versioned from processing', 409);
    }

    let material = existing.material;
    const incomingMaterialId = data.material_id || data.product_type_id;
    if (incomingMaterialId && incomingMaterialId !== existing.material_id) {
      material = await tx.materialMaster.findUnique({
        where: { id: incomingMaterialId },
        include: MATERIAL_INCLUDE,
      });
      if (!material || !material.is_active) throw createError('Active material is required', 400);
    }

    const weightKg = data.weight_kg !== undefined
      ? parseFloat(data.weight_kg)
      : Number(existing.weight_kg);
    const reuseEligibleQuantity = data.reuse_eligible_quantity !== undefined
      ? parseInt(data.reuse_eligible_quantity, 10)
      : existing.reuse_eligible_quantity;

    if (Number.isNaN(weightKg) || weightKg <= 0) {
      throw createError('weight_kg must be greater than 0', 400);
    }
    if (Number.isNaN(reuseEligibleQuantity) || reuseEligibleQuantity < 0) {
      throw createError('reuse_eligible_quantity must be 0 or greater', 400);
    }

    const updated = await tx.assetCatalogueEntry.update({
      where: { id: entryId },
      data: {
        material_id: material.id,
        weight_kg: weightKg,
        reuse_eligible_quantity: reuseEligibleQuantity,
        notes: data.notes !== undefined ? data.notes || null : existing.notes,
        entry_order: data.entry_order !== undefined ? parseInt(data.entry_order, 10) : existing.entry_order,
      },
      include: CATALOGUE_ENTRY_INCLUDE,
    });

    // Sync reusable items count
    const currentReusables = await tx.reusableItem.count({ where: { catalogue_entry_id: entryId } });
    if (reuseEligibleQuantity > currentReusables) {
      await tx.reusableItem.createMany({
        data: Array.from({ length: reuseEligibleQuantity - currentReusables }, () => ({
          catalogue_entry_id: entryId,
          material_id: material.id,
        })),
      });
    } else if (reuseEligibleQuantity < currentReusables) {
      const toDelete = await tx.reusableItem.findMany({
        where: { catalogue_entry_id: entryId },
        orderBy: { created_at: 'desc' },
        take: currentReusables - reuseEligibleQuantity,
        select: { id: true },
      });
      await tx.reusableItem.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
    }

    if (activeRecord) {
      await tx.processingRecord.update({
        where: { id: activeRecord.id },
        data: buildMaterialSnapshot(material),
      });
    }

    await updateSessionWorkflowStates(tx, existing.session_id);

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'AssetCatalogueEntry',
      entityId: entryId,
      before: existing,
      after: updated,
    }, tx);

    return mapCatalogueEntryForResponse(updated);
  });
}

async function deleteEntry(entryId, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetCatalogueEntry.findUnique({
      where: { id: entryId },
      include: {
        processing_records: {
          where: { is_current: true },
          include: { outcomes: true },
        },
      },
    });
    if (!existing) throw createError('Catalogue entry not found', 404);

    const activeRecord = existing.processing_records[0] || null;
    if (activeRecord && activeRecord.status !== 'DRAFT') {
      throw createError('Confirmed or finalized catalogue entries must be versioned from processing', 409);
    }

    if (activeRecord) {
      await tx.processingOutcomeLine.deleteMany({
        where: { processing_record_id: activeRecord.id },
      });
      await tx.processingRecord.delete({ where: { id: activeRecord.id } });
    }

    await tx.assetCatalogueEntry.delete({ where: { id: entryId } });
    await updateSessionWorkflowStates(tx, existing.session_id);

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'AssetCatalogueEntry',
      entityId: entryId,
      before: existing,
    }, tx);

    return { success: true };
  });
}

async function listReusableItems(sessionId, assetId) {
  const where = {};
  if (assetId) {
    where.catalogue_entry = { session_id: sessionId, asset_id: assetId };
  } else {
    where.catalogue_entry = { session_id: sessionId };
  }
  return prisma.reusableItem.findMany({
    where,
    include: {
      material: { select: { id: true, code: true, name: true } },
      catalogue_entry: { select: { id: true, asset_id: true } },
    },
    orderBy: { created_at: 'asc' },
  });
}

async function updateReusableItem(id, data) {
  const existing = await prisma.reusableItem.findUnique({ where: { id } });
  if (!existing) {
    throw createError('Reusable item not found', 404);
  }
  return prisma.reusableItem.update({
    where: { id },
    data: {
      brand: data.brand !== undefined ? data.brand || null : existing.brand,
      model_name: data.model_name !== undefined ? data.model_name || null : existing.model_name,
      type: data.type !== undefined ? data.type || null : existing.type,
      serial_number: data.serial_number !== undefined ? data.serial_number || null : existing.serial_number,
      condition: data.condition !== undefined ? data.condition || null : existing.condition,
      notes: data.notes !== undefined ? data.notes || null : existing.notes,
    },
    include: {
      material: { select: { id: true, code: true, name: true } },
      catalogue_entry: { select: { id: true, asset_id: true } },
    },
  });
}

module.exports = {
  listMaterials,
  createMaterial,
  updateMaterial,
  listFractions,
  createFraction,
  updateFraction,
  upsertMaterialFractions,
  listSessionEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  listReusableItems,
  updateReusableItem,
  listProductTypes: listMaterials,
  createProductType: createMaterial,
  updateProductType: updateMaterial,
  mapMaterialForResponse,
  mapFractionForResponse,
  mapCatalogueEntryForResponse,
  mapProcessingRecordForResponse,
};
