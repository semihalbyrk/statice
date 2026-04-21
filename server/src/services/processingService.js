const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const {
  PROCESSING_RECORD_INCLUDE,
  roundWeight,
  sumOutcomeWeight,
  updateSessionWorkflowStates,
  finalizeSessionIfComplete,
} = require('./sortingWorkflowService');
const {
  mapProcessingRecordForResponse,
  mapFractionForResponse,
} = require('./catalogueService');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function roundPct(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function mapOutcomeForResponse(outcome) {
  if (!outcome) return outcome;
  return {
    ...outcome,
    fraction: mapFractionForResponse(outcome.fraction),
    material_fraction: outcome.fraction?.name || outcome.material_fraction,
  };
}

function mapRecordForResponse(record) {
  if (!record) return record;
  return {
    ...mapProcessingRecordForResponse(record),
    outcomes: (record.outcomes || []).map(mapOutcomeForResponse),
  };
}

function buildLegacyRoutePercentages(treatmentRoute) {
  switch (treatmentRoute) {
    case 'REUSED':
      return {
        prepared_for_reuse_pct: 100,
        recycling_pct: 0,
        other_material_recovery_pct: 0,
        energy_recovery_pct: 0,
        thermal_disposal_pct: 0,
      };
    case 'DISPOSED':
      return {
        prepared_for_reuse_pct: 0,
        recycling_pct: 0,
        other_material_recovery_pct: 50,
        energy_recovery_pct: 0,
        thermal_disposal_pct: 50,
      };
    case 'RECYCLED':
    default:
      return {
        prepared_for_reuse_pct: 0,
        recycling_pct: 100,
        other_material_recovery_pct: 0,
        energy_recovery_pct: 0,
        thermal_disposal_pct: 0,
      };
  }
}

function normaliseOutcomePayload(data, record, fraction) {
  const weightKg = Number(data.weight_kg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw createError('weight_kg must be a positive number', 400);
  }

  const percentages = {
    prepared_for_reuse_pct: data.prepared_for_reuse_pct,
    recycling_pct: data.recycling_pct,
    other_material_recovery_pct: data.other_material_recovery_pct,
    energy_recovery_pct: data.energy_recovery_pct,
    thermal_disposal_pct: data.thermal_disposal_pct,
  };

  const hasExplicitPercentages = Object.values(percentages).some((value) => value !== undefined && value !== null && value !== '');
  const basePercentages = hasExplicitPercentages
    ? percentages
    : buildLegacyRoutePercentages(data.treatment_route);

  const preparedForReusePct = roundPct(basePercentages.prepared_for_reuse_pct ?? fraction?.prepared_for_reuse_pct_default ?? 0);
  const recyclingPct = roundPct(basePercentages.recycling_pct ?? fraction?.recycling_pct_default ?? 0);
  const otherMaterialRecoveryPct = roundPct(basePercentages.other_material_recovery_pct ?? fraction?.other_material_recovery_pct_default ?? 0);
  const energyRecoveryPct = roundPct(basePercentages.energy_recovery_pct ?? fraction?.energy_recovery_pct_default ?? 0);
  const thermalDisposalPct = roundPct(basePercentages.thermal_disposal_pct ?? fraction?.thermal_disposal_pct_default ?? 0);

  const percentageSum = roundPct(
    preparedForReusePct
    + recyclingPct
    + otherMaterialRecoveryPct
    + energyRecoveryPct
    + thermalDisposalPct
  );
  if (Math.abs(percentageSum - 100) > 0.01) {
    throw createError('Outcome percentage fields must sum to 100', 400);
  }

  const assetNetWeight = Number(record.asset?.net_weight_kg || 0);
  const sharePct = assetNetWeight > 0 ? roundPct((weightKg / assetNetWeight) * 100) : 0;

  return {
    fraction_id: fraction?.id || null,
    material_fraction: fraction?.name || data.material_fraction || '',
    weight_kg: weightKg,
    treatment_route: data.treatment_route || (recyclingPct > 0 ? 'RECYCLED' : preparedForReusePct > 0 ? 'REUSED' : 'DISPOSED'),
    acceptant_stage: data.acceptant_stage || fraction?.default_acceptant_stage || 'FIRST_ACCEPTANT',
    process_description: data.process_description || fraction?.default_process_description || record.material?.default_process_description || null,
    share_pct: sharePct,
    prepared_for_reuse_pct: preparedForReusePct,
    recycling_pct: recyclingPct,
    other_material_recovery_pct: otherMaterialRecoveryPct,
    energy_recovery_pct: energyRecoveryPct,
    thermal_disposal_pct: thermalDisposalPct,
    notes: data.notes || null,
  };
}

async function recalculateRecordBalance(tx, recordId, assetNetWeight) {
  const refreshedOutcomes = await tx.processingOutcomeLine.findMany({
    where: { processing_record_id: recordId },
    select: { weight_kg: true },
  });

  return tx.processingRecord.update({
    where: { id: recordId },
    data: {
      balance_delta_kg: roundWeight(
        refreshedOutcomes.reduce((sum, outcome) => sum + Number(outcome.weight_kg || 0), 0) - Number(assetNetWeight || 0)
      ),
    },
  });
}

async function getSessionRecords(sessionId, assetId) {
  const where = {
    session_id: sessionId,
    is_current: true,
  };
  if (assetId) where.asset_id = assetId;

  const records = await prisma.processingRecord.findMany({
    where,
    include: PROCESSING_RECORD_INCLUDE,
    orderBy: [
      { asset: { asset_label: 'asc' } },
      { created_at: 'asc' },
    ],
  });

  return records.map(mapRecordForResponse);
}

async function getRecordHistory(recordId) {
  const record = await prisma.processingRecord.findUnique({
    where: { id: recordId },
    select: { session_id: true, asset_id: true },
  });
  if (!record) throw createError('Processing record not found', 404);

  const history = await prisma.processingRecord.findMany({
    where: {
      session_id: record.session_id,
      asset_id: record.asset_id,
    },
    include: PROCESSING_RECORD_INCLUDE,
    orderBy: [
      { version_no: 'asc' },
      { created_at: 'asc' },
    ],
  });

  return history.map(mapRecordForResponse);
}

async function validateProcessorCertification(tx, { processor_id, material_id, transfer_date }) {
  const processor = await tx.processor.findUnique({
    where: { id: processor_id },
    include: {
      certificates: {
        where: { is_active: true },
        include: { materials: true },
      },
    },
  });

  if (!processor || !processor.is_active) {
    throw createError('Active downstream processor is required', 400);
  }

  const transferDate = new Date(transfer_date);
  const validCertificate = processor.certificates.find((certificate) => {
    const inDateRange = certificate.valid_from <= transferDate && certificate.valid_to >= transferDate;
    const coversMaterial = certificate.materials.some((scope) => scope.material_id === material_id);
    return inDateRange && coversMaterial;
  });

  if (!validCertificate) {
    throw createError('Processor certificate does not cover this material on the transfer date', 422);
  }

  return {
    processor: {
      id: processor.id,
      name: processor.name,
    },
    valid_certificate_id: validCertificate.id,
  };
}

async function createOutcome(recordId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.processingRecord.findUnique({
      where: { id: recordId },
      include: PROCESSING_RECORD_INCLUDE,
    });
    if (!record) throw createError('Processing record not found', 404);
    if (!record.is_current || record.status !== 'DRAFT') {
      throw createError('Only current draft records can be edited', 409);
    }

    const fractionId = data.fraction_id || null;
    const fraction = fractionId
      ? await tx.fractionMaster.findUnique({ where: { id: fractionId } })
      : null;
    if (fractionId && (!fraction || !fraction.is_active)) {
      throw createError('Active fraction is required', 400);
    }

    // Prevent duplicate fractions within the same processing record
    if (fractionId) {
      const existingOutcome = record.outcomes?.find((o) => o.fraction_id === fractionId);
      if (existingOutcome) {
        throw createError('This fraction is already added to this processing record', 400);
      }
    }

    const payload = normaliseOutcomePayload(data, record, fraction);

    const outcome = await tx.processingOutcomeLine.create({
      data: {
        processing_record_id: recordId,
        ...payload,
      },
      include: PROCESSING_RECORD_INCLUDE.outcomes.include,
    });

    await recalculateRecordBalance(tx, recordId, record.asset.net_weight_kg);

    await updateSessionWorkflowStates(tx, record.session_id);

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'ProcessingOutcomeLine',
      entityId: outcome.id,
      after: outcome,
    }, tx);

    return mapOutcomeForResponse(outcome);
  });
}

