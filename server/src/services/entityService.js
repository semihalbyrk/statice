const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// --- Include / Select constants ---

const ENTITY_LIST_SELECT = {
  id: true,
  company_name: true,
  city: true,
  kvk_number: true,
  vihb_number: true,
  status: true,
  is_supplier: true,
  is_transporter: true,
  is_disposer: true,
  is_receiver: true,
  supplier_type: true,
  supplier_roles: true,
  created_at: true,
  updated_at: true,
};

const ENTITY_DETAIL_INCLUDE = {
  disposer_sites: true,
  contracts_as_supplier: {
    select: { id: true, contract_number: true, name: true, status: true, effective_date: true, expiry_date: true },
    orderBy: { created_at: 'desc' },
  },
  contracts_as_transporter: {
    select: { id: true, contract_number: true, name: true, status: true, effective_date: true, expiry_date: true },
    orderBy: { created_at: 'desc' },
  },
  orders_as_supplier: {
    select: { id: true, order_number: true, status: true, planned_date: true },
    orderBy: { created_at: 'desc' },
    take: 20,
  },
  orders_as_transporter: {
    select: { id: true, order_number: true, status: true, planned_date: true },
    orderBy: { created_at: 'desc' },
    take: 20,
  },
};

// --- Validation ---

function validateEntity(data, isUpdate = false) {
  const {
    is_supplier, is_transporter, is_disposer, is_receiver,
    supplier_type, supplier_roles, pro_registration_number,
    vihb_number, environmental_permit_number, kvk_number,
  } = data;

  // 1. At least one role
  if (!is_supplier && !is_transporter && !is_disposer && !is_receiver) {
    throw createError('At least one role must be selected', 400);
  }

  // 2. Supplier requires supplier_type and supplier_roles
  if (is_supplier) {
    if (!supplier_type) {
      throw createError('Supplier type is required when entity is a supplier', 400);
    }
    if (!Array.isArray(supplier_roles) || supplier_roles.length === 0) {
      throw createError('At least one supplier role is required when entity is a supplier', 400);
    }
  }

  // 3. PRO supplier requires pro_registration_number
  if (is_supplier && supplier_type === 'PRO') {
    if (!pro_registration_number || pro_registration_number.trim() === '') {
      throw createError('PRO registration number is required for PRO suppliers', 400);
    }
  }

  // 4. Transporter requires vihb_number
  if (is_transporter) {
    if (!vihb_number || vihb_number.trim() === '') {
      throw createError('VIHB number is required for transporters', 400);
    }
  }

  // 5. Disposer requires environmental_permit_number
  if (is_disposer) {
    if (!environmental_permit_number || environmental_permit_number.trim() === '') {
      throw createError('Environmental permit number is required for disposers', 400);
    }
  }

  // 6. Receiver requires environmental_permit_number
  if (is_receiver) {
    if (!environmental_permit_number || environmental_permit_number.trim() === '') {
      throw createError('Environmental permit number is required for receivers', 400);
    }
  }

  // 7. KVK required if supplier or disposer
  if (is_supplier || is_disposer) {
    if (!kvk_number || kvk_number.trim() === '') {
      throw createError('KVK number is required for suppliers and disposers', 400);
    }
  }
}

/**
 * When a role flag is turned off on update, nullify its role-specific fields.
 */
function applyRoleCleanup(data) {
  if (data.is_supplier === false) {
    data.supplier_type = null;
    data.supplier_roles = [];
    data.pro_registration_number = null;
  }
  if (data.is_disposer === false) {
    data.is_also_site = false;
  }
  return data;
}

// --- CRUD ---

async function listEntities({ role, status, search, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  // Role filter
  if (role === 'supplier') where.is_supplier = true;
  else if (role === 'transporter') where.is_transporter = true;
  else if (role === 'disposer') where.is_disposer = true;
  else if (role === 'receiver') where.is_receiver = true;

  // Status filter
  if (status) where.status = status;

  // Search filter
  if (search) {
    where.OR = [
      { company_name: { contains: search, mode: 'insensitive' } },
      { vihb_number: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [entities, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      select: ENTITY_LIST_SELECT,
      skip,
      take: limitNum,
      orderBy: { company_name: 'asc' },
    }),
    prisma.entity.count({ where }),
  ]);

  return { data: entities, total, page: pageNum, limit: limitNum };
}

async function getEntityById(id) {
  const entity = await prisma.entity.findUnique({
    where: { id },
    include: ENTITY_DETAIL_INCLUDE,
  });
  if (!entity) throw createError('Entity not found', 404);
  return entity;
}

async function createEntity(data, userId) {
  // Apply cleanup before validation (in case caller sends conflicting data)
  applyRoleCleanup(data);
  validateEntity(data);

  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({
      data: {
        company_name: data.company_name,
        street_and_number: data.street_and_number,
        postal_code: data.postal_code,
        city: data.city,
        country: data.country || 'NL',
        kvk_number: data.kvk_number || null,
        btw_number: data.btw_number || null,
        iban: data.iban || null,
        vihb_number: data.vihb_number || null,
        environmental_permit_number: data.environmental_permit_number || null,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        is_supplier: data.is_supplier || false,
        is_transporter: data.is_transporter || false,
        is_disposer: data.is_disposer || false,
        is_receiver: data.is_receiver || false,
        supplier_type: data.supplier_type || null,
        supplier_roles: data.supplier_roles || [],
        pro_registration_number: data.pro_registration_number || null,
        is_also_site: data.is_also_site || false,
      },
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'Entity',
      entityId: entity.id,
      after: entity,
    }, tx);

    return entity;
  });
}

