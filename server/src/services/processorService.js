const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const { validateProcessorCertification } = require('./processingService');
const { mapMaterialForResponse } = require('./catalogueService');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapCertificateScope(scope) {
  return {
    ...scope,
    product_type_id: scope.material_id,
    material: mapMaterialForResponse(scope.material),
    product_type: mapMaterialForResponse(scope.material),
  };
}

function mapCertificate(certificate) {
  return {
    ...certificate,
    materials: (certificate.materials || []).map(mapCertificateScope),
    product_types: (certificate.materials || []).map(mapCertificateScope),
  };
}

const CERTIFICATE_INCLUDE = {
  materials: {
    include: {
      material: {
        select: {
          id: true,
          code: true,
          name: true,
          weee_category: true,
        },
      },
    },
  },
};

const PROCESSOR_INCLUDE = {
  certificates: {
    include: CERTIFICATE_INCLUDE,
    orderBy: { valid_from: 'desc' },
  },
};

async function listProcessors({ active, search }) {
  const where = {};
  if (active !== undefined) where.is_active = active === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { environmental_permit_number: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { country: { contains: search, mode: 'insensitive' } },
    ];
  }

  const processors = await prisma.processor.findMany({
    where,
    include: PROCESSOR_INCLUDE,
    orderBy: { name: 'asc' },
  });

  return processors.map((processor) => ({
    ...processor,
    certificates: processor.certificates.map(mapCertificate),
  }));
}

async function createProcessor(data, userId) {
  return prisma.$transaction(async (tx) => {
    const processor = await tx.processor.create({
      data: {
        name: data.name,
        address: data.address,
        country: data.country,
        environmental_permit_number: data.environmental_permit_number,
        is_weeelabex_listed: Boolean(data.is_weeelabex_listed),
        is_active: data.is_active ?? true,
      },
      include: PROCESSOR_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'Processor',
      entityId: processor.id,
      after: processor,
    }, tx);

    return {
      ...processor,
      certificates: processor.certificates.map(mapCertificate),
    };
  });
}

async function updateProcessor(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.processor.findUnique({
      where: { id },
      include: PROCESSOR_INCLUDE,
    });
    if (!existing) throw createError('Processor not found', 404);

    const updated = await tx.processor.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        address: data.address ?? existing.address,
        country: data.country ?? existing.country,
        environmental_permit_number: data.environmental_permit_number ?? existing.environmental_permit_number,
        is_weeelabex_listed: data.is_weeelabex_listed !== undefined ? Boolean(data.is_weeelabex_listed) : existing.is_weeelabex_listed,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active,
      },
      include: PROCESSOR_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'Processor',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return {
      ...updated,
      certificates: updated.certificates.map(mapCertificate),
    };
  });
}

function resolveMaterialIds(data) {
  if (Array.isArray(data.material_ids)) return data.material_ids;
  if (Array.isArray(data.product_type_ids)) return data.product_type_ids;
  return [];
}

async function createCertificate(processorId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const processor = await tx.processor.findUnique({
      where: { id: processorId },
      select: { id: true, is_active: true },
    });
    if (!processor || !processor.is_active) throw createError('Active processor not found', 404);

    const materialIds = resolveMaterialIds(data);
    if (materialIds.length === 0) {
      throw createError('material_ids is required', 400);
    }

    const certificate = await tx.processorCertificate.create({
      data: {
        processor_id: processorId,
        certificate_number: data.certificate_number,
        certification_body: data.certification_body,
        valid_from: new Date(data.valid_from),
        valid_to: new Date(data.valid_to),
        document_url: data.document_url || null,
        is_active: data.is_active ?? true,
        materials: {
          create: materialIds.map((materialId) => ({
            material_id: materialId,
          })),
        },
      },
      include: CERTIFICATE_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'ProcessorCertificate',
      entityId: certificate.id,
      after: certificate,
    }, tx);

    return mapCertificate(certificate);
  });
}

async function updateCertificate(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.processorCertificate.findUnique({
      where: { id },
      include: CERTIFICATE_INCLUDE,
    });
    if (!existing) throw createError('Processor certificate not found', 404);

    const updated = await tx.processorCertificate.update({
      where: { id },
      data: {
        certificate_number: data.certificate_number ?? existing.certificate_number,
        certification_body: data.certification_body ?? existing.certification_body,
        valid_from: data.valid_from ? new Date(data.valid_from) : existing.valid_from,
        valid_to: data.valid_to ? new Date(data.valid_to) : existing.valid_to,
        document_url: data.document_url !== undefined ? data.document_url || null : existing.document_url,
        is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active,
      },
      include: CERTIFICATE_INCLUDE,
    });

    const materialIds = Array.isArray(data.material_ids) || Array.isArray(data.product_type_ids)
      ? resolveMaterialIds(data)
      : null;
    if (materialIds) {
      await tx.processorCertificateMaterialScope.deleteMany({
        where: { certificate_id: id },
      });
      if (materialIds.length === 0) {
        throw createError('At least one material scope is required', 400);
      }
      await tx.processorCertificateMaterialScope.createMany({
        data: materialIds.map((materialId) => ({
          certificate_id: id,
          material_id: materialId,
        })),
      });
    }

    const refreshed = await tx.processorCertificate.findUnique({
      where: { id },
      include: CERTIFICATE_INCLUDE,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'ProcessorCertificate',
      entityId: id,
      before: existing,
      after: refreshed,
    }, tx);

    return mapCertificate(refreshed);
  });
}

async function validateCertificate(params) {
  const processorId = params.processor_id;
  const materialId = params.material_id || params.product_type_id;
  const transferDate = params.transfer_date;

  for (const [field, value] of [['processor_id', processorId], ['material_id', materialId], ['transfer_date', transferDate]]) {
    if (!value) throw createError(`${field} is required`, 400);
  }

  const validation = await prisma.$transaction((tx) => validateProcessorCertification(tx, {
    processor_id: processorId,
    material_id: materialId,
    transfer_date: transferDate,
  }));
  return { valid: true, ...validation };
}

module.exports = {
  listProcessors,
  createProcessor,
  updateProcessor,
  createCertificate,
  updateCertificate,
  validateCertificate,
};
