const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  const plannerHash = await bcrypt.hash('Planner123!', 10);
  const gateHash = await bcrypt.hash('Gate1234!', 10);
  const reportHash = await bcrypt.hash('Report123!', 10);
  const sortingHash = await bcrypt.hash('Sorting123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@statice.nl' },
    update: {},
    create: {
      email: 'admin@statice.nl',
      password_hash: passwordHash,
      full_name: 'Admin User',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'planner@statice.nl' },
    update: {},
    create: {
      email: 'planner@statice.nl',
      password_hash: plannerHash,
      full_name: 'Logistics Planner',
      role: 'LOGISTICS_PLANNER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'gate@statice.nl' },
    update: {},
    create: {
      email: 'gate@statice.nl',
      password_hash: gateHash,
      full_name: 'Gate Operator',
      role: 'GATE_OPERATOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'reporting@statice.nl' },
    update: {},
    create: {
      email: 'reporting@statice.nl',
      password_hash: reportHash,
      full_name: 'Reporting Manager',
      role: 'REPORTING_MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'sorting@statice.nl' },
    update: {},
    create: {
      email: 'sorting@statice.nl',
      password_hash: sortingHash,
      full_name: 'Sorting Employee',
      role: 'SORTING_EMPLOYEE',
    },
  });

  // System user for scheduled report generation
  const systemHash = await bcrypt.hash('System!NoLogin!2026', 10);
  await prisma.user.upsert({
    where: { email: 'system@statice.nl' },
    update: {},
    create: {
      email: 'system@statice.nl',
      password_hash: systemHash,
      full_name: 'System',
      role: 'ADMIN',
      is_active: false,
    },
  });

  // Finance Manager user (v2.2)
  const financeHash = await bcrypt.hash('Finance123!', 10);
  await prisma.user.upsert({
    where: { email: 'finance@statice.nl' },
    update: {},
    create: {
      email: 'finance@statice.nl',
      password_hash: financeHash,
      full_name: 'Finance Manager',
      role: 'FINANCE_MANAGER',
    },
  });

  console.log('Users seeded.');

  // Waste Streams
  const weeeStream = await prisma.wasteStream.upsert({
    where: { code: 'WEEE' },
    update: { cbs_code: 'CBS-WEEE', weeelabex_code: 'WL-WEEE', ewc_code: '20 01 35*' },
    create: {
      code: 'WEEE',
      name_en: 'Waste Electrical and Electronic Equipment',
      name_nl: 'Afgedankte elektrische en elektronische apparatuur',
      cbs_code: 'CBS-WEEE',
      weeelabex_code: 'WL-WEEE',
      ewc_code: '20 01 35*',
    },
  });

  await prisma.wasteStream.upsert({
    where: { code: 'PLASTIC' },
    update: { cbs_code: 'CBS-PL', ewc_code: '20 01 39' },
    create: {
      code: 'PLASTIC',
      name_en: 'Plastics',
      name_nl: 'Kunststoffen',
      cbs_code: 'CBS-PL',
      ewc_code: '20 01 39',
    },
  });

  await prisma.wasteStream.upsert({
    where: { code: 'METAL' },
    update: { cbs_code: 'CBS-MT', ewc_code: '20 01 40' },
    create: {
      code: 'METAL',
      name_en: 'Metals',
      name_nl: 'Metalen',
      cbs_code: 'CBS-MT',
      ewc_code: '20 01 40',
    },
  });

  console.log('Waste streams seeded.');

  // Product Categories (20 WEEE categories) with realistic recovery rates
  const categories = [
    { code_cbs: 'WEEE-01', description_en: 'Large household appliances', description_nl: 'Grote huishoudelijke apparaten', r: 78, u: 10, d: 9, l: 3 },
    { code_cbs: 'WEEE-02', description_en: 'Small household appliances', description_nl: 'Kleine huishoudelijke apparaten', r: 65, u: 12, d: 18, l: 5 },
    { code_cbs: 'WEEE-03', description_en: 'IT and telecoms equipment', description_nl: 'IT- en telecomapparatuur', r: 60, u: 25, d: 12, l: 3 },
    { code_cbs: 'WEEE-04', description_en: 'Consumer electronics', description_nl: 'Consumentenelektronica', r: 68, u: 15, d: 13, l: 4 },
    { code_cbs: 'WEEE-05', description_en: 'Lighting equipment', description_nl: 'Verlichtingsapparatuur', r: 55, u: 5, d: 30, l: 10 },
    { code_cbs: 'WEEE-06', description_en: 'Electrical and electronic tools', description_nl: 'Elektrisch gereedschap', r: 72, u: 18, d: 7, l: 3 },
    { code_cbs: 'WEEE-07', description_en: 'Toys and leisure equipment', description_nl: 'Speelgoed en vrijetijdsapparatuur', r: 50, u: 8, d: 32, l: 10 },
    { code_cbs: 'WEEE-08', description_en: 'Medical devices', description_nl: 'Medische apparatuur', r: 45, u: 5, d: 40, l: 10 },
    { code_cbs: 'WEEE-09', description_en: 'Monitoring instruments', description_nl: 'Meetinstrumenten', r: 58, u: 22, d: 15, l: 5 },
    { code_cbs: 'WEEE-10', description_en: 'Automatic dispensers', description_nl: 'Automaten', r: 80, u: 8, d: 9, l: 3 },
    { code_cbs: 'WEEE-11', description_en: 'Monitors and screens', description_nl: 'Beeldschermen', r: 62, u: 10, d: 22, l: 6 },
    { code_cbs: 'WEEE-12', description_en: 'Modems and routers', description_nl: 'Modems en routers', r: 55, u: 30, d: 12, l: 3 },
    { code_cbs: 'WEEE-13', description_en: 'Circuit boards / PCBs', description_nl: 'Printplaten', r: 90, u: 2, d: 6, l: 2 },
    { code_cbs: 'WEEE-14', description_en: 'Cables and wiring', description_nl: 'Kabels en bedrading', r: 92, u: 3, d: 4, l: 1 },
    { code_cbs: 'WEEE-15', description_en: 'Batteries', description_nl: 'Batterijen', r: 70, u: 0, d: 25, l: 5 },
    { code_cbs: 'WEEE-16', description_en: 'Printers', description_nl: 'Printers', r: 63, u: 15, d: 17, l: 5 },
    { code_cbs: 'WEEE-17', description_en: 'Mobile phones', description_nl: 'Mobiele telefoons', r: 50, u: 35, d: 12, l: 3 },
    { code_cbs: 'WEEE-18', description_en: 'Laptops', description_nl: 'Laptops', r: 55, u: 30, d: 12, l: 3 },
    { code_cbs: 'WEEE-19', description_en: 'Keyboards and peripherals', description_nl: 'Toetsenborden en randapparatuur', r: 60, u: 10, d: 24, l: 6 },
    { code_cbs: 'WEEE-20', description_en: 'Other WEEE', description_nl: 'Overige WEEE', r: 65, u: 10, d: 18, l: 7 },
  ];

  for (const cat of categories) {
    await prisma.productCategory.upsert({
      where: { code_cbs: cat.code_cbs },
      update: {
        recycled_pct_default: cat.r,
        reused_pct_default: cat.u,
        disposed_pct_default: cat.d,
        landfill_pct_default: cat.l,
      },
      create: {
        code_cbs: cat.code_cbs,
        description_en: cat.description_en,
        description_nl: cat.description_nl,
        waste_stream_id: weeeStream.id,
        recycled_pct_default: cat.r,
        reused_pct_default: cat.u,
        disposed_pct_default: cat.d,
        landfill_pct_default: cat.l,
      },
    });
  }

  console.log('Product categories seeded.');

  // Carriers
  await prisma.carrier.upsert({
    where: { id: 'carrier-van-happen' },
    update: {},
    create: {
      id: 'carrier-van-happen',
      name: 'Van Happen Recycling',
      kvk_number: '12345678',
      is_active: true,
    },
  });

  await prisma.carrier.upsert({
    where: { id: 'carrier-direct-dropoff' },
    update: {},
    create: {
      id: 'carrier-direct-dropoff',
      name: 'Direct Drop-off',
      kvk_number: null,
      is_active: true,
    },
  });

  console.log('Carriers seeded.');

  // Suppliers
  await prisma.supplier.upsert({
    where: { id: 'supplier-stichting-open' },
    update: {
      btw_number: 'NL123456789B01',
      contact_phone: '+31 40 123 4567',
      address: 'Stationsplein 1, 3818 LE Amersfoort',
      pro_registration_number: 'PRO-NL-001',
    },
    create: {
      id: 'supplier-stichting-open',
      name: 'Stichting Open',
      supplier_type: 'PRO',
      kvk_number: '87654321',
      btw_number: 'NL123456789B01',
      contact_phone: '+31 40 123 4567',
      address: 'Stationsplein 1, 3818 LE Amersfoort',
      pro_registration_number: 'PRO-NL-001',
      is_active: true,
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'supplier-private-individual' },
    update: {},
    create: {
      id: 'supplier-private-individual',
      name: 'Ad-hoc / Walk-in',
      supplier_type: 'PRIVATE_INDIVIDUAL',
      is_active: true,
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'supplier-third-party' },
    update: {
      btw_number: 'NL987654321B01',
      contact_phone: '+31 20 567 8901',
      address: 'Industrieweg 10, 1000 AA Amsterdam',
    },
    create: {
      id: 'supplier-third-party',
      name: 'TechRecycle B.V.',
      supplier_type: 'THIRD_PARTY',
      kvk_number: '55667788',
      btw_number: 'NL987654321B01',
      contact_phone: '+31 20 567 8901',
      address: 'Industrieweg 10, 1000 AA Amsterdam',
      is_active: true,
    },
  });

  console.log('Suppliers seeded.');

  // Supplier Afvalstroomnummers (for PRO supplier)
  await prisma.supplierAfvalstroomnummer.upsert({
    where: { supplier_id_afvalstroomnummer: { supplier_id: 'supplier-stichting-open', afvalstroomnummer: 'AFS-2026-001' } },
    update: {},
    create: {
      supplier_id: 'supplier-stichting-open',
      afvalstroomnummer: 'AFS-2026-001',
      waste_stream_id: weeeStream.id,
    },
  });

  await prisma.supplierAfvalstroomnummer.upsert({
    where: { supplier_id_afvalstroomnummer: { supplier_id: 'supplier-stichting-open', afvalstroomnummer: 'AFS-2026-002' } },
    update: {},
    create: {
      supplier_id: 'supplier-stichting-open',
      afvalstroomnummer: 'AFS-2026-002',
      waste_stream_id: weeeStream.id,
    },
  });

  console.log('Supplier afvalstroomnummers seeded.');

  // System Settings (singleton)
  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  console.log('System settings seeded.');

  // FeeMaster entries
  const feeEntries = [
    { fee_type: 'CONTAMINATION_SURCHARGE', description: 'Standard contamination surcharge per kg over tolerance', rate_type: 'PER_KG', rate_value: 0.15, min_cap: null, max_cap: 500.00 },
    { fee_type: 'CONTAMINATION_FLAT', description: 'Flat contamination penalty for loads exceeding tolerance', rate_type: 'FIXED', rate_value: 150.00, min_cap: null, max_cap: null },
    { fee_type: 'CONTAMINATION_PERCENTAGE', description: 'Percentage-based contamination penalty on total order value', rate_type: 'PERCENTAGE', rate_value: 5.00, min_cap: 50.00, max_cap: 1000.00 },
    { fee_type: 'SORTING_SURCHARGE', description: 'Additional sorting labor charge per hour', rate_type: 'PER_HOUR', rate_value: 45.00, min_cap: null, max_cap: null },
    { fee_type: 'HAZARDOUS_MATERIAL', description: 'Surcharge for undeclared hazardous materials found during sorting', rate_type: 'FIXED', rate_value: 500.00, min_cap: null, max_cap: null },
    { fee_type: 'REJECTION_FEE', description: 'Fee for rejected loads that cannot be processed', rate_type: 'PER_KG', rate_value: 0.25, min_cap: 100.00, max_cap: null },
  ];

  for (const fee of feeEntries) {
    const existing = await prisma.feeMaster.findFirst({
      where: { fee_type: fee.fee_type, description: fee.description },
    });
    if (!existing) {
      await prisma.feeMaster.create({ data: fee });
    }
  }

  console.log('FeeMaster seeded.');

  // Contracts with Waste Stream Agreements
  const plasticStream = await prisma.wasteStream.findUnique({ where: { code: 'PLASTIC' } });
  const metalStream = await prisma.wasteStream.findUnique({ where: { code: 'METAL' } });

  // Get some materials for rate lines
  const weeeMaterials = await prisma.materialMaster.findMany({
    where: { waste_stream_id: weeeStream.id, is_active: true },
    take: 3,
  });
  const plasticMaterials = await prisma.materialMaster.findMany({
    where: { waste_stream_id: plasticStream?.id, is_active: true },
    take: 2,
  });

  if (weeeMaterials.length > 0) {
    const existingContract = await prisma.supplierContract.findFirst({
      where: { supplier_id: 'supplier-stichting-open' },
    });

    if (!existingContract) {
      const contract = await prisma.supplierContract.create({
        data: {
          contract_number: 'CTR-00001',
          supplier_id: 'supplier-stichting-open',
          carrier_id: 'carrier-van-happen',
          name: '2026 Stichting Open WEEE Agreement',
          effective_date: new Date('2026-01-01'),
          expiry_date: new Date('2026-12-31'),
          status: 'ACTIVE',
          receiver_name: 'Statice B.V.',
          payment_term_days: 30,
          invoicing_frequency: 'MONTHLY',
          currency: 'EUR',
          contamination_tolerance_pct: 5.0,
        },
      });

      // WEEE waste stream with ASN
      const cwsWeee = await prisma.contractWasteStream.create({
        data: {
          contract_id: contract.id,
          waste_stream_id: weeeStream.id,
          afvalstroomnummer: 'AFS-2026-001',
        },
      });

      // Rate lines for WEEE materials
      for (const mat of weeeMaterials) {
        await prisma.contractRateLine.create({
          data: {
            contract_id: contract.id,
            contract_waste_stream_id: cwsWeee.id,
            material_id: mat.id,
            pricing_model: 'WEIGHT',
            unit_rate: Math.round(20 + Math.random() * 80),
            btw_rate: 21,
            valid_from: new Date('2026-01-01'),
            valid_to: new Date('2026-12-31'),
          },
        });
      }

      // PLASTIC waste stream with ASN (if materials exist)
      if (plasticStream && plasticMaterials.length > 0) {
        const cwsPlastic = await prisma.contractWasteStream.create({
          data: {
            contract_id: contract.id,
            waste_stream_id: plasticStream.id,
            afvalstroomnummer: 'AFS-2026-002',
          },
        });

        for (const mat of plasticMaterials) {
          await prisma.contractRateLine.create({
            data: {
              contract_id: contract.id,
              contract_waste_stream_id: cwsPlastic.id,
              material_id: mat.id,
              pricing_model: 'WEIGHT',
              unit_rate: Math.round(10 + Math.random() * 40),
              btw_rate: 21,
              valid_from: new Date('2026-01-01'),
              valid_to: new Date('2026-12-31'),
            },
          });
        }
      }

      console.log('Contract with waste streams and ASNs seeded.');
    } else {
      console.log('Contracts already exist, skipping contract seed.');
    }
  }

  console.log('Database seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