async function updateOutcome(outcomeId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.processingOutcomeLine.findUnique({
      where: { id: outcomeId },
      include: {
        processing_record: {
          include: PROCESSING_RECORD_INCLUDE,
        },
      },
    });
    if (!existing) throw createError('Processing outcome not found', 404);
    if (!existing.processing_record.is_current || existing.processing_record.status !== 'DRAFT') {
      throw createError('Only outcomes on current draft records can be edited', 409);
    }

    const fractionId = data.fraction_id !== undefined ? data.fraction_id || null : existing.fraction_id;
    const fraction = fractionId
      ? await tx.fractionMaster.findUnique({ where: { id: fractionId } })
      : null;
    if (fractionId && (!fraction || !fraction.is_active)) {
      throw createError('Active fraction is required', 400);
    }

    const payload = normaliseOutcomePayload({
      ...existing,
      ...data,
      treatment_route: data.treatment_route !== undefined ? data.treatment_route : existing.treatment_route,
      material_fraction: data.material_fraction !== undefined ? data.material_fraction : existing.material_fraction,
    }, existing.processing_record, fraction);

    const updated = await tx.processingOutcomeLine.update({
      where: { id: outcomeId },
      data: payload,
      include: PROCESSING_RECORD_INCLUDE.outcomes.include,
    });

    await recalculateRecordBalance(tx, existing.processing_record_id, existing.processing_record.asset.net_weight_kg);

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'ProcessingOutcomeLine',
      entityId: outcomeId,
      before: existing,
      after: updated,
    }, tx);

    return mapOutcomeForResponse(updated);
  });
}

