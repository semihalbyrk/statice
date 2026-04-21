const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { generateOutboundParcelLabel } = require('../utils/outboundParcelNumber');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notFound(message = 'Outbound parcel not found') {
  const err = new Error(message);
  err.statusCode = 404;
  throw err;
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

const PARCEL_INCLUDE = {
  material: true,
  outbound: {
    include: {
      outbound_order: {
        include: { buyer: true },
      },
    },
  },
};

const PARCEL_DETAIL_INCLUDE = {
  material: true,
  outbound: {
    include: {
      outbound_order: {
        include: { buyer: true },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// createParcel
// ---------------------------------------------------------------------------

async function createParcel(data, userId) {
  return prisma.$transaction(async (tx) => {
    // Validate material exists and is active
    const material = await tx.materialMaster.findUnique({
      where: { id: data.material_id },
    });
    if (!material) badRequest('Material not found');
    if (!material.is_active) badRequest('Material is not active');

    const parcelLabel = await generateOutboundParcelLabel(tx);

    const parcel = await tx.outboundParcel.create({
      data: {
        parcel_label: parcelLabel,
        material_id: data.material_id,
        container_type: data.container_type,
        volume_m3: data.volume_m3 ?? null,
        description: data.description || null,
        notes: data.notes || null,
        status: 'AVAILABLE',
        created_by: userId,
      },
      include: PARCEL_INCLUDE,
    });

    await writeAuditLog(
      {
        userId,
        action: 'CREATE',
        entityType: 'OutboundParcel',
        entityId: parcel.id,
        after: {
          parcel_label: parcel.parcel_label,
          material_id: parcel.material_id,
          container_type: parcel.container_type,
        },
      },
      tx
    );

    return parcel;
  });
}

// ---------------------------------------------------------------------------
// listParcels
// ---------------------------------------------------------------------------

async function listParcels(query = {}) {
  const {
    status,
    materialId,
    outboundId,
    search,
    page = 1,
    limit = 20,
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (status) where.status = status;
  if (materialId) where.material_id = materialId;
  if (outboundId) where.outbound_id = outboundId;
  if (search) {
    where.parcel_label = { contains: search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.outboundParcel.findMany({
      where,
      include: PARCEL_INCLUDE,
      orderBy: { created_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.outboundParcel.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum };
}

// ---------------------------------------------------------------------------
// getParcel
// ---------------------------------------------------------------------------

async function getParcel(id) {
  const parcel = await prisma.outboundParcel.findUnique({
    where: { id },
    include: PARCEL_DETAIL_INCLUDE,
  });

  if (!parcel) notFound();
  return parcel;
}

// ---------------------------------------------------------------------------
// updateParcel
// ---------------------------------------------------------------------------

async function updateParcel(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const parcel = await tx.outboundParcel.findUnique({ where: { id } });
    if (!parcel) notFound();

    if (parcel.status === 'SHIPPED') {
      badRequest('Cannot update a SHIPPED parcel');
    }

    if (data.material_id && data.material_id !== parcel.material_id) {
      badRequest('Cannot change material_id after creation');
    }

    const updateData = {};
    if (data.container_type !== undefined) updateData.container_type = data.container_type;
    if (data.volume_m3 !== undefined) updateData.volume_m3 = data.volume_m3;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await tx.outboundParcel.update({
      where: { id },
      data: updateData,
      include: PARCEL_INCLUDE,
    });

    await writeAuditLog(
      {
        userId,
        action: 'UPDATE',
        entityType: 'OutboundParcel',
        entityId: id,
        before: { container_type: parcel.container_type, volume_m3: parcel.volume_m3 },
        after: updateData,
      },
      tx
    );

    return updated;
  });
}

// ---------------------------------------------------------------------------
// deleteParcel
// ---------------------------------------------------------------------------

async function deleteParcel(id, userId) {
  return prisma.$transaction(async (tx) => {
    const parcel = await tx.outboundParcel.findUnique({ where: { id } });
    if (!parcel) notFound();

    if (parcel.status !== 'AVAILABLE') {
      badRequest('Can only delete AVAILABLE parcels');
    }

    await tx.outboundParcel.delete({ where: { id } });

    await writeAuditLog(
      {
        userId,
        action: 'DELETE',
        entityType: 'OutboundParcel',
        entityId: id,
        before: { parcel_label: parcel.parcel_label, status: parcel.status },
      },
      tx
    );
  });
}

// ---------------------------------------------------------------------------
// attachToOutbound
// ---------------------------------------------------------------------------

async function attachToOutbound(outboundId, parcelIds, userId) {
  if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
    badRequest('parcelIds must be a non-empty array');
  }

  return prisma.$transaction(async (tx) => {
    const outbound = await tx.outbound.findUnique({ where: { id: outboundId } });
    if (!outbound) {
      const err = new Error('Outbound not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['CREATED', 'LOADING'].includes(outbound.status)) {
      badRequest(`Cannot attach parcels to outbound in status ${outbound.status}`);
    }

    // Validate all parcels exist and are AVAILABLE
    const parcels = await tx.outboundParcel.findMany({
      where: { id: { in: parcelIds } },
    });

    if (parcels.length !== parcelIds.length) {
      badRequest('One or more parcels not found');
    }

    const nonAvailable = parcels.filter((p) => p.status !== 'AVAILABLE');
    if (nonAvailable.length > 0) {
      badRequest(
        `Parcels must be AVAILABLE to attach. Non-available: ${nonAvailable.map((p) => p.parcel_label).join(', ')}`
      );
    }

    await tx.outboundParcel.updateMany({
      where: { id: { in: parcelIds } },
      data: { outbound_id: outboundId, status: 'ASSIGNED' },
    });

    await writeAuditLog(
      {
        userId,
        action: 'ATTACH_PARCELS',
        entityType: 'Outbound',
        entityId: outboundId,
        after: { parcel_ids: parcelIds, count: parcelIds.length },
      },
      tx
    );

    return tx.outboundParcel.findMany({
      where: { outbound_id: outboundId },
      include: PARCEL_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// detachFromOutbound
// ---------------------------------------------------------------------------

async function detachFromOutbound(outboundId, parcelId, userId) {
  return prisma.$transaction(async (tx) => {
    const outbound = await tx.outbound.findUnique({ where: { id: outboundId } });
    if (!outbound) {
      const err = new Error('Outbound not found');
      err.statusCode = 404;
      throw err;
    }

    if (!['CREATED', 'LOADING'].includes(outbound.status)) {
      badRequest(`Cannot detach parcels from outbound in status ${outbound.status}`);
    }

    const parcel = await tx.outboundParcel.findUnique({ where: { id: parcelId } });
    if (!parcel) notFound();

    if (parcel.outbound_id !== outboundId) {
      badRequest('Parcel is not attached to this outbound');
    }

    if (parcel.status !== 'ASSIGNED') {
      badRequest('Only ASSIGNED parcels can be detached');
    }

    await tx.outboundParcel.update({
      where: { id: parcelId },
      data: { outbound_id: null, status: 'AVAILABLE' },
    });

    await writeAuditLog(
      {
        userId,
        action: 'DETACH_PARCEL',
        entityType: 'Outbound',
        entityId: outboundId,
        after: { parcel_id: parcelId, parcel_label: parcel.parcel_label },
      },
      tx
    );
  });
}

// ---------------------------------------------------------------------------
// listByOutbound
// ---------------------------------------------------------------------------

async function listByOutbound(outboundId) {
  const parcels = await prisma.outboundParcel.findMany({
    where: { outbound_id: outboundId },
    include: PARCEL_INCLUDE,
    orderBy: { created_at: 'asc' },
  });
  return { data: parcels, total: parcels.length };
}

module.exports = {
  createParcel,
  listParcels,
  getParcel,
  updateParcel,
  deleteParcel,
  attachToOutbound,
  detachFromOutbound,
  listByOutbound,
};
