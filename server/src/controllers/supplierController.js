const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const contractService = require('../services/contractService');

/**
 * Maps an Entity record to the legacy Supplier response shape.
 */
function mapEntityToSupplier(entity) {
  return {
    id: entity.id,
    name: entity.company_name,
    supplier_type: entity.supplier_type,
    kvk_number: entity.kvk_number,
    btw_number: entity.btw_number,
    iban: entity.iban,
    contact_name: entity.contact_name,
    contact_email: entity.contact_email,
    contact_phone: entity.contact_phone,
    address: [entity.street_and_number, entity.postal_code, entity.city].filter(Boolean).join(', '),
    vihb_number: entity.vihb_number,
    pro_registration_number: entity.pro_registration_number,
    is_active: entity.status === 'ACTIVE',
    created_at: entity.created_at,
  };
}

async function list(req, res, next) {
  try {
    const { search, supplier_type, page = 1, limit = 20, active, hasActiveContract } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = { is_supplier: true };
    if (search) {
      where.company_name = { contains: search, mode: 'insensitive' };
    }
    if (supplier_type) {
      where.supplier_type = supplier_type;
    }
    if (active !== undefined) {
      where.status = active === 'true' ? 'ACTIVE' : 'INACTIVE';
    }
    if (hasActiveContract === 'true') {
      where.contracts_as_supplier = { some: { status: 'ACTIVE', is_active: true } };
    }

    const [entities, total] = await Promise.all([
      prisma.entity.findMany({ where, skip, take: limitNum, orderBy: { company_name: 'asc' } }),
      prisma.entity.count({ where }),
    ]);

    return res.json({ data: entities.map(mapEntityToSupplier), total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const entity = await prisma.entity.findFirst({
      where: { id: req.params.id, is_supplier: true },
    });
    if (!entity) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Fetch afvalstroomnummers from old Supplier model via migrated_to_entity_id
    const oldSupplier = await prisma.supplier.findFirst({
      where: { migrated_to_entity_id: entity.id },
      include: {
        afvalstroomnummers: {
          where: { is_active: true },
          include: { waste_stream: { select: { id: true, name: true, code: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    const result = mapEntityToSupplier(entity);
    result.afvalstroomnummers = oldSupplier?.afvalstroomnummers || [];

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, supplier_type, kvk_number, contact_name, contact_email, btw_number, iban, contact_phone, address, vihb_number, pro_registration_number } = req.body;
    if (!name || !supplier_type) {
      return res.status(400).json({ error: 'Name and supplier_type are required' });
    }

    const entity = await prisma.$transaction(async (tx) => {
      const created = await tx.entity.create({
        data: {
          company_name: name,
          supplier_type,
          kvk_number,
          contact_name,
          contact_email,
          btw_number,
          iban,
          contact_phone,
          street_and_number: address || '',
          postal_code: '',
          city: '',
          vihb_number,
          pro_registration_number,
          is_supplier: true,
          supplier_roles: ['ONTDOENER'],
        },
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'Supplier',
        entityId: created.id,
        after: created,
      }, tx);
      return created;
    });

    return res.status(201).json(mapEntityToSupplier(entity));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.entity.findFirst({ where: { id, is_supplier: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, supplier_type, kvk_number, contact_name, contact_email, btw_number, iban, contact_phone, address, vihb_number, pro_registration_number } = req.body;

    const data = {};
    if (name !== undefined) data.company_name = name;
    if (supplier_type !== undefined) data.supplier_type = supplier_type;
    if (kvk_number !== undefined) data.kvk_number = kvk_number;
    if (contact_name !== undefined) data.contact_name = contact_name;
    if (contact_email !== undefined) data.contact_email = contact_email;
    if (btw_number !== undefined) data.btw_number = btw_number;
    if (iban !== undefined) data.iban = iban;
    if (contact_phone !== undefined) data.contact_phone = contact_phone;
    if (address !== undefined) data.street_and_number = address;
    if (vihb_number !== undefined) data.vihb_number = vihb_number;
    if (pro_registration_number !== undefined) data.pro_registration_number = pro_registration_number;

    const entity = await prisma.$transaction(async (tx) => {
      const updated = await tx.entity.update({
        where: { id },
        data,
      });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: id,
        before: existing,
        after: updated,
      }, tx);
      return updated;
    });

    return res.json(mapEntityToSupplier(entity));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.entity.findFirst({ where: { id, is_supplier: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.entity.update({ where: { id }, data: { status: 'INACTIVE' } });

      // Terminate all active contracts for this supplier (via entity_supplier_id)
      const activeContracts = await tx.supplierContract.findMany({
        where: { entity_supplier_id: id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeContracts.length > 0) {
        await tx.supplierContract.updateMany({
          where: { entity_supplier_id: id, status: 'ACTIVE' },
          data: { status: 'INACTIVE' },
        });
        for (const c of activeContracts) {
          await writeAuditLog({
            userId: req.user.userId,
            action: 'TERMINATE',
            entityType: 'SupplierContract',
            entityId: c.id,
            before: { status: 'ACTIVE' },
            after: { status: 'INACTIVE', reason: 'Supplier deactivated' },
          }, tx);
        }
      }

      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'Supplier',
        entityId: id,
        before: existing,
        after: { ...existing, status: 'INACTIVE' },
      }, tx);
    });

    return res.json({ message: 'Supplier deactivated' });
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }

    const existing = await prisma.entity.findFirst({ where: { id, is_supplier: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const currentlyActive = existing.status === 'ACTIVE';
    if (currentlyActive === is_active) {
      return res.json(mapEntityToSupplier(existing));
    }

    const newStatus = is_active ? 'ACTIVE' : 'INACTIVE';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.entity.update({
        where: { id },
        data: { status: newStatus },
      });

      // When deactivating, terminate all active contracts
      if (!is_active) {
        const activeContracts = await tx.supplierContract.findMany({
          where: { entity_supplier_id: id, status: 'ACTIVE' },
          select: { id: true },
        });
        if (activeContracts.length > 0) {
          await tx.supplierContract.updateMany({
            where: { entity_supplier_id: id, status: 'ACTIVE' },
            data: { status: 'INACTIVE' },
          });
          for (const c of activeContracts) {
            await writeAuditLog({
              userId: req.user.userId,
              action: 'TERMINATE',
              entityType: 'SupplierContract',
              entityId: c.id,
              before: { status: 'ACTIVE' },
              after: { status: 'INACTIVE', reason: 'Supplier deactivated' },
            }, tx);
          }
        }
      }

      await writeAuditLog({
        userId: req.user.userId,
        action: 'UPDATE',
        entityType: 'Supplier',
        entityId: id,
        before: { is_active: currentlyActive },
        after: { is_active },
      }, tx);

      return updated;
    });

    return res.json(mapEntityToSupplier(result));
  } catch (err) {
    next(err);
  }
}

// --- Afvalstroomnummer endpoints stay on old Supplier model ---

async function listAfvalstroomnummers(req, res) {
  try {
    const records = await prisma.supplierAfvalstroomnummer.findMany({
      where: { supplier_id: req.params.id, is_active: true },
      include: { waste_stream: { select: { id: true, name: true, code: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createAfvalstroomnummer(req, res) {
  try {
    const { afvalstroomnummer, waste_stream_id } = req.body;
    if (!afvalstroomnummer) {
      return res.status(400).json({ error: 'afvalstroomnummer is required' });
    }
    const record = await prisma.supplierAfvalstroomnummer.create({
      data: {
        supplier_id: req.params.id,
        afvalstroomnummer,
        waste_stream_id: waste_stream_id || null,
      },
      include: { waste_stream: { select: { id: true, name: true, code: true } } },
    });
    res.status(201).json(record);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Afvalstroomnummer already registered for this supplier' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteAfvalstroomnummer(req, res) {
  try {
    await prisma.supplierAfvalstroomnummer.update({
      where: { id: req.params.afsId },
      data: { is_active: false },
    });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function listContracts(req, res, next) {
  try {
    const entityId = req.params.id;

    // Query contracts via entity_supplier_id
    const where = { entity_supplier_id: entityId, is_active: true };
    if (req.query.status) where.status = req.query.status;

    const contracts = await prisma.supplierContract.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // Fall back to old supplier_id if no contracts found via entity
    if (contracts.length === 0) {
      const data = await contractService.getSupplierContracts(entityId, req.query);
      return res.json({ data });
    }

    res.json({ data: contracts });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, getById, create, update, remove, toggleStatus, listAfvalstroomnummers, createAfvalstroomnummer, deleteAfvalstroomnummer, listContracts };