async function deleteOutcome(outcomeId, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.processingOutcomeLine.findUnique({
      where: { id: outcomeId },
      include: {
        processing_record: {
          include: PROCESSING_RECORD_INCLUDE,
        },
      },
    });
    if (!existing) throw createError('Processing outcome not found', 404);
    if (!existing.processing_record.is_current || existing.processing_record.status !== 'DRAFT') {
      throw createError('Only outcomes on current draft records can be edited', 409);
    }

    await tx.processingOutcomeLine.delete({ where: { id: outcomeId } });
    await recalculateRecordBalance(tx, existing.processing_record_id, existing.processing_record.asset.net_weight_kg);

    await writeAuditLog({
      userId,
      action: 'DELETE',
      entityType: 'ProcessingOutcomeLine',
      entityId: outcomeId,
      before: existing,
    }, tx);

    return { success: true };
  });
}

async function finalizeAsset(sessionId, assetId, userId) {
  return prisma.$transaction(async (tx) => {
    const [session, asset, records, catalogueEntries] = await Promise.all([
      tx.sortingSession.findUnique({
        where: { id: sessionId },
        select: { id: true, inbound_id: true, status: true },
      }),
      tx.asset.findUnique({
        where: { id: assetId },
        select: { id: true, inbound_id: true, asset_label: true, net_weight_kg: true },
      }),
      tx.processingRecord.findMany({
        where: {
          session_id: sessionId,
          asset_id: assetId,
          is_current: true,
        },
        include: PROCESSING_RECORD_INCLUDE,
      }),
      tx.assetCatalogueEntry.findMany({
        where: { session_id: sessionId, asset_id: assetId },
        select: { id: true },
      }),
    ]);

    if (!session) throw createError('Sorting session not found', 404);
    if (!asset || asset.inbound_id !== session.inbound_id) throw createError('Asset does not belong to this session', 400);

    // Fase 1 only path: no processing records -> require catalogue entries and short-circuit.
    if (records.length === 0) {
      if (catalogueEntries.length === 0) {
        throw createError('Create at least one catalogue entry before finalizing', 409);
      }

      await updateSessionWorkflowStates(tx, sessionId);
      await writeAuditLog({
        userId,
        action: 'FINALIZE',
        entityType: 'Asset',
        entityId: assetId,
        after: { session_id: sessionId, mode: 'FASE1_ONLY' },
      }, tx);

      return {
        asset_id: assetId,
        session_id: sessionId,
        balance_delta_kg: null,
        status: 'FINALIZED',
        mode: 'FASE1_ONLY',
      };
    }

    const totalOutcomeWeight = records.reduce((sum, record) => sum + sumOutcomeWeight(record.outcomes), 0);
    const delta = roundWeight(totalOutcomeWeight - Number(asset.net_weight_kg || 0));
    // Balance gap is no longer a hard block; it is surfaced to the UI and captured in balance_delta_kg.

    for (const record of records) {
      if (record.outcomes.length === 0) {
        throw createError(`Processing record ${record.id} has no outcome lines`, 409);
      }
      for (const outcome of record.outcomes) {
        const pctSum = roundPct(
          Number(outcome.prepared_for_reuse_pct || 0)
          + Number(outcome.recycling_pct || 0)
          + Number(outcome.other_material_recovery_pct || 0)
          + Number(outcome.energy_recovery_pct || 0)
          + Number(outcome.thermal_disposal_pct || 0)
        );
        if (Math.abs(pctSum - 100) > 0.01) {
          throw createError('Each processing outcome must have percentage fields that sum to 100', 400);
        }
        if (!outcome.fraction_id) {
          throw createError('Each processing outcome must reference a fraction', 400);
        }
      }
    }

    await tx.processingRecord.updateMany({
      where: {
        session_id: sessionId,
        asset_id: assetId,
        is_current: true,
      },
      data: {
        status: 'FINALIZED',
        finalized_by: userId,
        finalized_at: new Date(),
        balance_delta_kg: delta,
      },
    });

    await updateSessionWorkflowStates(tx, sessionId);

    await writeAuditLog({
      userId,
      action: 'FINALIZE',
      entityType: 'Asset',
      entityId: assetId,
      after: { session_id: sessionId, delta_kg: delta },
    }, tx);

    return {
      asset_id: assetId,
      session_id: sessionId,
      balance_delta_kg: delta,
      status: 'FINALIZED',
    };
  });
}

