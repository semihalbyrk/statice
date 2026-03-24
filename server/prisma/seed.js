const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP — operational models first (child → parent order)
  // ═══════════════════════════════════════════════════════════════════════════
  await prisma.contaminationIncident.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.processingOutcomeLine.deleteMany();
  await prisma.processingRecord.deleteMany();
  await prisma.reusableItem.deleteMany();
  await prisma.assetCatalogueEntry.deleteMany();
  await prisma.sortingLine.deleteMany();
  await prisma.sortingSession.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.inboundWeighing.deleteMany();
  // Clear inbound FK refs to pfister tickets, then delete inbounds, then tickets
  await prisma.inbound.updateMany({ data: { gross_ticket_id: null, tare_ticket_id: null } });
  await prisma.inbound.deleteMany();
  await prisma.weightAmendment.deleteMany();
  await prisma.pfisterTicket.deleteMany();
  await prisma.orderWasteStream.deleteMany();
  await prisma.inboundOrder.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.processorCertificateMaterialScope.deleteMany();
  await prisma.processorCertificate.deleteMany();
  await prisma.processor.deleteMany();
  console.log('Operational data cleaned.');

  // ─── Users ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  const plannerHash = await bcrypt.hash('Planner123!', 10);
  const gateHash = await bcrypt.hash('Gate1234!', 10);
  const reportHash = await bcrypt.hash('Report123!', 10);
  const sortingHash = await bcrypt.hash('Sorting123!', 10);
  const financeHash = await bcrypt.hash('Finance123!', 10);
  const systemHash = await bcrypt.hash('System!NoLogin!2026', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@statice.nl' },
    update: {},
    create: { email: 'admin@statice.nl', password_hash: passwordHash, full_name: 'Admin User', role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'planner@statice.nl' },
    update: {},
    create: { email: 'planner@statice.nl', password_hash: plannerHash, full_name: 'Logistics Planner', role: 'LOGISTICS_PLANNER' },
  });
  const gateUser = await prisma.user.upsert({
    where: { email: 'gate@statice.nl' },
    update: {},
    create: { email: 'gate@statice.nl', password_hash: gateHash, full_name: 'Gate Operator', role: 'GATE_OPERATOR' },
  });
  await prisma.user.upsert({
    where: { email: 'reporting@statice.nl' },
    update: {},
    create: { email: 'reporting@statice.nl', password_hash: reportHash, full_name: 'Reporting Manager', role: 'REPORTING_MANAGER' },
  });
  const sortingUser = await prisma.user.upsert({
    where: { email: 'sorting@statice.nl' },
    update: {},
    create: { email: 'sorting@statice.nl', password_hash: sortingHash, full_name: 'Sorting Employee', role: 'SORTING_EMPLOYEE' },
  });
  const financeUser = await prisma.user.upsert({
    where: { email: 'finance@statice.nl' },
    update: {},
    create: { email: 'finance@statice.nl', password_hash: financeHash, full_name: 'Finance Manager', role: 'FINANCE_MANAGER' },
  });
  await prisma.user.upsert({
    where: { email: 'system@statice.nl' },
    update: {},
    create: { email: 'system@statice.nl', password_hash: systemHash, full_name: 'System', role: 'ADMIN', is_active: false },
  });
  console.log('Users seeded.');

  // ─── Waste Stream (WEEE only) ───────────────────────────────────────
  const weeeStream = await prisma.wasteStream.upsert({
    where: { code: 'WEEE' },
    update: { cbs_code: 'CBS-WEEE', weeelabex_code: 'WL-WEEE', ewc_code: '20 01 35*' },
    create: {
      code: 'WEEE',
      name: 'Waste Electrical and Electronic Equipment',
      cbs_code: 'CBS-WEEE',
      weeelabex_code: 'WL-WEEE',
      ewc_code: '20 01 35*',
    },
  });
  console.log('Waste stream seeded.');

  // ─── Product Categories (20 WEEE categories) ────────────────────────
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
      update: { recycled_pct_default: cat.r, reused_pct_default: cat.u, disposed_pct_default: cat.d },
      create: {
        code_cbs: cat.code_cbs,
        description_en: cat.description_en,
        description_nl: cat.description_nl,
        waste_stream_id: weeeStream.id,
        recycled_pct_default: cat.r,
        reused_pct_default: cat.u,
        disposed_pct_default: cat.d,
      },
    });
  }
  console.log('Product categories seeded.');

  // ─── MaterialMaster (5 WEEE product types) ──────────────────────────
  const legacyCatMap = {};
  for (const code of ['WEEE-01', 'WEEE-02', 'WEEE-03', 'WEEE-11', 'WEEE-13']) {
    const cat = await prisma.productCategory.findUnique({ where: { code_cbs: code } });
    if (cat) legacyCatMap[code] = cat.id;
  }

  const materialsData = [
    { id: 'mat-hdd', code: 'MAT-HDD', name: 'Hard Disk Drives', cbs_code: 'CBS-HDD', weeelabex_group: 'WL-IT', eural_code: '20 01 35*', weee_category: 'Cat. 3', legacy: 'WEEE-03', process: 'Shredding and ferrous/non-ferrous separation' },
    { id: 'mat-pcb', code: 'MAT-PCB', name: 'Printed Circuit Board Assemblies', cbs_code: 'CBS-PCB', weeelabex_group: 'WL-IT', eural_code: '20 01 35*', weee_category: 'Cat. 3', legacy: 'WEEE-13', process: 'Manual depopulation and precious metal recovery' },
    { id: 'mat-sha', code: 'MAT-SHA', name: 'Small Household Appliances', cbs_code: 'CBS-SHA', weeelabex_group: 'WL-SHA', eural_code: '20 01 36', weee_category: 'Cat. 2', legacy: 'WEEE-02', process: 'Shredding and multi-fraction sorting' },
    { id: 'mat-lha', code: 'MAT-LHA', name: 'Large Household Appliances', cbs_code: 'CBS-LHA', weeelabex_group: 'WL-LHA', eural_code: '20 01 36', weee_category: 'Cat. 1', legacy: 'WEEE-01', process: 'Depollution, shredding, and sorting' },
    { id: 'mat-scr', code: 'MAT-SCR', name: 'Screens and Monitors', cbs_code: 'CBS-SCR', weeelabex_group: 'WL-SCR', eural_code: '20 01 35*', weee_category: 'Cat. 2', legacy: 'WEEE-11', process: 'Manual dismantling and panel separation' },
  ];

  for (const m of materialsData) {
    await prisma.materialMaster.upsert({
      where: { code: m.code },
      update: { name: m.name, cbs_code: m.cbs_code, weeelabex_group: m.weeelabex_group, eural_code: m.eural_code, weee_category: m.weee_category, default_process_description: m.process },
      create: {
        id: m.id,
        code: m.code,
        name: m.name,
        waste_stream_id: weeeStream.id,
        cbs_code: m.cbs_code,
        weeelabex_group: m.weeelabex_group,
        eural_code: m.eural_code,
        weee_category: m.weee_category,
        legacy_category_id: legacyCatMap[m.legacy] || null,
        default_process_description: m.process,
      },
    });
  }
  console.log('MaterialMaster seeded.');

  // ─── FractionMaster (7 output fractions) ─────────────────────────────
  const fractionsData = [
    { id: 'frc-fe',  code: 'FRC-FE',  name: 'Ferrous Metals',            eural_code: '19 12 02', recycling: 100, energy: 0,  thermal: 0,  landfill: 0,  process: 'Magnetic separation, smelting' },
    { id: 'frc-cu',  code: 'FRC-CU',  name: 'Copper',                    eural_code: '19 12 03', recycling: 100, energy: 0,  thermal: 0,  landfill: 0,  process: 'Eddy current separation, refining' },
    { id: 'frc-al',  code: 'FRC-AL',  name: 'Aluminium',                 eural_code: '19 12 03', recycling: 100, energy: 0,  thermal: 0,  landfill: 0,  process: 'Eddy current separation, smelting' },
    { id: 'frc-pcb', code: 'FRC-PCB', name: 'Printed Circuit Boards',    eural_code: '19 12 12', recycling: 30,  energy: 30, thermal: 40, landfill: 0,  process: 'Precious metal refining (integrated smelter)' },
    { id: 'frc-pla', code: 'FRC-PLA', name: 'Plastics Mix',              eural_code: '19 12 04', recycling: 60,  energy: 30, thermal: 10, landfill: 0,  process: 'Polymer sorting and granulation' },
    { id: 'frc-gls', code: 'FRC-GLS', name: 'Glass (screens)',           eural_code: '19 12 05', recycling: 85,  energy: 0,  thermal: 15, landfill: 0,  process: 'Lead-free glass recycling' },
    { id: 'frc-res', code: 'FRC-RES', name: 'Residual / Shredder Fluff', eural_code: '19 12 12', recycling: 5,   energy: 45, thermal: 35, landfill: 15, process: 'Energy recovery or landfill' },
  ];

  for (const f of fractionsData) {
    await prisma.fractionMaster.upsert({
      where: { code: f.code },
      update: { name: f.name, eural_code: f.eural_code, recycling_pct_default: f.recycling, energy_recovery_pct_default: f.energy, thermal_disposal_pct_default: f.thermal, default_process_description: f.process },
      create: {
        id: f.id,
        code: f.code,
        name: f.name,
        eural_code: f.eural_code,
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: f.process,
        prepared_for_reuse_pct_default: 0,
        recycling_pct_default: f.recycling,
        other_material_recovery_pct_default: 0,
        energy_recovery_pct_default: f.energy,
        thermal_disposal_pct_default: f.thermal,
      },
    });
  }
  console.log('FractionMaster seeded.');

  // ─── MaterialFraction junctions ──────────────────────────────────────
  const materialFractionMap = {
    'mat-hdd': [{ frc: 'frc-fe', order: 1 }, { frc: 'frc-cu', order: 2 }, { frc: 'frc-pcb', order: 3 }, { frc: 'frc-al', order: 4 }, { frc: 'frc-res', order: 5 }],
    'mat-pcb': [{ frc: 'frc-pcb', order: 1 }, { frc: 'frc-cu', order: 2 }, { frc: 'frc-fe', order: 3 }, { frc: 'frc-res', order: 4 }],
    'mat-sha': [{ frc: 'frc-fe', order: 1 }, { frc: 'frc-pla', order: 2 }, { frc: 'frc-cu', order: 3 }, { frc: 'frc-al', order: 4 }, { frc: 'frc-pcb', order: 5 }, { frc: 'frc-res', order: 6 }],
    'mat-lha': [{ frc: 'frc-fe', order: 1 }, { frc: 'frc-cu', order: 2 }, { frc: 'frc-al', order: 3 }, { frc: 'frc-pla', order: 4 }, { frc: 'frc-res', order: 5 }],
    'mat-scr': [{ frc: 'frc-gls', order: 1 }, { frc: 'frc-fe', order: 2 }, { frc: 'frc-pla', order: 3 }, { frc: 'frc-pcb', order: 4 }, { frc: 'frc-cu', order: 5 }, { frc: 'frc-res', order: 6 }],
  };

  for (const [matId, fractions] of Object.entries(materialFractionMap)) {
    for (const { frc, order } of fractions) {
      await prisma.materialFraction.upsert({
        where: { material_id_fraction_id: { material_id: matId, fraction_id: frc } },
        update: { sort_order: order },
        create: { material_id: matId, fraction_id: frc, sort_order: order },
      });
    }
  }
  console.log('MaterialFraction junctions seeded.');

  // ─── Carriers (5) ───────────────────────────────────────────────────
  const carriersData = [
    { id: 'carrier-van-happen', name: 'Van Happen Recycling', kvk_number: '17115538', contact_name: 'Pieter de Vries', contact_email: 'logistiek@vanhappen.nl', contact_phone: '+31 13 507 7300', licence_number: 'VIHB-VH-2024' },
    { id: 'carrier-direct-dropoff', name: 'Direct Drop-off', kvk_number: null, contact_name: null, contact_email: null, contact_phone: null, licence_number: null },
    { id: 'carrier-renewi', name: 'Renewi Nederland B.V.', kvk_number: '16027822', contact_name: 'Sandra Kuijpers', contact_email: 'transport@renewi.com', contact_phone: '+31 76 597 6300', licence_number: 'VIHB-RN-2024' },
    { id: 'carrier-suez', name: 'SUEZ Recycling & Recovery NL', kvk_number: '24275657', contact_name: 'Mark Jansen', contact_email: 'planning@suez.nl', contact_phone: '+31 10 808 4500', licence_number: 'VIHB-SZ-2024' },
    { id: 'carrier-dejong', name: 'De Jong Transportservice', kvk_number: '30206974', contact_name: 'Kees de Jong', contact_email: 'info@dejongtransport.nl', contact_phone: '+31 78 654 3210', licence_number: 'VIHB-DJ-2024' },
  ];

  for (const c of carriersData) {
    await prisma.carrier.upsert({
      where: { id: c.id },
      update: { name: c.name, kvk_number: c.kvk_number, contact_name: c.contact_name, contact_email: c.contact_email, contact_phone: c.contact_phone, licence_number: c.licence_number },
      create: { ...c, is_active: true },
    });
  }
  console.log('Carriers seeded.');

  // ─── Suppliers (5) ──────────────────────────────────────────────────
  const suppliersData = [
    { id: 'supplier-stichting-open', name: 'Stichting Open', supplier_type: 'PRO', kvk_number: '41197598', btw_number: 'NL804682066B01', contact_name: 'Jan van der Berg', contact_email: 'contracten@stichting-open.nl', contact_phone: '+31 33 432 6700', address: 'Stationsplein 1, 3818 LE Amersfoort', pro_registration_number: 'PRO-NL-001' },
    { id: 'supplier-private-individual', name: 'Ad-hoc / Walk-in', supplier_type: 'PRIVATE_INDIVIDUAL' },
    { id: 'supplier-techrecycle', name: 'TechRecycle B.V.', supplier_type: 'THIRD_PARTY', kvk_number: '55667788', btw_number: 'NL987654321B01', contact_name: 'Marieke Visser', contact_email: 'info@techrecycle.nl', contact_phone: '+31 20 567 8901', address: 'Industrieweg 10, 1047 AA Amsterdam', vihb_number: 'VIHB-TR-2024' },
    { id: 'supplier-wecycle', name: 'Wecycle (Stichting NVMP)', supplier_type: 'PRO', kvk_number: '34124567', btw_number: 'NL812345678B01', contact_name: 'Annemiek de Groot', contact_email: 'inkoop@wecycle.nl', contact_phone: '+31 79 363 4100', address: 'Ptolemaeuslaan 80, 3528 BP Utrecht', pro_registration_number: 'PRO-NL-002' },
    { id: 'supplier-coolrec', name: 'Coolrec B.V.', supplier_type: 'THIRD_PARTY', kvk_number: '34198765', btw_number: 'NL823456789B01', contact_name: 'Bart Hendriks', contact_email: 'operations@coolrec.nl', contact_phone: '+31 40 250 7600', address: 'Meerheide 210, 5521 DW Eersel', vihb_number: 'VIHB-CR-2024' },
  ];

  for (const s of suppliersData) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name, kvk_number: s.kvk_number, btw_number: s.btw_number, contact_name: s.contact_name, contact_email: s.contact_email, contact_phone: s.contact_phone, address: s.address, vihb_number: s.vihb_number, pro_registration_number: s.pro_registration_number },
      create: { ...s, is_active: true },
    });
  }
  console.log('Suppliers seeded.');

  // ─── Supplier Afvalstroomnummers ────────────────────────────────────
  const asnData = [
    { supplier_id: 'supplier-stichting-open', afvalstroomnummer: 'AFS-2026-001' },
    { supplier_id: 'supplier-techrecycle', afvalstroomnummer: 'AFS-2026-003' },
    { supplier_id: 'supplier-wecycle', afvalstroomnummer: 'AFS-2026-004' },
    { supplier_id: 'supplier-coolrec', afvalstroomnummer: 'AFS-2026-005' },
  ];

  for (const a of asnData) {
    await prisma.supplierAfvalstroomnummer.upsert({
      where: { supplier_id_afvalstroomnummer: { supplier_id: a.supplier_id, afvalstroomnummer: a.afvalstroomnummer } },
      update: {},
      create: { supplier_id: a.supplier_id, afvalstroomnummer: a.afvalstroomnummer, waste_stream_id: weeeStream.id },
    });
  }
  console.log('Supplier afvalstroomnummers seeded.');

  // ─── System Settings ────────────────────────────────────────────────
  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  console.log('System settings seeded.');

  // ─── FeeMaster ──────────────────────────────────────────────────────
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

  // ─── Contracts (5) ──────────────────────────────────────────────────
  // Fetch fee IDs for contamination penalties
  const feeSurcharge = await prisma.feeMaster.findFirst({ where: { fee_type: 'CONTAMINATION_SURCHARGE' } });
  const feeFlat = await prisma.feeMaster.findFirst({ where: { fee_type: 'CONTAMINATION_FLAT' } });
  if (!feeSurcharge || !feeFlat) throw new Error('FeeMaster entries missing — cannot seed contracts');

  // Base rates per material (EUR/kg) and default processing methods
  const baseRates = {
    'mat-hdd': 0.045,
    'mat-pcb': 0.120,
    'mat-sha': 0.025,
    'mat-lha': 0.015,
    'mat-scr': 0.035,
  };
  const processingMethods = {
    'mat-hdd': 'R4: Recycling/recovery of metals and metal compounds',
    'mat-pcb': 'R4: Recycling/recovery of metals and metal compounds',
    'mat-sha': 'R3: Recycling/recovery of organic substances not used as solvents',
    'mat-lha': 'R3: Recycling/recovery of organic substances not used as solvents',
    'mat-scr': 'R5: Recycling/recovery of other inorganic substances',
  };

  const contractsData = [
    { number: 'CTR-00001', supplier_id: 'supplier-stichting-open', carrier_id: 'carrier-van-happen', name: '2026 Stichting Open WEEE Agreement', effective: '2026-01-01', expiry: '2026-12-31', freq: 'MONTHLY', term: 30, tolerance: 5.0, asn: 'AFS-2026-001', rateFactor: 1.0, penalties: [feeSurcharge, feeFlat] },
    { number: 'CTR-00002', supplier_id: 'supplier-techrecycle', carrier_id: 'carrier-renewi', name: '2026 TechRecycle WEEE Agreement', effective: '2026-01-01', expiry: '2026-12-31', freq: 'MONTHLY', term: 14, tolerance: 3.0, asn: 'AFS-2026-003', rateFactor: 0.95, penalties: [feeSurcharge] },
    { number: 'CTR-00003', supplier_id: 'supplier-wecycle', carrier_id: 'carrier-suez', name: '2026 Wecycle WEEE Agreement', effective: '2026-01-01', expiry: '2026-12-31', freq: 'QUARTERLY', term: 30, tolerance: 5.0, asn: 'AFS-2026-004', rateFactor: 1.05, penalties: [feeSurcharge, feeFlat] },
    { number: 'CTR-00004', supplier_id: 'supplier-coolrec', carrier_id: 'carrier-dejong', name: '2026 Coolrec WEEE Agreement', effective: '2026-03-01', expiry: '2027-02-28', freq: 'MONTHLY', term: 45, tolerance: 4.0, asn: 'AFS-2026-005', rateFactor: 0.90, penalties: [feeFlat] },
    { number: 'CTR-00005', supplier_id: 'supplier-stichting-open', carrier_id: 'carrier-direct-dropoff', name: '2026 Stichting Open Ad-hoc Drops', effective: '2026-01-01', expiry: '2026-12-31', freq: 'PER_ORDER', term: 30, tolerance: 2.0, asn: 'AFS-2026-001', rateFactor: 1.10, penalties: [feeSurcharge] },
  ];

  const materialIds = materialsData.map((m) => m.id);

  for (const c of contractsData) {
    // Delete existing contract and all children, then recreate (idempotent)
    const existing = await prisma.supplierContract.findFirst({ where: { contract_number: c.number } });
    if (existing) {
      await prisma.$transaction([
        prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: existing.id } }),
        prisma.contractRateLine.deleteMany({ where: { contract_id: existing.id } }),
        prisma.contractWasteStream.deleteMany({ where: { contract_id: existing.id } }),
        prisma.supplierContract.delete({ where: { id: existing.id } }),
      ]);
    }

    // Create contract with all children in a transaction
    await prisma.$transaction(async (tx) => {
      const contract = await tx.supplierContract.create({
        data: {
          contract_number: c.number,
          supplier_id: c.supplier_id,
          carrier_id: c.carrier_id,
          name: c.name,
          effective_date: new Date(c.effective),
          expiry_date: new Date(c.expiry),
          status: 'ACTIVE',
          receiver_name: 'Statice B.V.',
          payment_term_days: c.term,
          invoicing_frequency: c.freq,
          currency: 'EUR',
          contamination_tolerance_pct: c.tolerance,
        },
      });

      const cws = await tx.contractWasteStream.create({
        data: {
          contract_id: contract.id,
          waste_stream_id: weeeStream.id,
          afvalstroomnummer: c.asn,
        },
      });

      for (const matId of materialIds) {
        const rate = parseFloat((baseRates[matId] * c.rateFactor).toFixed(3));
        await tx.contractRateLine.create({
          data: {
            contract_id: contract.id,
            contract_waste_stream_id: cws.id,
            material_id: matId,
            pricing_model: 'WEIGHT',
            unit_rate: rate,
            btw_rate: 21,
            processing_method: processingMethods[matId] || null,
            valid_from: new Date(c.effective),
            valid_to: new Date(c.expiry),
          },
        });
      }

      for (const fee of c.penalties) {
        await tx.contractContaminationPenalty.create({
          data: { contract_id: contract.id, fee_id: fee.id },
        });
      }
    });

    console.log(`Contract ${c.number} seeded.`);
  }

  console.log('Master data seeding complete.');

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATIONAL DATA
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Vehicles (5) ──────────────────────────────────────────────────
  const vehiclesData = [
    { id: 'seed-vehicle-vh-001', registration_plate: 'NL-VH-142', carrier_id: 'carrier-van-happen', type: 'Truck' },
    { id: 'seed-vehicle-rn-001', registration_plate: 'NL-RN-308', carrier_id: 'carrier-renewi', type: 'Truck' },
    { id: 'seed-vehicle-sz-001', registration_plate: 'NL-SZ-517', carrier_id: 'carrier-suez', type: 'Truck' },
    { id: 'seed-vehicle-dj-001', registration_plate: 'NL-DJ-224', carrier_id: 'carrier-dejong', type: 'Truck' },
    { id: 'seed-vehicle-dd-001', registration_plate: 'NL-DD-099', carrier_id: 'carrier-direct-dropoff', type: 'Van' },
  ];

  for (const v of vehiclesData) {
    await prisma.vehicle.create({ data: v });
  }
  console.log('Vehicles seeded.');

  // ─── Processors (2) ───────────────────────────────────────────────
  const processorsData = [
    { id: 'seed-processor-metal', name: 'MetaalRecycling Noord', address: 'Industrieweg 45, 9723 AB Groningen', country: 'NL', environmental_permit_number: 'EP-2024-MRN-001', is_weeelabex_listed: true },
    { id: 'seed-processor-plastic', name: 'PlasticSort B.V.', address: 'Havenstraat 12, 3011 AJ Rotterdam', country: 'NL', environmental_permit_number: 'EP-2024-PSB-002', is_weeelabex_listed: false },
  ];

  for (const p of processorsData) {
    await prisma.processor.create({ data: p });
  }
  console.log('Processors seeded.');

  // ─── Inbound Orders (7) ───────────────────────────────────────────
  const ordersData = [
    { id: 'seed-order-001', order_number: 'ORD-00001', supplier_id: 'supplier-stichting-open', carrier_id: 'carrier-van-happen', planned_date: '2026-03-10', expected_skip_count: 2, status: 'COMPLETED', vehicle_plate: 'NL-VH-142', afvalstroomnummer: 'AFS-2026-001', received_asset_count: 2 },
    { id: 'seed-order-002', order_number: 'ORD-00002', supplier_id: 'supplier-techrecycle', carrier_id: 'carrier-renewi', planned_date: '2026-03-12', expected_skip_count: 1, status: 'COMPLETED', vehicle_plate: 'NL-RN-308', afvalstroomnummer: 'AFS-2026-003', received_asset_count: 1 },
    { id: 'seed-order-003', order_number: 'ORD-00003', supplier_id: 'supplier-wecycle', carrier_id: 'carrier-suez', planned_date: '2026-03-14', expected_skip_count: 3, status: 'COMPLETED', vehicle_plate: 'NL-SZ-517', afvalstroomnummer: 'AFS-2026-004', received_asset_count: 3 },
    { id: 'seed-order-004', order_number: 'ORD-00004', supplier_id: 'supplier-coolrec', carrier_id: 'carrier-dejong', planned_date: '2026-03-17', expected_skip_count: 1, status: 'COMPLETED', vehicle_plate: 'NL-DJ-224', afvalstroomnummer: 'AFS-2026-005', received_asset_count: 1 },
    { id: 'seed-order-005', order_number: 'ORD-00005', supplier_id: 'supplier-stichting-open', carrier_id: 'carrier-direct-dropoff', planned_date: '2026-03-20', expected_skip_count: 1, status: 'IN_PROGRESS', vehicle_plate: 'NL-DD-099', afvalstroomnummer: 'AFS-2026-001', received_asset_count: 1 },
    { id: 'seed-order-006', order_number: 'ORD-00006', supplier_id: 'supplier-techrecycle', carrier_id: 'carrier-renewi', planned_date: '2026-03-22', expected_skip_count: 1, status: 'ARRIVED', vehicle_plate: 'NL-RN-308', afvalstroomnummer: 'AFS-2026-003', received_asset_count: 1 },
    { id: 'seed-order-007', order_number: 'ORD-00007', supplier_id: 'supplier-wecycle', carrier_id: 'carrier-suez', planned_date: '2026-03-25', expected_skip_count: 2, status: 'PLANNED', vehicle_plate: 'NL-SZ-517', afvalstroomnummer: 'AFS-2026-004', received_asset_count: 0 },
  ];

  for (const o of ordersData) {
    await prisma.inboundOrder.create({
      data: {
        id: o.id,
        order_number: o.order_number,
        supplier_id: o.supplier_id,
        carrier_id: o.carrier_id,
        waste_stream_id: weeeStream.id,
        planned_date: new Date(o.planned_date),
        expected_skip_count: o.expected_skip_count,
        status: o.status,
        vehicle_plate: o.vehicle_plate,
        afvalstroomnummer: o.afvalstroomnummer,
        received_asset_count: o.received_asset_count,
        created_by: adminUser.id,
      },
    });
  }
  console.log('Inbound orders seeded.');

  // ─── OrderWasteStream junctions ───────────────────────────────────
  for (const o of ordersData) {
    await prisma.orderWasteStream.create({
      data: {
        order_id: o.id,
        waste_stream_id: weeeStream.id,
        afvalstroomnummer: o.afvalstroomnummer,
      },
    });
  }
  console.log('OrderWasteStream junctions seeded.');

  // ─── PfisterTickets ────────────────────────────────────────────────
  // Orders 1-5: gross + tare; Order 6: gross only
  const ticketsData = [
    // Order 1
    { id: 'seed-pst-g001', ticket_number: 'PST-2026-G001', weighing_type: 'GROSS', weight_kg: 5400, timestamp: '2026-03-10T08:15:00Z' },
    { id: 'seed-pst-t001', ticket_number: 'PST-2026-T001', weighing_type: 'TARE', weight_kg: 3300, timestamp: '2026-03-10T10:45:00Z' },
    // Order 2
    { id: 'seed-pst-g002', ticket_number: 'PST-2026-G002', weighing_type: 'GROSS', weight_kg: 3270, timestamp: '2026-03-12T09:00:00Z' },
    { id: 'seed-pst-t002', ticket_number: 'PST-2026-T002', weighing_type: 'TARE', weight_kg: 2500, timestamp: '2026-03-12T11:30:00Z' },
    // Order 3
    { id: 'seed-pst-g003', ticket_number: 'PST-2026-G003', weighing_type: 'GROSS', weight_kg: 6720, timestamp: '2026-03-14T07:30:00Z' },
    { id: 'seed-pst-t003', ticket_number: 'PST-2026-T003', weighing_type: 'TARE', weight_kg: 5000, timestamp: '2026-03-14T12:00:00Z' },
    // Order 4
    { id: 'seed-pst-g004', ticket_number: 'PST-2026-G004', weighing_type: 'GROSS', weight_kg: 4580, timestamp: '2026-03-17T08:45:00Z' },
    { id: 'seed-pst-t004', ticket_number: 'PST-2026-T004', weighing_type: 'TARE', weight_kg: 3500, timestamp: '2026-03-17T11:15:00Z' },
    // Order 5
    { id: 'seed-pst-g005', ticket_number: 'PST-2026-G005', weighing_type: 'GROSS', weight_kg: 2950, timestamp: '2026-03-20T09:30:00Z' },
    { id: 'seed-pst-t005', ticket_number: 'PST-2026-T005', weighing_type: 'TARE', weight_kg: 2500, timestamp: '2026-03-20T13:00:00Z' },
    // Order 6 — gross only
    { id: 'seed-pst-g006', ticket_number: 'PST-2026-G006', weighing_type: 'GROSS', weight_kg: 3100, timestamp: '2026-03-22T10:00:00Z' },
  ];

  for (const t of ticketsData) {
    await prisma.pfisterTicket.create({
      data: {
        id: t.id,
        ticket_number: t.ticket_number,
        weighing_type: t.weighing_type,
        weight_kg: t.weight_kg,
        timestamp: new Date(t.timestamp),
        raw_payload: JSON.stringify({ ticket_number: t.ticket_number, weight_kg: t.weight_kg, type: t.weighing_type, ts: t.timestamp }),
        is_confirmed: true,
      },
    });
  }
  console.log('PfisterTickets seeded.');

  // ─── Inbounds (for orders 1-6) ────────────────────────────────────
  const inboundsData = [
    { id: 'seed-inbound-001', inbound_number: 'INB-00001', order_id: 'seed-order-001', vehicle_id: 'seed-vehicle-vh-001', status: 'SORTED', arrived_at: '2026-03-10T08:10:00Z', gross_weight_kg: 5400, tare_weight_kg: 3300, net_weight_kg: 2100 },
    { id: 'seed-inbound-002', inbound_number: 'INB-00002', order_id: 'seed-order-002', vehicle_id: 'seed-vehicle-rn-001', status: 'SORTED', arrived_at: '2026-03-12T08:55:00Z', gross_weight_kg: 3270, tare_weight_kg: 2500, net_weight_kg: 770 },
    { id: 'seed-inbound-003', inbound_number: 'INB-00003', order_id: 'seed-order-003', vehicle_id: 'seed-vehicle-sz-001', status: 'SORTED', arrived_at: '2026-03-14T07:25:00Z', gross_weight_kg: 6720, tare_weight_kg: 5000, net_weight_kg: 1720 },
    { id: 'seed-inbound-004', inbound_number: 'INB-00004', order_id: 'seed-order-004', vehicle_id: 'seed-vehicle-dj-001', status: 'SORTED', arrived_at: '2026-03-17T08:40:00Z', gross_weight_kg: 4580, tare_weight_kg: 3500, net_weight_kg: 1080 },
    { id: 'seed-inbound-005', inbound_number: 'INB-00005', order_id: 'seed-order-005', vehicle_id: 'seed-vehicle-dd-001', status: 'READY_FOR_SORTING', arrived_at: '2026-03-20T09:25:00Z', gross_weight_kg: 2950, tare_weight_kg: 2500, net_weight_kg: 450 },
    { id: 'seed-inbound-006', inbound_number: 'INB-00006', order_id: 'seed-order-006', vehicle_id: 'seed-vehicle-rn-001', status: 'ARRIVED', arrived_at: '2026-03-22T09:55:00Z', gross_weight_kg: 3100, tare_weight_kg: null, net_weight_kg: null },
  ];

  for (const ib of inboundsData) {
    await prisma.inbound.create({
      data: {
        id: ib.id,
        inbound_number: ib.inbound_number,
        order_id: ib.order_id,
        vehicle_id: ib.vehicle_id,
        waste_stream_id: weeeStream.id,
        status: ib.status,
        arrived_at: new Date(ib.arrived_at),
        gross_weight_kg: ib.gross_weight_kg,
        tare_weight_kg: ib.tare_weight_kg,
        net_weight_kg: ib.net_weight_kg,
        confirmed_by: gateUser.id,
        confirmed_at: new Date(ib.arrived_at),
        match_strategy: 'EXACT_SAME_DAY',
      },
    });
  }
  console.log('Inbounds seeded.');

  // Link gross/tare tickets to inbounds
  const inboundTicketLinks = [
    { id: 'seed-inbound-001', gross: 'seed-pst-g001', tare: 'seed-pst-t001' },
    { id: 'seed-inbound-002', gross: 'seed-pst-g002', tare: 'seed-pst-t002' },
    { id: 'seed-inbound-003', gross: 'seed-pst-g003', tare: 'seed-pst-t003' },
    { id: 'seed-inbound-004', gross: 'seed-pst-g004', tare: 'seed-pst-t004' },
    { id: 'seed-inbound-005', gross: 'seed-pst-g005', tare: 'seed-pst-t005' },
    { id: 'seed-inbound-006', gross: 'seed-pst-g006', tare: null },
  ];

  for (const link of inboundTicketLinks) {
    await prisma.inbound.update({
      where: { id: link.id },
      data: {
        gross_ticket_id: link.gross,
        tare_ticket_id: link.tare,
      },
    });
  }
  console.log('Inbound ticket links set.');

  // ─── InboundWeighings ─────────────────────────────────────────────
  const weighingsData = [
    // Order 1
    { id: 'seed-iw-001-g', inbound_id: 'seed-inbound-001', sequence: 1, pfister_ticket_id: 'seed-pst-g001', weight_kg: 5400, is_tare: false },
    { id: 'seed-iw-001-t', inbound_id: 'seed-inbound-001', sequence: 2, pfister_ticket_id: 'seed-pst-t001', weight_kg: 3300, is_tare: true },
    // Order 2
    { id: 'seed-iw-002-g', inbound_id: 'seed-inbound-002', sequence: 1, pfister_ticket_id: 'seed-pst-g002', weight_kg: 3270, is_tare: false },
    { id: 'seed-iw-002-t', inbound_id: 'seed-inbound-002', sequence: 2, pfister_ticket_id: 'seed-pst-t002', weight_kg: 2500, is_tare: true },
    // Order 3
    { id: 'seed-iw-003-g', inbound_id: 'seed-inbound-003', sequence: 1, pfister_ticket_id: 'seed-pst-g003', weight_kg: 6720, is_tare: false },
    { id: 'seed-iw-003-t', inbound_id: 'seed-inbound-003', sequence: 2, pfister_ticket_id: 'seed-pst-t003', weight_kg: 5000, is_tare: true },
    // Order 4
    { id: 'seed-iw-004-g', inbound_id: 'seed-inbound-004', sequence: 1, pfister_ticket_id: 'seed-pst-g004', weight_kg: 4580, is_tare: false },
    { id: 'seed-iw-004-t', inbound_id: 'seed-inbound-004', sequence: 2, pfister_ticket_id: 'seed-pst-t004', weight_kg: 3500, is_tare: true },
    // Order 5
    { id: 'seed-iw-005-g', inbound_id: 'seed-inbound-005', sequence: 1, pfister_ticket_id: 'seed-pst-g005', weight_kg: 2950, is_tare: false },
    { id: 'seed-iw-005-t', inbound_id: 'seed-inbound-005', sequence: 2, pfister_ticket_id: 'seed-pst-t005', weight_kg: 2500, is_tare: true },
    // Order 6 — gross only
    { id: 'seed-iw-006-g', inbound_id: 'seed-inbound-006', sequence: 1, pfister_ticket_id: 'seed-pst-g006', weight_kg: 3100, is_tare: false },
  ];

  for (const w of weighingsData) {
    await prisma.inboundWeighing.create({ data: w });
  }
  console.log('InboundWeighings seeded.');

  // ─── Assets (containers/parcels) ──────────────────────────────────
  const assetsData = [
    // Order 1: 2 assets, net 2100 total
    { id: 'seed-asset-001-a', asset_label: 'P-00001', inbound_id: 'seed-inbound-001', container_type: 'OPEN_TOP', sequence: 1, gross_weighing_id: 'seed-iw-001-g', tare_weighing_id: 'seed-iw-001-t', net_weight_kg: 1200, gross_weight_kg: 3100, tare_weight_kg: 1900 },
    { id: 'seed-asset-001-b', asset_label: 'P-00002', inbound_id: 'seed-inbound-001', container_type: 'OPEN_TOP', sequence: 2, gross_weighing_id: 'seed-iw-001-g', tare_weighing_id: 'seed-iw-001-t', net_weight_kg: 900, gross_weight_kg: 2300, tare_weight_kg: 1400 },
    // Order 2: 1 asset, net 770
    { id: 'seed-asset-002-a', asset_label: 'P-00003', inbound_id: 'seed-inbound-002', container_type: 'GITTERBOX', sequence: 1, gross_weighing_id: 'seed-iw-002-g', tare_weighing_id: 'seed-iw-002-t', net_weight_kg: 770, gross_weight_kg: 3270, tare_weight_kg: 2500 },
    // Order 3: 3 assets, net 1720
    { id: 'seed-asset-003-a', asset_label: 'P-00004', inbound_id: 'seed-inbound-003', container_type: 'CLOSED_TOP', sequence: 1, gross_weighing_id: 'seed-iw-003-g', tare_weighing_id: 'seed-iw-003-t', net_weight_kg: 850, gross_weight_kg: 2800, tare_weight_kg: 1950 },
    { id: 'seed-asset-003-b', asset_label: 'P-00005', inbound_id: 'seed-inbound-003', container_type: 'GITTERBOX', sequence: 2, gross_weighing_id: 'seed-iw-003-g', tare_weighing_id: 'seed-iw-003-t', net_weight_kg: 350, gross_weight_kg: 1920, tare_weight_kg: 1570 },
    { id: 'seed-asset-003-c', asset_label: 'P-00006', inbound_id: 'seed-inbound-003', container_type: 'PALLET', sequence: 3, gross_weighing_id: 'seed-iw-003-g', tare_weighing_id: 'seed-iw-003-t', net_weight_kg: 520, gross_weight_kg: 2000, tare_weight_kg: 1480 },
    // Order 4: 1 asset, net 1080
    { id: 'seed-asset-004-a', asset_label: 'P-00007', inbound_id: 'seed-inbound-004', container_type: 'OPEN_TOP', sequence: 1, gross_weighing_id: 'seed-iw-004-g', tare_weighing_id: 'seed-iw-004-t', net_weight_kg: 1080, gross_weight_kg: 4580, tare_weight_kg: 3500 },
    // Order 5: 1 asset, net 450
    { id: 'seed-asset-005-a', asset_label: 'P-00008', inbound_id: 'seed-inbound-005', container_type: 'PALLET', sequence: 1, gross_weighing_id: 'seed-iw-005-g', tare_weighing_id: 'seed-iw-005-t', net_weight_kg: 450, gross_weight_kg: 2950, tare_weight_kg: 2500 },
    // Order 6: 1 asset, no tare yet
    { id: 'seed-asset-006-a', asset_label: 'P-00009', inbound_id: 'seed-inbound-006', container_type: 'GITTERBOX', sequence: 1, gross_weighing_id: 'seed-iw-006-g', tare_weighing_id: null, net_weight_kg: null, gross_weight_kg: 3100, tare_weight_kg: null },
  ];

  for (const a of assetsData) {
    await prisma.asset.create({
      data: {
        id: a.id,
        asset_label: a.asset_label,
        inbound_id: a.inbound_id,
        container_type: a.container_type,
        sequence: a.sequence,
        waste_stream_id: weeeStream.id,
        gross_weighing_id: a.gross_weighing_id,
        tare_weighing_id: a.tare_weighing_id,
        net_weight_kg: a.net_weight_kg,
        gross_weight_kg: a.gross_weight_kg,
        tare_weight_kg: a.tare_weight_kg,
      },
    });
  }
  console.log('Assets seeded.');

  // ─── SortingSessions (for inbounds 1-5) ───────────────────────────
  const sessionsData = [
    { id: 'seed-session-001', inbound_id: 'seed-inbound-001', order_id: 'seed-order-001', status: 'SORTED', catalogue_status: 'COMPLETED', processing_status: 'COMPLETED', recorded_at: '2026-03-10T14:00:00Z' },
    { id: 'seed-session-002', inbound_id: 'seed-inbound-002', order_id: 'seed-order-002', status: 'SORTED', catalogue_status: 'COMPLETED', processing_status: 'COMPLETED', recorded_at: '2026-03-12T14:00:00Z' },
    { id: 'seed-session-003', inbound_id: 'seed-inbound-003', order_id: 'seed-order-003', status: 'SORTED', catalogue_status: 'COMPLETED', processing_status: 'COMPLETED', recorded_at: '2026-03-14T14:00:00Z' },
    { id: 'seed-session-004', inbound_id: 'seed-inbound-004', order_id: 'seed-order-004', status: 'SORTED', catalogue_status: 'COMPLETED', processing_status: 'COMPLETED', recorded_at: '2026-03-17T14:00:00Z' },
    { id: 'seed-session-005', inbound_id: 'seed-inbound-005', order_id: 'seed-order-005', status: 'PLANNED', catalogue_status: 'NOT_STARTED', processing_status: 'NOT_STARTED', recorded_at: '2026-03-20T14:00:00Z' },
  ];

  for (const s of sessionsData) {
    await prisma.sortingSession.create({
      data: {
        id: s.id,
        inbound_id: s.inbound_id,
        order_id: s.order_id,
        recorded_by: sortingUser.id,
        recorded_at: new Date(s.recorded_at),
        status: s.status,
        catalogue_status: s.catalogue_status,
        processing_status: s.processing_status,
      },
    });
  }
  console.log('SortingSessions seeded.');

  // ─── AssetCatalogueEntries (for sessions 1-4) ─────────────────────
  // Lookup material data for snapshots
  const matLookup = {};
  for (const m of materialsData) {
    matLookup[m.id] = { code: m.code, name: m.name, weee_category: m.weee_category };
  }

  const catalogueData = [
    { id: 'seed-cat-001-a', session_id: 'seed-session-001', asset_id: 'seed-asset-001-a', material_id: 'mat-lha', weight_kg: 1200, entry_order: 1 },
    { id: 'seed-cat-001-b', session_id: 'seed-session-001', asset_id: 'seed-asset-001-b', material_id: 'mat-sha', weight_kg: 900, entry_order: 2 },
    { id: 'seed-cat-002-a', session_id: 'seed-session-002', asset_id: 'seed-asset-002-a', material_id: 'mat-pcb', weight_kg: 770, entry_order: 1 },
    { id: 'seed-cat-003-a', session_id: 'seed-session-003', asset_id: 'seed-asset-003-a', material_id: 'mat-scr', weight_kg: 850, entry_order: 1 },
    { id: 'seed-cat-003-b', session_id: 'seed-session-003', asset_id: 'seed-asset-003-b', material_id: 'mat-hdd', weight_kg: 350, entry_order: 2 },
    { id: 'seed-cat-003-c', session_id: 'seed-session-003', asset_id: 'seed-asset-003-c', material_id: 'mat-sha', weight_kg: 520, entry_order: 3 },
    { id: 'seed-cat-004-a', session_id: 'seed-session-004', asset_id: 'seed-asset-004-a', material_id: 'mat-lha', weight_kg: 1080, entry_order: 1 },
  ];

  for (const ce of catalogueData) {
    await prisma.assetCatalogueEntry.create({ data: ce });
  }
  console.log('AssetCatalogueEntries seeded.');

  // ─── ProcessingRecords + OutcomeLines ─────────────────────────────
  // Fraction split templates per material (fractionId, name, sharePct, route)
  const fractionSplits = {
    'mat-lha': [
      { frc: 'frc-fe',  name: 'Ferrous Metals',             pct: 60, route: 'RECYCLED' },
      { frc: 'frc-cu',  name: 'Copper',                     pct: 5,  route: 'RECYCLED' },
      { frc: 'frc-al',  name: 'Aluminium',                  pct: 4,  route: 'RECYCLED' },
      { frc: 'frc-pla', name: 'Plastics Mix',               pct: 15, route: 'RECYCLED' },
      { frc: 'frc-res', name: 'Residual / Shredder Fluff',  pct: 16, route: 'DISPOSED' },
    ],
    'mat-sha': [
      { frc: 'frc-fe',  name: 'Ferrous Metals',             pct: 50, route: 'RECYCLED' },
      { frc: 'frc-cu',  name: 'Copper',                     pct: 3,  route: 'RECYCLED' },
      { frc: 'frc-pla', name: 'Plastics Mix',               pct: 20, route: 'RECYCLED' },
      { frc: 'frc-res', name: 'Residual / Shredder Fluff',  pct: 27, route: 'DISPOSED' },
    ],
    'mat-pcb': [
      { frc: 'frc-pcb', name: 'Printed Circuit Boards',     pct: 45, route: 'RECYCLED' },
      { frc: 'frc-cu',  name: 'Copper',                     pct: 25, route: 'RECYCLED' },
      { frc: 'frc-fe',  name: 'Ferrous Metals',             pct: 10, route: 'RECYCLED' },
      { frc: 'frc-al',  name: 'Aluminium',                  pct: 5,  route: 'RECYCLED' },
      { frc: 'frc-res', name: 'Residual / Shredder Fluff',  pct: 15, route: 'DISPOSED' },
    ],
    'mat-scr': [
      { frc: 'frc-gls', name: 'Glass (screens)',            pct: 55, route: 'RECYCLED' },
      { frc: 'frc-fe',  name: 'Ferrous Metals',             pct: 15, route: 'RECYCLED' },
      { frc: 'frc-cu',  name: 'Copper',                     pct: 5,  route: 'RECYCLED' },
      { frc: 'frc-pla', name: 'Plastics Mix',               pct: 10, route: 'RECYCLED' },
      { frc: 'frc-res', name: 'Residual / Shredder Fluff',  pct: 15, route: 'DISPOSED' },
    ],
    'mat-hdd': [
      { frc: 'frc-fe',  name: 'Ferrous Metals',             pct: 55, route: 'RECYCLED' },
      { frc: 'frc-al',  name: 'Aluminium',                  pct: 20, route: 'RECYCLED' },
      { frc: 'frc-pcb', name: 'Printed Circuit Boards',     pct: 10, route: 'RECYCLED' },
      { frc: 'frc-cu',  name: 'Copper',                     pct: 5,  route: 'RECYCLED' },
      { frc: 'frc-res', name: 'Residual / Shredder Fluff',  pct: 10, route: 'DISPOSED' },
    ],
  };

  // Map catalogue entries → processing records
  const processingDateMap = {
    'seed-session-001': '2026-03-11',
    'seed-session-002': '2026-03-13',
    'seed-session-003': '2026-03-15',
    'seed-session-004': '2026-03-18',
  };

  let prCounter = 0;
  let olCounter = 0;

  for (const ce of catalogueData) {
    const mat = matLookup[ce.material_id];
    const procDate = new Date(processingDateMap[ce.session_id] + 'T10:00:00Z');
    prCounter++;
    const prId = `seed-pr-${String(prCounter).padStart(3, '0')}`;

    await prisma.processingRecord.create({
      data: {
        id: prId,
        session_id: ce.session_id,
        asset_id: ce.asset_id,
        catalogue_entry_id: ce.id,
        material_id: ce.material_id,
        material_code_snapshot: mat.code,
        material_name_snapshot: mat.name,
        weee_category_snapshot: mat.weee_category,
        status: 'CONFIRMED',
        version_no: 1,
        is_current: true,
        finalized_by: sortingUser.id,
        finalized_at: procDate,
        confirmed_by: sortingUser.id,
        confirmed_at: procDate,
        balance_delta_kg: 0,
      },
    });

    // Create outcome lines
    const splits = fractionSplits[ce.material_id];
    for (const split of splits) {
      olCounter++;
      const weightKg = parseFloat(((ce.weight_kg * split.pct) / 100).toFixed(1));
      const isRecycled = split.route === 'RECYCLED';

      await prisma.processingOutcomeLine.create({
        data: {
          id: `seed-ol-${String(olCounter).padStart(3, '0')}`,
          processing_record_id: prId,
          material_fraction: split.name,
          fraction_id: split.frc,
          weight_kg: weightKg,
          treatment_route: split.route,
          share_pct: split.pct,
          recycling_pct: isRecycled ? 100 : 0,
          thermal_disposal_pct: !isRecycled ? 100 : 0,
        },
      });
    }
  }
  console.log('ProcessingRecords and OutcomeLines seeded.');

  // ─── ContaminationIncident (order 3) ──────────────────────────────
  await prisma.contaminationIncident.create({
    data: {
      id: 'seed-contamination-001',
      incident_number: 'CON-00001',
      order_id: 'seed-order-003',
      sorting_session_id: 'seed-session-003',
      contamination_type: 'EXCESSIVE_MOISTURE',
      description: 'Excessive moisture detected in screen containers — water ingress during transport',
      contamination_weight_kg: 5.0,
      fee_amount: 0.75,
      fee_master_id: feeSurcharge.id,
      is_invoiced: false,
      recorded_by: financeUser.id,
    },
  });
  console.log('ContaminationIncident seeded.');

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
