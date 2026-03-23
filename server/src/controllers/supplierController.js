const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const contractService = require('../services/contractService');

async function list(req, res, next) {
  try {
    const { search, supplier_type, page = 1, limit = 20, active, hasActiveContract } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (supplier_type) {
      where.supplier_type = supplier_type;
    }
    if (active !== undefined) {
      where.is_active = active === 'true';
    }
    if (hasActiveContract === 'true') {
      where.contracts = { some: { status: 'ACTIVE', is_active: true } };
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({ where, skip, take: limitNum, orderBy: { name: 'asc' } }),
      prisma.supplier.count({ where }),
    ]);

    return res.json({ data: suppliers, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        afvalstroomnummers: {
          where: { is_active: true },
          include: { waste_stream: { select: { id: true, name: true, code: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    return res.json(supplier);
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

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: { name, supplier_type, kvk_number, contact_name, contact_email, btw_number, iban, contact_phone, address, vihb_number, pro_registration_number },
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

    return res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const { name, supplier_type, kvk_number, contact_name, contact_email, btw_number, iban, contact_phone, address, vihb_number, pro_registration_number } = req.body;

    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: { name, supplier_type, kvk_number, contact_name, contact_email, btw_number, iban, contact_phone, address, vihb_number, pro_registration_number },
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

    return res.json(supplier);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { is_active: false } });

      // Terminate all active contracts for this supplier
      const activeContracts = await tx.supplierContract.findMany({
        where: { supplier_id: id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (activeContracts.length > 0) {
        await tx.supplierContract.updateMany({
          where: { supplier_id: id, status: 'ACTIVE' },
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
        after: { ...existing, is_active: false },
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

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    if (existing.is_active === is_active) {
      return res.json(existing);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: { is_active },
      });

      // When deactivating, terminate all active contracts
      if (!is_active) {
        const activeContracts = await tx.supplierContract.findMany({
          where: { supplier_id: id, status: 'ACTIVE' },
          select: { id: true },
        });
        if (activeContracts.length > 0) {
          await tx.supplierContract.updateMany({
            where: { supplier_id: id, status: 'ACTIVE' },
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
        before: { is_active: existing.is_active },
        after: { is_active },
      }, tx);

      return updated;
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

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
    const data = await contractService.getSupplierContracts(req.params.id, req.query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, getById, create, update, remove, toggleStatus, listAfvalstroomnummers, createAfvalstroomnummer, deleteAfvalstroomnummer, listContracts };