async function updateEntity(id, data, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.entity.findUnique({ where: { id } });
    if (!existing) throw createError('Entity not found', 404);

    // Merge existing booleans with incoming data for validation
    const merged = {
      is_supplier: data.is_supplier ?? existing.is_supplier,
      is_transporter: data.is_transporter ?? existing.is_transporter,
      is_disposer: data.is_disposer ?? existing.is_disposer,
      is_receiver: data.is_receiver ?? existing.is_receiver,
      supplier_type: data.supplier_type ?? existing.supplier_type,
      supplier_roles: data.supplier_roles ?? existing.supplier_roles,
      pro_registration_number: data.pro_registration_number ?? existing.pro_registration_number,
      vihb_number: data.vihb_number ?? existing.vihb_number,
      environmental_permit_number: data.environmental_permit_number ?? existing.environmental_permit_number,
      kvk_number: data.kvk_number ?? existing.kvk_number,
    };

    // Apply role cleanup on the merged state
    applyRoleCleanup(merged);
    validateEntity(merged);

    // Build the update payload from merged + any other fields from data
    const updateData = { ...data };
    // Ensure cleanup fields are applied
    if (merged.is_supplier === false || data.is_supplier === false) {
      updateData.supplier_type = null;
      updateData.supplier_roles = [];
      updateData.pro_registration_number = null;
    }
    if (merged.is_disposer === false || data.is_disposer === false) {
      updateData.is_also_site = false;
    }

    const updated = await tx.entity.update({
      where: { id },
      data: updateData,
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'Entity',
      entityId: id,
      before: existing,
      after: updated,
    }, tx);

    return updated;
  });
}

async function toggleEntityStatus(id, userId) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.entity.findUnique({ where: { id } });
    if (!existing) throw createError('Entity not found', 404);

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await tx.entity.update({
      where: { id },
      data: { status: newStatus },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'Entity',
      entityId: id,
      before: { status: existing.status },
      after: { status: newStatus },
    }, tx);

    return updated;
  });
}

// --- Disposer Sites ---

async function listDisposerSites(entityId) {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { id: true },
  });
  if (!entity) throw createError('Entity not found', 404);

  return prisma.disposerSite.findMany({
    where: { entity_id: entityId },
    orderBy: { site_name: 'asc' },
  });
}

async function createDisposerSite(entityId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const entity = await tx.entity.findUnique({
      where: { id: entityId },
      select: { id: true, is_disposer: true },
    });
    if (!entity) throw createError('Entity not found', 404);
    if (!entity.is_disposer) throw createError('Entity is not a disposer', 400);

    const site = await tx.disposerSite.create({
      data: {
        entity_id: entityId,
        site_name: data.site_name,
        street_and_number: data.street_and_number,
        postal_code: data.postal_code,
        city: data.city,
        country: data.country || 'NL',
        environmental_permit_number: data.environmental_permit_number || null,
      },
    });

    await writeAuditLog({
      userId,
      action: 'CREATE',
      entityType: 'DisposerSite',
      entityId: site.id,
      after: site,
    }, tx);

    return site;
  });
}

async function updateDisposerSite(entityId, siteId, data, userId) {
  return prisma.$transaction(async (tx) => {
    const site = await tx.disposerSite.findFirst({
      where: { id: siteId, entity_id: entityId },
    });
    if (!site) throw createError('Disposer site not found', 404);

    const updated = await tx.disposerSite.update({
      where: { id: siteId },
      data: {
        site_name: data.site_name,
        street_and_number: data.street_and_number,
        postal_code: data.postal_code,
        city: data.city,
        country: data.country,
        environmental_permit_number: data.environmental_permit_number,
      },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'DisposerSite',
      entityId: siteId,
      before: site,
      after: updated,
    }, tx);

    return updated;
  });
}

async function toggleDisposerSiteStatus(entityId, siteId, userId) {
  return prisma.$transaction(async (tx) => {
    const site = await tx.disposerSite.findFirst({
      where: { id: siteId, entity_id: entityId },
    });
    if (!site) throw createError('Disposer site not found', 404);

    const newStatus = site.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const updated = await tx.disposerSite.update({
      where: { id: siteId },
      data: { status: newStatus },
    });

    await writeAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'DisposerSite',
      entityId: siteId,
      before: { status: site.status },
      after: { status: newStatus },
    }, tx);

    return updated;
  });
}

module.exports = {
  listEntities,
  getEntityById,
  createEntity,
  updateEntity,
  toggleEntityStatus,
  listDisposerSites,
  createDisposerSite,
  updateDisposerSite,
  toggleDisposerSiteStatus,
};
