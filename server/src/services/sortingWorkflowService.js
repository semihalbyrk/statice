const prisma = require('../utils/prismaClient');
const { canTransition: canInboundTransition } = require('../utils/inboundStateMachine');
const { canTransition: canOrderTransition } = require('../utils/orderStateMachine');
const { writeAuditLog } = require('../utils/auditLog');

const MATERIAL_INCLUDE = {
  waste_stream: { select: { id: true, name: true, code: true } },
  legacy_category: { select: { id: true, code_cbs: true, description_en: true, description_nl: true } },
  fractions: {
    where: { is_active: true },
    include: {
      fraction: {
        select: {
          id: true,
          code: true,
          name: true,
          eural_code: true,
          default_acceptant_stage: true,
          default_process_description: true,
          prepared_for_reuse_pct_default: true,
          recycling_pct_default: true,
          other_material_recovery_pct_default: true,
          energy_recovery_pct_default: true,
          thermal_disposal_pct_default: true,
          landfill_disposal_pct_default: true,
          is_active: true,
        },
      },
    },
    orderBy: { sort_order: 'asc' },
  },
};

const CATALOGUE_ENTRY_INCLUDE = {
  asset: {
    select: {
      id: true,
      asset_label: true,
      parcel_type: true,
      container_type: true,
      net_weight_kg: true,
      waste_stream_id: true,
      material_category_id: true,
    },
  },
  material: {
    include: MATERIAL_INCLUDE,
  },
  reusable_items: true,
};

const PROCESSING_OUTCOME_INCLUDE = {
  fraction: {
    select: {
      id: true,
      code: true,
      name: true,
      eural_code: true,
    },
  },
  downstream_processor: {
    select: {
      id: true,
      name: true,
      environmental_permit_number: true,
    },
  },
};

const PROCESSING_RECORD_INCLUDE = {
  asset: {
    select: {
      id: true,
      asset_label: true,
      parcel_type: true,
      container_type: true,
      net_weight_kg: true,
      waste_stream_id: true,
      material_category_id: true,
    },
  },
  catalogue_entry: {
    include: CATALOGUE_ENTRY_INCLUDE,
  },
  material: {
    include: MATERIAL_INCLUDE,
  },
  outcomes: {
    include: PROCESSING_OUTCOME_INCLUDE,
    orderBy: { created_at: 'asc' },
  },
};

function roundWeight(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundPct(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function sumOutcomeWeight(outcomes = []) {
  return roundWeight(outcomes.reduce((sum, outcome) => sum + Number(outcome.weight_kg || 0), 0));
}

function computeCompatibilityRouteTotals(outcomes = []) {
  return outcomes.reduce((totals, outcome) => {
    const weight = Number(outcome.weight_kg || 0);
    totals.reused += weight * Number(outcome.prepared_for_reuse_pct || 0) / 100;
    totals.recycled += weight * Number(outcome.recycling_pct || 0) / 100;
    totals.disposed += weight * (
      Number(outcome.other_material_recovery_pct || 0)
      + Number(outcome.energy_recovery_pct || 0)
      + Number(outcome.thermal_disposal_pct || 0)
    ) / 100;
    totals.landfill += weight * Number(outcome.landfill_disposal_pct || 0) / 100;
    return totals;
  }, {
    recycled: 0,
    reused: 0,
    disposed: 0,
    landfill: 0,
  });
}

async function getSessionAssets(tx, sessionId) {
  const session = await tx.sortingSession.findUnique({
    where: { id: sessionId },
    select: { inbound_id: true },
  });

  if (!session) return [];

  return tx.asset.findMany({
    where: { inbound_id: session.inbound_id },
    select: { id: true, net_weight_kg: true, material_category_id: true, waste_stream_id: true },
    orderBy: { sequence: 'asc' },
  });
}

async function updateSessionWorkflowStates(tx, sessionId) {
  const [session, assets, catalogueEntries, processingRecords] = await Promise.all([
    tx.sortingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        inbound_id: true,
        order_id: true,
        status: true,
      },
    }),
    getSessionAssets(tx, sessionId),
    tx.assetCatalogueEntry.findMany({
      where: { session_id: sessionId },
      select: { id: true, asset_id: true },
    }),
    tx.processingRecord.findMany({
      where: { session_id: sessionId, is_current: true },
      select: { id: true, asset_id: true, status: true },
    }),
  ]);

  if (!session) return null;

  const assetIds = assets.map((asset) => asset.id);
  const assetIdSet = new Set(assetIds);
  const entryAssets = new Set(catalogueEntries.filter((entry) => assetIdSet.has(entry.asset_id)).map((entry) => entry.asset_id));
  const recordAssets = new Set(processingRecords.filter((record) => assetIdSet.has(record.asset_id)).map((record) => record.asset_id));

  let catalogueStatus = 'NOT_STARTED';
  if (catalogueEntries.length > 0) {
    catalogueStatus = assetIds.length > 0 && assetIds.every((assetId) => entryAssets.has(assetId))
      ? 'COMPLETED'
      : 'IN_PROGRESS';
  }

  let processingStatus = 'NOT_STARTED';
  if (processingRecords.length > 0) {
    processingStatus = assetIds.length > 0
      && assetIds.every((assetId) => recordAssets.has(assetId))
      && processingRecords.every((record) => record.status === 'CONFIRMED')
      ? 'COMPLETED'
      : 'IN_PROGRESS';
  }

  return tx.sortingSession.update({
    where: { id: sessionId },
    data: {
      catalogue_status: catalogueStatus,
      processing_status: processingStatus,
      status: processingStatus === 'COMPLETED' ? 'SORTED' : 'PLANNED',
    },
  });
}

