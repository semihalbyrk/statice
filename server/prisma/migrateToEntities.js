const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SUPPLIER_TYPE_MAP = {
  'PRO': 'PRO',
  'THIRD_PARTY': 'COMMERCIAL',
  'PRIVATE_INDIVIDUAL': 'AD_HOC',
};

function parseAddress(address) {
  if (!address) return { street: '', postal: '', city: '' };
  const postalMatch = address.match(/(\d{4}\s?[A-Z]{2})\s+(.+?)$/);
  if (postalMatch) {
    const beforePostal = address.substring(0, postalMatch.index).replace(/,\s*$/, '').trim();
    return { street: beforePostal || address, postal: postalMatch[1], city: postalMatch[2] };
  }
  return { street: address, postal: '', city: '' };
}

async function migrate() {
  console.log('Starting Supplier/Carrier → Entity migration...\n');

  const suppliers = await prisma.supplier.findMany();
  const carriers = await prisma.carrier.findMany();

  console.log(`Found ${suppliers.length} suppliers and ${carriers.length} carriers to migrate.\n`);

  await prisma.$transaction(async (tx) => {
    // Map: lowercased company name → entity id
    const entityByName = new Map();
    // Map: old supplier id → new entity id
    const supplierToEntity = new Map();
    // Map: old carrier id → new entity id
    const carrierToEntity = new Map();

    // ── Step 1: Migrate Suppliers → Entity ──────────────────────────────
    console.log('── Step 1: Migrating Suppliers ──');
    for (const supplier of suppliers) {
      const addr = parseAddress(supplier.address);
      const entity = await tx.entity.create({
        data: {
          company_name: supplier.name,
          street_and_number: addr.street,
          postal_code: addr.postal,
          city: addr.city,
          kvk_number: supplier.kvk_number,
          btw_number: supplier.btw_number,
          iban: supplier.iban,
          vihb_number: supplier.vihb_number,
          contact_name: supplier.contact_name,
          contact_email: supplier.contact_email,
          contact_phone: supplier.contact_phone,
          pro_registration_number: supplier.pro_registration_number,
          is_supplier: true,
          supplier_type: SUPPLIER_TYPE_MAP[supplier.supplier_type] || null,
          supplier_roles: ['ONTDOENER'],
          status: supplier.is_active ? 'ACTIVE' : 'INACTIVE',
        },
      });

      entityByName.set(supplier.name.toLowerCase(), entity.id);
      supplierToEntity.set(supplier.id, entity.id);
      console.log(`  ✓ Supplier "${supplier.name}" → Entity ${entity.id}`);
    }

    // ── Step 2: Migrate Carriers → Entity (merge by name) ───────────────
    console.log('\n── Step 2: Migrating Carriers ──');
    for (const carrier of carriers) {
      const existingEntityId = entityByName.get(carrier.name.toLowerCase());

      if (existingEntityId) {
        // Merge: update existing entity to also be a transporter
        const updateData = { is_transporter: true };
        if (carrier.licence_number) {
          const existing = await tx.entity.findUnique({ where: { id: existingEntityId }, select: { vihb_number: true } });
          if (!existing.vihb_number) {
            updateData.vihb_number = carrier.licence_number;
          }
        }
        await tx.entity.update({
          where: { id: existingEntityId },
          data: updateData,
        });
        carrierToEntity.set(carrier.id, existingEntityId);
        console.log(`  ⟳ Carrier "${carrier.name}" merged into existing Entity ${existingEntityId}`);
      } else {
        // Create new entity for this carrier
        const entity = await tx.entity.create({
          data: {
            company_name: carrier.name,
            street_and_number: '',
            postal_code: '',
            city: '',
            kvk_number: carrier.kvk_number,
            contact_name: carrier.contact_name,
            contact_email: carrier.contact_email,
            contact_phone: carrier.contact_phone,
            vihb_number: carrier.licence_number,
            is_transporter: true,
            status: carrier.is_active ? 'ACTIVE' : 'INACTIVE',
          },
        });
        entityByName.set(carrier.name.toLowerCase(), entity.id);
        carrierToEntity.set(carrier.id, entity.id);
        console.log(`  ✓ Carrier "${carrier.name}" → Entity ${entity.id}`);
      }
    }

    // ── Step 3: Backfill FK references ──────────────────────────────────
    console.log('\n── Step 3: Backfilling FK references ──');

    // Supplier FKs
    for (const [supplierId, entityId] of supplierToEntity) {
      const contractResult = await tx.supplierContract.updateMany({
        where: { supplier_id: supplierId, entity_supplier_id: null },
        data: { entity_supplier_id: entityId },
      });
      const orderResult = await tx.inboundOrder.updateMany({
        where: { supplier_id: supplierId, entity_supplier_id: null },
        data: { entity_supplier_id: entityId },
      });
      if (contractResult.count > 0 || orderResult.count > 0) {
        console.log(`  Supplier ${supplierId}: ${contractResult.count} contracts, ${orderResult.count} orders updated`);
      }
    }

    // Carrier FKs
    for (const [carrierId, entityId] of carrierToEntity) {
      const contractResult = await tx.supplierContract.updateMany({
        where: { carrier_id: carrierId, agreement_transporter_id: null },
        data: { agreement_transporter_id: entityId },
      });
      const orderResult = await tx.inboundOrder.updateMany({
        where: { carrier_id: carrierId, transporter_id: null },
        data: { transporter_id: entityId },
      });
      if (contractResult.count > 0 || orderResult.count > 0) {
        console.log(`  Carrier ${carrierId}: ${contractResult.count} contracts, ${orderResult.count} orders updated`);
      }
    }

    // ── Step 4: Mark old records with migrated_to_entity_id ─────────────
    console.log('\n── Step 4: Marking old records ──');
    for (const [supplierId, entityId] of supplierToEntity) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { migrated_to_entity_id: entityId },
      });
    }
    for (const [carrierId, entityId] of carrierToEntity) {
      await tx.carrier.update({
        where: { id: carrierId },
        data: { migrated_to_entity_id: entityId },
      });
    }
    console.log(`  Marked ${supplierToEntity.size} suppliers and ${carrierToEntity.size} carriers.`);
  });

  // ── Verification ────────────────────────────────────────────────────
  console.log('\n── Verification ──');
  const entityCount = await prisma.entity.count();
  const suppliersWithEntity = await prisma.supplier.count({ where: { migrated_to_entity_id: { not: null } } });
  const carriersWithEntity = await prisma.carrier.count({ where: { migrated_to_entity_id: { not: null } } });
  const contractsWithSupplier = await prisma.supplierContract.count({ where: { entity_supplier_id: { not: null } } });
  const contractsWithTransporter = await prisma.supplierContract.count({ where: { agreement_transporter_id: { not: null } } });
  const ordersWithSupplier = await prisma.inboundOrder.count({ where: { entity_supplier_id: { not: null } } });
  const ordersWithTransporter = await prisma.inboundOrder.count({ where: { transporter_id: { not: null } } });

  console.log(`  Entities created: ${entityCount}`);
  console.log(`  Suppliers marked: ${suppliersWithEntity}`);
  console.log(`  Carriers marked: ${carriersWithEntity}`);
  console.log(`  Contracts with entity_supplier_id: ${contractsWithSupplier}`);
  console.log(`  Contracts with agreement_transporter_id: ${contractsWithTransporter}`);
  console.log(`  Orders with entity_supplier_id: ${ordersWithSupplier}`);
  console.log(`  Orders with transporter_id: ${ordersWithTransporter}`);

  console.log('\nMigration complete!');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