async function confirmAsset(sessionId, assetId, userId) {
  return prisma.$transaction(async (tx) => {
    const records = await tx.processingRecord.findMany({
      where: {
        session_id: sessionId,
        asset_id: assetId,
        is_current: true,
      },
      include: PROCESSING_RECORD_INCLUDE,
    });

    if (records.length === 0) throw createError('Processing records not found', 404);
    if (records.some((record) => record.status !== 'FINALIZED')) {
      throw createError('Finalize all processing records before compliance confirmation', 409);
    }

    await tx.processingRecord.updateMany({
      where: {
        session_id: sessionId,
        asset_id: assetId,
        is_current: true,
      },
      data: {
        status: 'CONFIRMED',
        confirmed_by: userId,
        confirmed_at: new Date(),
      },
    });

    await writeAuditLog({
      userId,
      action: 'CONFIRM',
      entityType: 'Asset',
      entityId: assetId,
      after: { session_id: sessionId, scope: 'processing' },
    }, tx);

    await finalizeSessionIfComplete(tx, sessionId, userId);

    return await getSessionRecords(sessionId, assetId);
  });
}

async function reopenAsset(sessionId, assetId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const reasonCode = data.reason_code || null;
    if (!reasonCode) throw createError('reason_code is required', 400);

    const [session, records] = await Promise.all([
      tx.sortingSession.findUnique({
        where: { id: sessionId },
        include: {
          inbound: {
            select: {
              id: true,
              status: true,
              order: { select: { id: true, status: true } },
            },
          },
        },
      }),
      tx.processingRecord.findMany({
        where: {
          session_id: sessionId,
          asset_id: assetId,
          is_current: true,
        },
        include: PROCESSING_RECORD_INCLUDE,
      }),
    ]);

    if (!session) throw createError('Sorting session not found', 404);
    if (records.length === 0) throw createError('Processing records not found', 404);
    if (!records.every((record) => ['FINALIZED', 'CONFIRMED'].includes(record.status))) {
      throw createError('Only finalized or confirmed records can be reopened', 409);
    }
    if (session.inbound?.order?.status === 'INVOICED' && !data.force) {
      throw createError(
        'Cannot reopen: related order is already INVOICED. Pass force=true as ADMIN to override.',
        409,
      );
    }

    let nextVersion = Math.max(...records.map((record) => record.version_no), 0) + 1;
    for (const record of records) {
      await tx.processingRecord.update({
        where: { id: record.id },
        data: {
          is_current: false,
          status: 'SUPERSEDED',
        },
      });

      const cloned = await tx.processingRecord.create({
        data: {
          session_id: record.session_id,
          asset_id: record.asset_id,
          catalogue_entry_id: record.catalogue_entry_id,
          material_id: record.material_id,
          material_code_snapshot: record.material_code_snapshot,
          material_name_snapshot: record.material_name_snapshot,
          weee_category_snapshot: record.weee_category_snapshot,
          version_no: nextVersion,
          supersedes_id: record.id,
          reason_code: reasonCode,
          reason_notes: data.reason_notes || null,
        },
      });

      for (const outcome of record.outcomes) {
        await tx.processingOutcomeLine.create({
          data: {
            processing_record_id: cloned.id,
            material_fraction: outcome.material_fraction,
            fraction_id: outcome.fraction_id,
            weight_kg: outcome.weight_kg,
            treatment_route: outcome.treatment_route,
            acceptant_stage: outcome.acceptant_stage,
            process_description: outcome.process_description,
            share_pct: outcome.share_pct,
            prepared_for_reuse_pct: outcome.prepared_for_reuse_pct,
            recycling_pct: outcome.recycling_pct,
            other_material_recovery_pct: outcome.other_material_recovery_pct,
            energy_recovery_pct: outcome.energy_recovery_pct,
            thermal_disposal_pct: outcome.thermal_disposal_pct,
            notes: outcome.notes,
          },
        });
      }

      nextVersion += 1;
    }

    await tx.sortingSession.update({
      where: { id: sessionId },
      data: {
        status: 'PLANNED',
        processing_status: 'IN_PROGRESS',
      },
    });

    if (session.inbound?.status === 'SORTED') {
      await tx.inbound.update({
        where: { id: session.inbound.id },
        data: { status: 'READY_FOR_SORTING' },
      });
    }

    await updateSessionWorkflowStates(tx, sessionId);

    await writeAuditLog({
      userId,
      action: 'REOPEN',
      entityType: 'Asset',
      entityId: assetId,
      after: { session_id: sessionId, reason_code: reasonCode, scope: 'processing' },
    }, tx);

    return await getSessionRecords(sessionId, assetId);
  });
}

module.exports = {
  getSessionRecords,
  getRecordHistory,
  validateProcessorCertification,
  createOutcome,
  updateOutcome,
  deleteOutcome,
  finalizeAsset,
  confirmAsset,
  reopenAsset,
};