async function resolveLegacyCategoryId(tx, record) {
  if (record.material?.legacy_category?.id) {
    return record.material.legacy_category.id;
  }

  if (record.asset?.material_category_id) {
    return record.asset.material_category_id;
  }

  const fallbackCategory = await tx.productCategory.findFirst({
    where: {
      waste_stream_id: record.material?.waste_stream?.id || record.asset?.waste_stream_id || undefined,
      is_active: true,
    },
    orderBy: { created_at: 'asc' },
    select: { id: true },
  });

  return fallbackCategory?.id || null;
}

async function syncCompatibilitySortingLines(tx, sessionId) {
  const records = await tx.processingRecord.findMany({
    where: {
      session_id: sessionId,
      is_current: true,
      status: 'CONFIRMED',
    },
    include: PROCESSING_RECORD_INCLUDE,
    orderBy: [
      { asset_id: 'asc' },
      { created_at: 'asc' },
    ],
  });

  await tx.sortingLine.deleteMany({ where: { session_id: sessionId } });

  for (const record of records) {
    const totalWeight = sumOutcomeWeight(record.outcomes);
    if (totalWeight <= 0) continue;

    const categoryId = await resolveLegacyCategoryId(tx, record);
    if (!categoryId) continue;

    const routeTotals = computeCompatibilityRouteTotals(record.outcomes);

    await tx.sortingLine.create({
      data: {
        session_id: sessionId,
        asset_id: record.asset_id,
        category_id: categoryId,
        net_weight_kg: totalWeight,
        recycled_pct: roundPct((routeTotals.recycled / totalWeight) * 100),
        reused_pct: roundPct((routeTotals.reused / totalWeight) * 100),
        disposed_pct: roundPct((routeTotals.disposed / totalWeight) * 100),
        landfill_pct: roundPct((routeTotals.landfill / totalWeight) * 100),
        downstream_processor: record.outcomes[0]?.downstream_processor?.name || null,
        downstream_permit_number: record.outcomes[0]?.downstream_processor?.environmental_permit_number || null,
        transfer_date: record.outcomes[0]?.transfer_date || null,
        notes: `Compatibility projection from processing record ${record.id}`,
      },
    });
  }
}

async function finalizeSessionIfComplete(tx, sessionId, userId) {
  const session = await updateSessionWorkflowStates(tx, sessionId);
  if (!session || session.processing_status !== 'COMPLETED') {
    return session;
  }

  const fullSession = await tx.sortingSession.findUnique({
    where: { id: sessionId },
    include: {
      inbound: {
        select: {
          id: true,
          status: true,
          order_id: true,
        },
      },
    },
  });

  await syncCompatibilitySortingLines(tx, sessionId);

  if (fullSession?.inbound && canInboundTransition(fullSession.inbound.status, 'SORTED')) {
    await tx.inbound.update({
      where: { id: fullSession.inbound.id },
      data: { status: 'SORTED' },
    });

    await writeAuditLog({
      userId,
      action: 'STATUS_CHANGE',
      entityType: 'Inbound',
      entityId: fullSession.inbound.id,
      before: { status: fullSession.inbound.status },
      after: { status: 'SORTED', trigger: 'processing_confirmed' },
    }, tx);
  }

  if (fullSession?.inbound?.order_id) {
    const order = await tx.inboundOrder.findUnique({
      where: { id: fullSession.inbound.order_id },
      select: { id: true, status: true },
    });

    if (order && order.status !== 'COMPLETED' && canOrderTransition(order.status, 'COMPLETED')) {
      await tx.inboundOrder.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
      });

      await writeAuditLog({
        userId,
        action: 'STATUS_CHANGE',
        entityType: 'InboundOrder',
        entityId: order.id,
        before: { status: order.status },
        after: { status: 'COMPLETED', trigger: 'processing_confirmed' },
      }, tx);

      await writeAuditLog({
        userId,
        action: 'ASSEMBLE_INVOICE_BASIS',
        entityType: 'SortingSession',
        entityId: sessionId,
        after: { order_id: order.id, mode: 'compatibility_projection' },
      }, tx);
    }
  }

  return tx.sortingSession.findUnique({
    where: { id: sessionId },
  });
}

module.exports = {
  MATERIAL_INCLUDE,
  CATALOGUE_ENTRY_INCLUDE,
  PROCESSING_RECORD_INCLUDE,
  roundWeight,
  sumOutcomeWeight,
  computeCompatibilityRouteTotals,
  updateSessionWorkflowStates,
  syncCompatibilitySortingLines,
  finalizeSessionIfComplete,
};
