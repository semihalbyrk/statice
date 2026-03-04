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

  console.log('Users seeded.');

  // Waste Streams
  const weeeStream = await prisma.wasteStream.upsert({
    where: { code: 'WEEE' },
    update: {},
    create: {
      code: 'WEEE',
      name_en: 'Waste Electrical and Electronic Equipment',
      name_nl: 'Afgedankte elektrische en elektronische apparatuur',
    },
  });

  await prisma.wasteStream.upsert({
    where: { code: 'PLASTIC' },
    update: {},
    create: {
      code: 'PLASTIC',
      name_en: 'Plastics',
      name_nl: 'Kunststoffen',
    },
  });

  await prisma.wasteStream.upsert({
    where: { code: 'METAL' },
    update: {},
    create: {
      code: 'METAL',
      name_en: 'Metals',
      name_nl: 'Metalen',
    },
  });

  console.log('Waste streams seeded.');

  // Product Categories (20 WEEE categories)
  const categories = [
    { code_cbs: 'WEEE-01', description_en: 'Large household appliances', description_nl: 'Grote huishoudelijke apparaten' },
    { code_cbs: 'WEEE-02', description_en: 'Small household appliances', description_nl: 'Kleine huishoudelijke apparaten' },
    { code_cbs: 'WEEE-03', description_en: 'IT and telecoms equipment', description_nl: 'IT- en telecomapparatuur' },
    { code_cbs: 'WEEE-04', description_en: 'Consumer electronics', description_nl: 'Consumentenelektronica' },
    { code_cbs: 'WEEE-05', description_en: 'Lighting equipment', description_nl: 'Verlichtingsapparatuur' },
    { code_cbs: 'WEEE-06', description_en: 'Electrical and electronic tools', description_nl: 'Elektrisch gereedschap' },
    { code_cbs: 'WEEE-07', description_en: 'Toys and leisure equipment', description_nl: 'Speelgoed en vrijetijdsapparatuur' },
    { code_cbs: 'WEEE-08', description_en: 'Medical devices', description_nl: 'Medische apparatuur' },
    { code_cbs: 'WEEE-09', description_en: 'Monitoring instruments', description_nl: 'Meetinstrumenten' },
    { code_cbs: 'WEEE-10', description_en: 'Automatic dispensers', description_nl: 'Automaten' },
    { code_cbs: 'WEEE-11', description_en: 'Monitors and screens', description_nl: 'Beeldschermen' },
    { code_cbs: 'WEEE-12', description_en: 'Modems and routers', description_nl: 'Modems en routers' },
    { code_cbs: 'WEEE-13', description_en: 'Circuit boards / PCBs', description_nl: 'Printplaten' },
    { code_cbs: 'WEEE-14', description_en: 'Cables and wiring', description_nl: 'Kabels en bedrading' },
    { code_cbs: 'WEEE-15', description_en: 'Batteries', description_nl: 'Batterijen' },
    { code_cbs: 'WEEE-16', description_en: 'Printers', description_nl: 'Printers' },
    { code_cbs: 'WEEE-17', description_en: 'Mobile phones', description_nl: 'Mobiele telefoons' },
    { code_cbs: 'WEEE-18', description_en: 'Laptops', description_nl: 'Laptops' },
    { code_cbs: 'WEEE-19', description_en: 'Keyboards and peripherals', description_nl: 'Toetsenborden en randapparatuur' },
    { code_cbs: 'WEEE-20', description_en: 'Other WEEE', description_nl: 'Overige WEEE' },
  ];

  for (const cat of categories) {
    await prisma.productCategory.upsert({
      where: { code_cbs: cat.code_cbs },
      update: {},
      create: {
        ...cat,
        waste_stream_id: weeeStream.id,
        recycled_pct_default: 75,
        reused_pct_default: 15,
        disposed_pct_default: 8,
        landfill_pct_default: 2,
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
    update: {},
    create: {
      id: 'supplier-stichting-open',
      name: 'Stichting Open',
      supplier_type: 'PRO',
      kvk_number: '87654321',
      is_active: true,
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'supplier-private-individual' },
    update: {},
    create: {
      id: 'supplier-private-individual',
      name: 'Private Individual',
      supplier_type: 'PRIVATE_INDIVIDUAL',
      is_active: true,
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'supplier-third-party' },
    update: {},
    create: {
      id: 'supplier-third-party',
      name: 'Third Party Supplier',
      supplier_type: 'THIRD_PARTY',
      is_active: true,
    },
  });

  console.log('Suppliers seeded.');
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
