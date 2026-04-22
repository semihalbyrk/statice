const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO_DATE = new Date('2026-04-13T09:00:00Z');

async function upsertUser({ email, password, full_name, role, is_active }) {
  const password_hash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { password_hash, full_name, role, is_active },
    create: { email, password_hash, full_name, role, is_active },
  });
}

async function ensureDefaultUsers() {
  const users = await Promise.all([
    upsertUser({
      email: 'admin@statice.nl',
      password: 'Admin1234!',
      full_name: 'Admin User',
      role: 'ADMIN',
      is_active: true,
    }),
    upsertUser({
      email: 'planner@statice.nl',
      password: 'Planner123!',
      full_name: 'Logistics Planner',
      role: 'LOGISTICS_PLANNER',
      is_active: true,
    }),
    upsertUser({
      email: 'gate@statice.nl',
      password: 'Gate1234!',
      full_name: 'Gate Operator',
      role: 'GATE_OPERATOR',
      is_active: true,
    }),
    upsertUser({
      email: 'sorting@statice.nl',
      password: 'Sorting123!',
      full_name: 'Sorting Employee',
      role: 'SORTING_EMPLOYEE',
      is_active: true,
    }),
    upsertUser({
      email: 'finance@statice.nl',
      password: 'Finance123!',
      full_name: 'Finance Manager',
      role: 'FINANCE_MANAGER',
      is_active: true,
    }),
    upsertUser({
      email: 'system@statice.nl',
      password: 'System!NoLogin!2026',
      full_name: 'System',
      role: 'ADMIN',
      is_active: false,
    }),
  ]);

  return {
    adminUser: users[0],
    plannerUser: users[1],
    gateUser: users[2],
    sortingUser: users[3],
    financeUser: users[4],
  };
}

async function ensureMasterData() {
  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {
      facility_name: 'Statice B.V.',
      facility_address: 'Recyclingweg 1, 1045 AA Amsterdam',
      facility_permit_number: 'ST-2026-001',
      facility_kvk: '12345678',
      report_footer_text: 'Statice B.V. — Demo Environment',
      max_skips_per_event: 10,
      config_json: { environment: 'demo' },
    },
    create: {
      id: 'singleton',
      facility_name: 'Statice B.V.',
      facility_address: 'Recyclingweg 1, 1045 AA Amsterdam',
      facility_permit_number: 'ST-2026-001',
      facility_kvk: '12345678',
      report_footer_text: 'Statice B.V. — Demo Environment',
      max_skips_per_event: 10,
      config_json: { environment: 'demo' },
    },
  });

  const wasteStream = await prisma.wasteStream.upsert({
    where: { code: 'WEEE' },
    update: {
      name: 'Waste Electrical and Electronic Equipment',
      cbs_code: 'CBS-WEEE',
      weeelabex_code: 'WL-WEEE',
      ewc_code: '20 01 35*',
      is_active: true,
    },
    create: {
      id: 'demo-ws-weee',
      code: 'WEEE',
      name: 'Waste Electrical and Electronic Equipment',
      cbs_code: 'CBS-WEEE',
      weeelabex_code: 'WL-WEEE',
      ewc_code: '20 01 35*',
      is_active: true,
    },
  });

  const categories = await Promise.all([
    prisma.productCategory.upsert({
      where: { code_cbs: 'WEEE-02' },
      update: {
        description_en: 'Small household appliances',
        description_nl: 'Kleine huishoudelijke apparaten',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 65,
        reused_pct_default: 12,
        disposed_pct_default: 18,
        is_active: true,
      },
      create: {
        id: 'demo-cat-sha',
        code_cbs: 'WEEE-02',
        description_en: 'Small household appliances',
        description_nl: 'Kleine huishoudelijke apparaten',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 65,
        reused_pct_default: 12,
        disposed_pct_default: 18,
        is_active: true,
      },
    }),
    prisma.productCategory.upsert({
      where: { code_cbs: 'WEEE-03' },
      update: {
        description_en: 'IT and telecom equipment',
        description_nl: 'IT- en telecomapparatuur',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 60,
        reused_pct_default: 20,
        disposed_pct_default: 15,
        is_active: true,
      },
      create: {
        id: 'demo-cat-it',
        code_cbs: 'WEEE-03',
        description_en: 'IT and telecom equipment',
        description_nl: 'IT- en telecomapparatuur',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 60,
        reused_pct_default: 20,
        disposed_pct_default: 15,
        is_active: true,
      },
    }),
    prisma.productCategory.upsert({
      where: { code_cbs: 'WEEE-11' },
      update: {
        description_en: 'Monitors and screens',
        description_nl: 'Beeldschermen',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 62,
        reused_pct_default: 10,
        disposed_pct_default: 22,
        is_active: true,
      },
      create: {
        id: 'demo-cat-scr',
        code_cbs: 'WEEE-11',
        description_en: 'Monitors and screens',
        description_nl: 'Beeldschermen',
        waste_stream_id: wasteStream.id,
        recycled_pct_default: 62,
        reused_pct_default: 10,
        disposed_pct_default: 22,
        is_active: true,
      },
    }),
  ]);

  const materials = await Promise.all([
    prisma.materialMaster.upsert({
      where: { code: 'MAT-SHA' },
      update: {
        name: 'Small Household Appliances',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-SHA',
        weeelabex_group: 'WL-SHA',
        eural_code: '20 01 36',
        weee_category: 'Cat. 2',
        legacy_category_id: categories[0].id,
        default_process_description: 'Shredding and multi-fraction sorting',
        is_active: true,
      },
      create: {
        id: 'demo-mat-sha',
        code: 'MAT-SHA',
        name: 'Small Household Appliances',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-SHA',
        weeelabex_group: 'WL-SHA',
        eural_code: '20 01 36',
        weee_category: 'Cat. 2',
        legacy_category_id: categories[0].id,
        default_process_description: 'Shredding and multi-fraction sorting',
        is_active: true,
      },
    }),
    prisma.materialMaster.upsert({
      where: { code: 'MAT-PCB' },
      update: {
        name: 'Printed Circuit Board Assemblies',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-PCB',
        weeelabex_group: 'WL-IT',
        eural_code: '20 01 35*',
        weee_category: 'Cat. 3',
        legacy_category_id: categories[1].id,
        default_process_description: 'Manual depollution and precious metal recovery',
        is_active: true,
      },
      create: {
        id: 'demo-mat-pcb',
        code: 'MAT-PCB',
        name: 'Printed Circuit Board Assemblies',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-PCB',
        weeelabex_group: 'WL-IT',
        eural_code: '20 01 35*',
        weee_category: 'Cat. 3',
        legacy_category_id: categories[1].id,
        default_process_description: 'Manual depollution and precious metal recovery',
        is_active: true,
      },
    }),
    prisma.materialMaster.upsert({
      where: { code: 'MAT-SCR' },
      update: {
        name: 'Screens and Monitors',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-SCR',
        weeelabex_group: 'WL-SCR',
        eural_code: '20 01 35*',
        weee_category: 'Cat. 2',
        legacy_category_id: categories[2].id,
        default_process_description: 'Manual dismantling and panel separation',
        is_active: true,
      },
      create: {
        id: 'demo-mat-scr',
        code: 'MAT-SCR',
        name: 'Screens and Monitors',
        waste_stream_id: wasteStream.id,
        cbs_code: 'CBS-SCR',
        weeelabex_group: 'WL-SCR',
        eural_code: '20 01 35*',
        weee_category: 'Cat. 2',
        legacy_category_id: categories[2].id,
        default_process_description: 'Manual dismantling and panel separation',
        is_active: true,
      },
    }),
  ]);

  const fractions = await Promise.all([
    prisma.fractionMaster.upsert({
      where: { code: 'FRC-FE' },
      update: {
        name: 'Ferrous Metals',
        eural_code: '19 12 02',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Magnetic separation and metal recycling',
        recycling_pct_default: 100,
        is_active: true,
      },
      create: {
        id: 'demo-frc-fe',
        code: 'FRC-FE',
        name: 'Ferrous Metals',
        eural_code: '19 12 02',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Magnetic separation and metal recycling',
        recycling_pct_default: 100,
        is_active: true,
      },
    }),
    prisma.fractionMaster.upsert({
      where: { code: 'FRC-PCB' },
      update: {
        name: 'PCB Rich Fraction',
        eural_code: '19 12 12',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Precious metal refining',
        recycling_pct_default: 35,
        energy_recovery_pct_default: 25,
        thermal_disposal_pct_default: 40,
        is_active: true,
      },
      create: {
        id: 'demo-frc-pcb',
        code: 'FRC-PCB',
        name: 'PCB Rich Fraction',
        eural_code: '19 12 12',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Precious metal refining',
        recycling_pct_default: 35,
        energy_recovery_pct_default: 25,
        thermal_disposal_pct_default: 40,
        is_active: true,
      },
    }),
    prisma.fractionMaster.upsert({
      where: { code: 'FRC-PLA' },
      update: {
        name: 'Plastics Mix',
        eural_code: '19 12 04',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Polymer sorting and granulation',
        recycling_pct_default: 60,
        energy_recovery_pct_default: 30,
        thermal_disposal_pct_default: 10,
        is_active: true,
      },
      create: {
        id: 'demo-frc-pla',
        code: 'FRC-PLA',
        name: 'Plastics Mix',
        eural_code: '19 12 04',
        default_acceptant_stage: 'FIRST_ACCEPTANT',
        default_process_description: 'Polymer sorting and granulation',
        recycling_pct_default: 60,
        energy_recovery_pct_default: 30,
        thermal_disposal_pct_default: 10,
        is_active: true,
      },
    }),
  ]);

  const materialFractionLinks = [
    ['mf-demo-sha-fe', materials[0].id, fractions[0].id, 1],
    ['mf-demo-sha-pla', materials[0].id, fractions[2].id, 2],
    ['mf-demo-pcb-pcb', materials[1].id, fractions[1].id, 1],
    ['mf-demo-scr-fe', materials[2].id, fractions[0].id, 1],
  ];

  for (const [id, material_id, fraction_id, sort_order] of materialFractionLinks) {
    await prisma.materialFraction.upsert({
      where: { id },
      update: { material_id, fraction_id, sort_order, is_active: true },
      create: { id, material_id, fraction_id, sort_order, is_active: true },
    });
  }

  await prisma.feeMaster.upsert({
    where: { id: 'demo-fee-sorting' },
    update: {
      fee_type: 'SORTING_SURCHARGE',
      description: 'Demo sorting surcharge',
      rate_type: 'PER_KG',
      rate_value: 0.15,
      min_cap: 0,
      max_cap: 500,
      is_active: true,
    },
    create: {
      id: 'demo-fee-sorting',
      fee_type: 'SORTING_SURCHARGE',
      description: 'Demo sorting surcharge',
      rate_type: 'PER_KG',
      rate_value: 0.15,
      min_cap: 0,
      max_cap: 500,
      is_active: true,
    },
  });

  await Promise.all([
    prisma.containerRegistry.upsert({
      where: { container_label: 'CNT-DEMO-001' },
      update: {
        container_type: 'OPEN_TOP',
        tare_weight_kg: 850,
        volume_m3: 40,
        notes: 'Demo 40m3 open top container',
        is_active: true,
      },
      create: {
        id: 'demo-container-001',
        container_label: 'CNT-DEMO-001',
        container_type: 'OPEN_TOP',
        tare_weight_kg: 850,
        volume_m3: 40,
        notes: 'Demo 40m3 open top container',
        is_active: true,
      },
    }),
    prisma.containerRegistry.upsert({
      where: { container_label: 'CNT-DEMO-002' },
      update: {
        container_type: 'GITTERBOX',
        tare_weight_kg: 120,
        volume_m3: 1.5,
        notes: 'Demo gitterbox container',
        is_active: true,
      },
      create: {
        id: 'demo-container-002',
        container_label: 'CNT-DEMO-002',
        container_type: 'GITTERBOX',
        tare_weight_kg: 120,
        volume_m3: 1.5,
        notes: 'Demo gitterbox container',
        is_active: true,
      },
    }),
  ]);

  return {
    wasteStream,
    categories,
    materials,
    fractions,
  };
}

async function ensurePartiesAndFleet() {
  const statice = await prisma.entity.upsert({
    where: { id: 'demo-entity-statice' },
    update: {
      company_name: 'Statice B.V.',
      street_and_number: 'Recyclingweg 1',
      postal_code: '1045AA',
      city: 'Amsterdam',
      country: 'NL',
      kvk_number: '12345678',
      btw_number: 'NL123456789B01',
      iban: 'NL91ABNA0417164300',
      vihb_number: 'VIHB-STATICE-001',
      environmental_permit_number: 'ENV-STATICE-2026',
      contact_name: 'Operations Desk',
      contact_email: 'operations@statice.nl',
      contact_phone: '+31 20 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: false,
      is_disposer: true,
      is_receiver: true,
      is_protected: true,
    },
    create: {
      id: 'demo-entity-statice',
      company_name: 'Statice B.V.',
      street_and_number: 'Recyclingweg 1',
      postal_code: '1045AA',
      city: 'Amsterdam',
      country: 'NL',
      kvk_number: '12345678',
      btw_number: 'NL123456789B01',
      iban: 'NL91ABNA0417164300',
      vihb_number: 'VIHB-STATICE-001',
      environmental_permit_number: 'ENV-STATICE-2026',
      contact_name: 'Operations Desk',
      contact_email: 'operations@statice.nl',
      contact_phone: '+31 20 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: false,
      is_disposer: true,
      is_receiver: true,
      is_protected: true,
    },
  });

  const stichtingOpen = await prisma.entity.upsert({
    where: { id: 'demo-entity-stichting-open' },
    update: {
      company_name: 'Stichting OPEN Demo',
      street_and_number: 'WEEElaan 12',
      postal_code: '3811AA',
      city: 'Amersfoort',
      country: 'NL',
      kvk_number: '76543210',
      btw_number: 'NL765432109B01',
      iban: 'NL18RABO0123456789',
      vihb_number: 'VIHB-OPEN-001',
      environmental_permit_number: 'ENV-OPEN-001',
      contact_name: 'Sourcing Desk',
      contact_email: 'planning@open-demo.nl',
      contact_phone: '+31 33 555 0101',
      status: 'ACTIVE',
      is_supplier: true,
      is_receiver: false,
      is_disposer: true,
      supplier_type: 'PRO',
      supplier_roles: ['ONTDOENER'],
      pro_registration_number: 'PRO-OPEN-2026',
    },
    create: {
      id: 'demo-entity-stichting-open',
      company_name: 'Stichting OPEN Demo',
      street_and_number: 'WEEElaan 12',
      postal_code: '3811AA',
      city: 'Amersfoort',
      country: 'NL',
      kvk_number: '76543210',
      btw_number: 'NL765432109B01',
      iban: 'NL18RABO0123456789',
      vihb_number: 'VIHB-OPEN-001',
      environmental_permit_number: 'ENV-OPEN-001',
      contact_name: 'Sourcing Desk',
      contact_email: 'planning@open-demo.nl',
      contact_phone: '+31 33 555 0101',
      status: 'ACTIVE',
      is_supplier: true,
      is_receiver: false,
      is_disposer: true,
      supplier_type: 'PRO',
      supplier_roles: ['ONTDOENER'],
      pro_registration_number: 'PRO-OPEN-2026',
    },
  });

  const techRecycle = await prisma.entity.upsert({
    where: { id: 'demo-entity-techrecycle' },
    update: {
      company_name: 'TechRecycle Demo',
      street_and_number: 'Circular Park 8',
      postal_code: '3011AB',
      city: 'Rotterdam',
      country: 'NL',
      kvk_number: '44556677',
      btw_number: 'NL445566778B01',
      iban: 'NL52INGB0123987654',
      vihb_number: 'VIHB-TECH-001',
      environmental_permit_number: 'ENV-TECH-001',
      contact_name: 'Inbound Planning',
      contact_email: 'ops@techrecycle-demo.nl',
      contact_phone: '+31 10 555 0101',
      status: 'ACTIVE',
      is_supplier: true,
      is_receiver: false,
      is_disposer: true,
      supplier_type: 'COMMERCIAL',
      supplier_roles: ['ONTDOENER'],
      pro_registration_number: 'PRO-TECH-2026',
    },
    create: {
      id: 'demo-entity-techrecycle',
      company_name: 'TechRecycle Demo',
      street_and_number: 'Circular Park 8',
      postal_code: '3011AB',
      city: 'Rotterdam',
      country: 'NL',
      kvk_number: '44556677',
      btw_number: 'NL445566778B01',
      iban: 'NL52INGB0123987654',
      vihb_number: 'VIHB-TECH-001',
      environmental_permit_number: 'ENV-TECH-001',
      contact_name: 'Inbound Planning',
      contact_email: 'ops@techrecycle-demo.nl',
      contact_phone: '+31 10 555 0101',
      status: 'ACTIVE',
      is_supplier: true,
      is_receiver: false,
      is_disposer: true,
      supplier_type: 'COMMERCIAL',
      supplier_roles: ['ONTDOENER'],
      pro_registration_number: 'PRO-TECH-2026',
    },
  });

  const vanHappenEntity = await prisma.entity.upsert({
    where: { id: 'demo-entity-van-happen' },
    update: {
      company_name: 'Van Happen Demo Logistics',
      street_and_number: 'Transportweg 21',
      postal_code: '5611AA',
      city: 'Eindhoven',
      country: 'NL',
      kvk_number: '22113344',
      btw_number: 'NL221133445B01',
      iban: 'NL39RABO0987654321',
      vihb_number: 'VIHB-VH-001',
      contact_name: 'Dispatch',
      contact_email: 'dispatch@vanhappen-demo.nl',
      contact_phone: '+31 40 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: true,
      is_disposer: false,
      is_receiver: false,
    },
    create: {
      id: 'demo-entity-van-happen',
      company_name: 'Van Happen Demo Logistics',
      street_and_number: 'Transportweg 21',
      postal_code: '5611AA',
      city: 'Eindhoven',
      country: 'NL',
      kvk_number: '22113344',
      btw_number: 'NL221133445B01',
      iban: 'NL39RABO0987654321',
      vihb_number: 'VIHB-VH-001',
      contact_name: 'Dispatch',
      contact_email: 'dispatch@vanhappen-demo.nl',
      contact_phone: '+31 40 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: true,
      is_disposer: false,
      is_receiver: false,
    },
  });

  const renewiEntity = await prisma.entity.upsert({
    where: { id: 'demo-entity-renewi' },
    update: {
      company_name: 'Renewi Demo Nederland B.V.',
      street_and_number: 'Industriestraat 55',
      postal_code: '5041AB',
      city: 'Tilburg',
      country: 'NL',
      kvk_number: '99887766',
      btw_number: 'NL998877665B01',
      iban: 'NL65ABNA0987654321',
      vihb_number: 'VIHB-RNW-001',
      environmental_permit_number: 'ENV-RNW-001',
      contact_name: 'Outbound Planning',
      contact_email: 'outbound@renewi-demo.nl',
      contact_phone: '+31 13 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: true,
      is_disposer: false,
      is_receiver: true,
    },
    create: {
      id: 'demo-entity-renewi',
      company_name: 'Renewi Demo Nederland B.V.',
      street_and_number: 'Industriestraat 55',
      postal_code: '5041AB',
      city: 'Tilburg',
      country: 'NL',
      kvk_number: '99887766',
      btw_number: 'NL998877665B01',
      iban: 'NL65ABNA0987654321',
      vihb_number: 'VIHB-RNW-001',
      environmental_permit_number: 'ENV-RNW-001',
      contact_name: 'Outbound Planning',
      contact_email: 'outbound@renewi-demo.nl',
      contact_phone: '+31 13 555 0101',
      status: 'ACTIVE',
      is_supplier: false,
      is_transporter: true,
      is_disposer: false,
      is_receiver: true,
    },
  });

  const disposerSite = await prisma.disposerSite.upsert({
    where: { id: 'demo-site-statice-yard' },
    update: {
      entity_id: statice.id,
      site_name: 'Statice Main Yard',
      street_and_number: 'Recyclingweg 1',
      postal_code: '1045AA',
      city: 'Amsterdam',
      country: 'NL',
      environmental_permit_number: 'ENV-STATICE-YARD',
      status: 'ACTIVE',
    },
    create: {
      id: 'demo-site-statice-yard',
      entity_id: statice.id,
      site_name: 'Statice Main Yard',
      street_and_number: 'Recyclingweg 1',
      postal_code: '1045AA',
      city: 'Amsterdam',
      country: 'NL',
      environmental_permit_number: 'ENV-STATICE-YARD',
      status: 'ACTIVE',
    },
  });

  const carrierVanHappen = await prisma.carrier.upsert({
    where: { id: 'demo-carrier-van-happen' },
    update: {
      name: 'Van Happen Demo Logistics',
      kvk_number: '22113344',
      contact_name: 'Dispatch',
      contact_email: 'dispatch@vanhappen-demo.nl',
      contact_phone: '+31 40 555 0101',
      licence_number: 'VIHB-VH-001',
      is_active: true,
      migrated_to_entity_id: vanHappenEntity.id,
    },
    create: {
      id: 'demo-carrier-van-happen',
      name: 'Van Happen Demo Logistics',
      kvk_number: '22113344',
      contact_name: 'Dispatch',
      contact_email: 'dispatch@vanhappen-demo.nl',
      contact_phone: '+31 40 555 0101',
      licence_number: 'VIHB-VH-001',
      is_active: true,
      migrated_to_entity_id: vanHappenEntity.id,
    },
  });

  const carrierRenewi = await prisma.carrier.upsert({
    where: { id: 'demo-carrier-renewi' },
    update: {
      name: 'Renewi Demo Transport',
      kvk_number: '99887766',
      contact_name: 'Outbound Planning',
      contact_email: 'outbound@renewi-demo.nl',
      contact_phone: '+31 13 555 0101',
      licence_number: 'VIHB-RNW-001',
      is_active: true,
      migrated_to_entity_id: renewiEntity.id,
    },
    create: {
      id: 'demo-carrier-renewi',
      name: 'Renewi Demo Transport',
      kvk_number: '99887766',
      contact_name: 'Outbound Planning',
      contact_email: 'outbound@renewi-demo.nl',
      contact_phone: '+31 13 555 0101',
      licence_number: 'VIHB-RNW-001',
      is_active: true,
      migrated_to_entity_id: renewiEntity.id,
    },
  });

  const supplierOpen = await prisma.supplier.upsert({
    where: { id: 'demo-supplier-open' },
    update: {
      name: 'Stichting OPEN Demo',
      supplier_type: 'PRO',
      kvk_number: '76543210',
      btw_number: 'NL765432109B01',
      iban: 'NL18RABO0123456789',
      contact_name: 'Sourcing Desk',
      contact_email: 'planning@open-demo.nl',
      contact_phone: '+31 33 555 0101',
      address: 'WEEElaan 12, 3811AA Amersfoort',
      vihb_number: 'VIHB-OPEN-001',
      pro_registration_number: 'PRO-OPEN-2026',
      is_active: true,
      migrated_to_entity_id: stichtingOpen.id,
    },
    create: {
      id: 'demo-supplier-open',
      name: 'Stichting OPEN Demo',
      supplier_type: 'PRO',
      kvk_number: '76543210',
      btw_number: 'NL765432109B01',
      iban: 'NL18RABO0123456789',
      contact_name: 'Sourcing Desk',
      contact_email: 'planning@open-demo.nl',
      contact_phone: '+31 33 555 0101',
      address: 'WEEElaan 12, 3811AA Amersfoort',
      vihb_number: 'VIHB-OPEN-001',
      pro_registration_number: 'PRO-OPEN-2026',
      is_active: true,
      migrated_to_entity_id: stichtingOpen.id,
    },
  });

  const supplierTech = await prisma.supplier.upsert({
    where: { id: 'demo-supplier-tech' },
    update: {
      name: 'TechRecycle Demo',
      supplier_type: 'THIRD_PARTY',
      kvk_number: '44556677',
      btw_number: 'NL445566778B01',
      iban: 'NL52INGB0123987654',
      contact_name: 'Inbound Planning',
      contact_email: 'ops@techrecycle-demo.nl',
      contact_phone: '+31 10 555 0101',
      address: 'Circular Park 8, 3011AB Rotterdam',
      vihb_number: 'VIHB-TECH-001',
      pro_registration_number: 'PRO-TECH-2026',
      is_active: true,
      migrated_to_entity_id: techRecycle.id,
    },
    create: {
      id: 'demo-supplier-tech',
      name: 'TechRecycle Demo',
      supplier_type: 'THIRD_PARTY',
      kvk_number: '44556677',
      btw_number: 'NL445566778B01',
      iban: 'NL52INGB0123987654',
      contact_name: 'Inbound Planning',
      contact_email: 'ops@techrecycle-demo.nl',
      contact_phone: '+31 10 555 0101',
      address: 'Circular Park 8, 3011AB Rotterdam',
      vihb_number: 'VIHB-TECH-001',
      pro_registration_number: 'PRO-TECH-2026',
      is_active: true,
      migrated_to_entity_id: techRecycle.id,
    },
  });

  await Promise.all([
    prisma.vehicle.upsert({
      where: { registration_plate: 'DEMO-VH-001' },
      update: { carrier_id: carrierVanHappen.id, type: 'Truck + trailer' },
      create: {
        id: 'demo-vehicle-001',
        registration_plate: 'DEMO-VH-001',
        carrier_id: carrierVanHappen.id,
        type: 'Truck + trailer',
      },
    }),
    prisma.vehicle.upsert({
      where: { registration_plate: 'DEMO-RN-001' },
      update: { carrier_id: carrierRenewi.id, type: 'Curtainsider truck' },
      create: {
        id: 'demo-vehicle-002',
        registration_plate: 'DEMO-RN-001',
        carrier_id: carrierRenewi.id,
        type: 'Curtainsider truck',
      },
    }),
  ]);

  return {
    statice,
    stichtingOpen,
    techRecycle,
    vanHappenEntity,
    renewiEntity,
    disposerSite,
    carrierVanHappen,
    carrierRenewi,
    supplierOpen,
    supplierTech,
  };
}

async function ensureContractsAndOperations(context) {
  const { adminUser, gateUser, sortingUser, financeUser, materials, fractions, wasteStream, parties } = context;

  await prisma.supplierAfvalstroomnummer.upsert({
    where: {
      supplier_id_afvalstroomnummer: {
        supplier_id: parties.supplierOpen.id,
        afvalstroomnummer: 'ASN-DEMO-IN-001',
      },
    },
    update: { waste_stream_id: wasteStream.id, is_active: true },
    create: {
      id: 'demo-supplier-asn-001',
      supplier_id: parties.supplierOpen.id,
      afvalstroomnummer: 'ASN-DEMO-IN-001',
      waste_stream_id: wasteStream.id,
      is_active: true,
    },
  });

  await prisma.supplierAfvalstroomnummer.upsert({
    where: {
      supplier_id_afvalstroomnummer: {
        supplier_id: parties.supplierTech.id,
        afvalstroomnummer: 'ASN-DEMO-IN-002',
      },
    },
    update: { waste_stream_id: wasteStream.id, is_active: true },
    create: {
      id: 'demo-supplier-asn-002',
      supplier_id: parties.supplierTech.id,
      afvalstroomnummer: 'ASN-DEMO-IN-002',
      waste_stream_id: wasteStream.id,
      is_active: true,
    },
  });

  const incomingContract = await prisma.supplierContract.upsert({
    where: { contract_number: 'CTR-DEMO-IN-001' },
    update: {
      supplier_id: parties.supplierOpen.id,
      carrier_id: parties.carrierVanHappen.id,
      entity_supplier_id: parties.stichtingOpen.id,
      agreement_transporter_id: parties.vanHappenEntity.id,
      contract_type: 'INCOMING',
      name: 'Demo Incoming WEEE Contract',
      effective_date: new Date('2026-01-01'),
      expiry_date: new Date('2026-12-31'),
      status: 'ACTIVE',
      receiver_name: 'Statice B.V.',
      payment_term_days: 30,
      invoicing_frequency: 'MONTHLY',
      currency: 'EUR',
      contamination_tolerance_pct: 5,
      is_active: true,
    },
    create: {
      id: 'demo-contract-in-001',
      contract_number: 'CTR-DEMO-IN-001',
      supplier_id: parties.supplierOpen.id,
      carrier_id: parties.carrierVanHappen.id,
      entity_supplier_id: parties.stichtingOpen.id,
      agreement_transporter_id: parties.vanHappenEntity.id,
      contract_type: 'INCOMING',
      name: 'Demo Incoming WEEE Contract',
      effective_date: new Date('2026-01-01'),
      expiry_date: new Date('2026-12-31'),
      status: 'ACTIVE',
      receiver_name: 'Statice B.V.',
      payment_term_days: 30,
      invoicing_frequency: 'MONTHLY',
      currency: 'EUR',
      contamination_tolerance_pct: 5,
      is_active: true,
    },
  });

  const incomingCws = await prisma.contractWasteStream.upsert({
    where: {
      contract_id_waste_stream_id: {
        contract_id: incomingContract.id,
        waste_stream_id: wasteStream.id,
      },
    },
    update: {
      afvalstroomnummer: 'ASN-DEMO-IN-001',
      receiver_id: parties.statice.id,
    },
    create: {
      id: 'demo-contract-in-cws-001',
      contract_id: incomingContract.id,
      waste_stream_id: wasteStream.id,
      afvalstroomnummer: 'ASN-DEMO-IN-001',
      receiver_id: parties.statice.id,
    },
  });

  await prisma.contractRateLine.upsert({
    where: { id: 'demo-contract-in-rate-001' },
    update: {
      contract_id: incomingContract.id,
      contract_waste_stream_id: incomingCws.id,
      material_id: materials[0].id,
      pricing_model: 'WEIGHT',
      unit_rate: 0.045,
      btw_rate: 21,
      processing_method: 'R4: Sorting and downstream recycling',
      valid_from: new Date('2026-01-01'),
      valid_to: new Date('2026-12-31'),
      superseded_at: null,
    },
    create: {
      id: 'demo-contract-in-rate-001',
      contract_id: incomingContract.id,
      contract_waste_stream_id: incomingCws.id,
      material_id: materials[0].id,
      pricing_model: 'WEIGHT',
      unit_rate: 0.045,
      btw_rate: 21,
      processing_method: 'R4: Sorting and downstream recycling',
      valid_from: new Date('2026-01-01'),
      valid_to: new Date('2026-12-31'),
    },
  });

  const outgoingContract = await prisma.supplierContract.upsert({
    where: { contract_number: 'CTR-DEMO-OUT-001' },
    update: {
      contract_type: 'OUTGOING',
      buyer_id: parties.renewiEntity.id,
      sender_id: parties.statice.id,
      disposer_id: parties.statice.id,
      disposer_site_id: parties.disposerSite.id,
      agreement_transporter_id: parties.vanHappenEntity.id,
      invoice_entity_id: parties.renewiEntity.id,
      shipment_type: 'DOMESTIC_NL',
      name: 'Demo Outgoing WEEE Contract',
      effective_date: new Date('2026-01-01'),
      expiry_date: new Date('2026-12-31'),
      status: 'ACTIVE',
      payment_term_days: 21,
      invoicing_frequency: 'MONTHLY',
      currency: 'EUR',
      receiver_name: 'Renewi Demo Nederland B.V.',
      is_active: true,
    },
    create: {
      id: 'demo-contract-out-001',
      contract_number: 'CTR-DEMO-OUT-001',
      contract_type: 'OUTGOING',
      buyer_id: parties.renewiEntity.id,
      sender_id: parties.statice.id,
      disposer_id: parties.statice.id,
      disposer_site_id: parties.disposerSite.id,
      agreement_transporter_id: parties.vanHappenEntity.id,
      invoice_entity_id: parties.renewiEntity.id,
      shipment_type: 'DOMESTIC_NL',
      name: 'Demo Outgoing WEEE Contract',
      effective_date: new Date('2026-01-01'),
      expiry_date: new Date('2026-12-31'),
      status: 'ACTIVE',
      payment_term_days: 21,
      invoicing_frequency: 'MONTHLY',
      currency: 'EUR',
      receiver_name: 'Renewi Demo Nederland B.V.',
      is_active: true,
    },
  });

  const outgoingCws = await prisma.contractWasteStream.upsert({
    where: {
      contract_id_waste_stream_id: {
        contract_id: outgoingContract.id,
        waste_stream_id: wasteStream.id,
      },
    },
    update: {
      afvalstroomnummer: 'ASN-DEMO-OUT-001',
      receiver_id: parties.renewiEntity.id,
    },
    create: {
      id: 'demo-contract-out-cws-001',
      contract_id: outgoingContract.id,
      waste_stream_id: wasteStream.id,
      afvalstroomnummer: 'ASN-DEMO-OUT-001',
      receiver_id: parties.renewiEntity.id,
    },
  });

  await prisma.contractRateLine.upsert({
    where: { id: 'demo-contract-out-rate-001' },
    update: {
      contract_id: outgoingContract.id,
      contract_waste_stream_id: outgoingCws.id,
      material_id: materials[0].id,
      pricing_model: 'WEIGHT',
      unit_rate: 0.035,
      btw_rate: 21,
      processing_method: 'R4: Outbound shipment to downstream recycler',
      valid_from: new Date('2026-01-01'),
      valid_to: new Date('2026-12-31'),
      superseded_at: null,
    },
    create: {
      id: 'demo-contract-out-rate-001',
      contract_id: outgoingContract.id,
      contract_waste_stream_id: outgoingCws.id,
      material_id: materials[0].id,
      pricing_model: 'WEIGHT',
      unit_rate: 0.035,
      btw_rate: 21,
      processing_method: 'R4: Outbound shipment to downstream recycler',
      valid_from: new Date('2026-01-01'),
      valid_to: new Date('2026-12-31'),
    },
  });

  const inboundOrder1 = await prisma.inboundOrder.upsert({
    where: { order_number: 'ORD-DEMO-001' },
    update: {
      carrier_id: parties.carrierVanHappen.id,
      supplier_id: parties.supplierOpen.id,
      planned_date: new Date('2026-04-05'),
      planned_time_window_start: new Date('2026-04-05T08:00:00Z'),
      planned_time_window_end: new Date('2026-04-05T10:00:00Z'),
      expected_skip_count: 1,
      waste_stream_id: wasteStream.id,
      vehicle_plate: 'DEMO-VH-001',
      afvalstroomnummer: 'ASN-DEMO-IN-001',
      notes: 'Demo sorted inbound for parcel lifecycle testing',
      status: 'COMPLETED',
      client_reference: 'DEMO-INBOUND-REF-001',
      created_by: adminUser.id,
      entity_supplier_id: parties.stichtingOpen.id,
      transporter_id: parties.vanHappenEntity.id,
    },
    create: {
      id: 'demo-order-001',
      order_number: 'ORD-DEMO-001',
      carrier_id: parties.carrierVanHappen.id,
      supplier_id: parties.supplierOpen.id,
      planned_date: new Date('2026-04-05'),
      planned_time_window_start: new Date('2026-04-05T08:00:00Z'),
      planned_time_window_end: new Date('2026-04-05T10:00:00Z'),
      expected_skip_count: 1,
      waste_stream_id: wasteStream.id,
      vehicle_plate: 'DEMO-VH-001',
      afvalstroomnummer: 'ASN-DEMO-IN-001',
      notes: 'Demo sorted inbound for parcel lifecycle testing',
      status: 'COMPLETED',
      client_reference: 'DEMO-INBOUND-REF-001',
      created_by: adminUser.id,
      entity_supplier_id: parties.stichtingOpen.id,
      transporter_id: parties.vanHappenEntity.id,
    },
  });

  const inboundOrder2 = await prisma.inboundOrder.upsert({
    where: { order_number: 'ORD-DEMO-002' },
    update: {
      carrier_id: parties.carrierRenewi.id,
      supplier_id: parties.supplierTech.id,
      planned_date: new Date('2026-04-10'),
      planned_time_window_start: new Date('2026-04-10T09:00:00Z'),
      planned_time_window_end: new Date('2026-04-10T11:00:00Z'),
      expected_skip_count: 1,
      waste_stream_id: wasteStream.id,
      vehicle_plate: 'DEMO-RN-001',
      afvalstroomnummer: 'ASN-DEMO-IN-002',
      notes: 'Demo ready-for-sorting inbound',
      status: 'IN_PROGRESS',
      client_reference: 'DEMO-INBOUND-REF-002',
      created_by: adminUser.id,
      entity_supplier_id: parties.techRecycle.id,
      transporter_id: parties.renewiEntity.id,
    },
    create: {
      id: 'demo-order-002',
      order_number: 'ORD-DEMO-002',
      carrier_id: parties.carrierRenewi.id,
      supplier_id: parties.supplierTech.id,
      planned_date: new Date('2026-04-10'),
      planned_time_window_start: new Date('2026-04-10T09:00:00Z'),
      planned_time_window_end: new Date('2026-04-10T11:00:00Z'),
      expected_skip_count: 1,
      waste_stream_id: wasteStream.id,
      vehicle_plate: 'DEMO-RN-001',
      afvalstroomnummer: 'ASN-DEMO-IN-002',
      notes: 'Demo ready-for-sorting inbound',
      status: 'IN_PROGRESS',
      client_reference: 'DEMO-INBOUND-REF-002',
      created_by: adminUser.id,
      entity_supplier_id: parties.techRecycle.id,
      transporter_id: parties.renewiEntity.id,
    },
  });

  for (const [id, order_id, afvalstroomnummer, planned_amount_kg] of [
    ['demo-order-ws-001', inboundOrder1.id, 'ASN-DEMO-IN-001', 1450],
    ['demo-order-ws-002', inboundOrder2.id, 'ASN-DEMO-IN-002', 980],
  ]) {
    await prisma.orderWasteStream.upsert({
      where: { id },
      update: { order_id, waste_stream_id: wasteStream.id, afvalstroomnummer, planned_amount_kg },
      create: { id, order_id, waste_stream_id: wasteStream.id, afvalstroomnummer, planned_amount_kg },
    });
  }

  const pfisterGross1 = await prisma.pfisterTicket.upsert({
    where: { ticket_number: 'PST-DEMO-001-G' },
    update: {
      weighing_type: 'GROSS',
      weight_kg: 3400,
      unit: 'kg',
      timestamp: new Date('2026-04-05T08:22:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-001-G', weight_kg: 3400 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T08:23:00Z'),
      device_id: 'WB_1',
    },
    create: {
      id: 'demo-pfister-001-g',
      ticket_number: 'PST-DEMO-001-G',
      weighing_type: 'GROSS',
      weight_kg: 3400,
      unit: 'kg',
      timestamp: new Date('2026-04-05T08:22:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-001-G', weight_kg: 3400 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T08:23:00Z'),
      device_id: 'WB_1',
    },
  });

  const pfisterTare1 = await prisma.pfisterTicket.upsert({
    where: { ticket_number: 'PST-DEMO-001-T' },
    update: {
      weighing_type: 'TARE',
      weight_kg: 1950,
      unit: 'kg',
      timestamp: new Date('2026-04-05T10:14:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-001-T', weight_kg: 1950 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T10:15:00Z'),
      device_id: 'WB_1',
    },
    create: {
      id: 'demo-pfister-001-t',
      ticket_number: 'PST-DEMO-001-T',
      weighing_type: 'TARE',
      weight_kg: 1950,
      unit: 'kg',
      timestamp: new Date('2026-04-05T10:14:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-001-T', weight_kg: 1950 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T10:15:00Z'),
      device_id: 'WB_1',
    },
  });

  const pfisterGross2 = await prisma.pfisterTicket.upsert({
    where: { ticket_number: 'PST-DEMO-002-G' },
    update: {
      weighing_type: 'GROSS',
      weight_kg: 2300,
      unit: 'kg',
      timestamp: new Date('2026-04-10T09:34:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-002-G', weight_kg: 2300 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-10T09:35:00Z'),
      device_id: 'WB_1',
    },
    create: {
      id: 'demo-pfister-002-g',
      ticket_number: 'PST-DEMO-002-G',
      weighing_type: 'GROSS',
      weight_kg: 2300,
      unit: 'kg',
      timestamp: new Date('2026-04-10T09:34:00Z'),
      raw_payload: JSON.stringify({ ticket: 'PST-DEMO-002-G', weight_kg: 2300 }),
      is_confirmed: true,
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-10T09:35:00Z'),
      device_id: 'WB_1',
    },
  });

  const inbound1 = await prisma.inbound.upsert({
    where: { inbound_number: 'INB-DEMO-001' },
    update: {
      order_id: inboundOrder1.id,
      vehicle_id: 'demo-vehicle-001',
      waste_stream_id: wasteStream.id,
      arrived_at: new Date('2026-04-05T08:15:00Z'),
      gross_ticket_id: pfisterGross1.id,
      tare_ticket_id: pfisterTare1.id,
      gross_weight_kg: 3400,
      tare_weight_kg: 1950,
      net_weight_kg: 1450,
      status: 'SORTED',
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T10:20:00Z'),
      notes: 'Sorted demo inbound',
      match_strategy: 'EXACT_SAME_DAY',
      matched_by: gateUser.id,
      matched_at: new Date('2026-04-05T08:18:00Z'),
      is_manual_match: false,
      device_id: 'WB_1',
      weighing_mode: 'SWAP',
    },
    create: {
      id: 'demo-inbound-001',
      inbound_number: 'INB-DEMO-001',
      order_id: inboundOrder1.id,
      vehicle_id: 'demo-vehicle-001',
      waste_stream_id: wasteStream.id,
      arrived_at: new Date('2026-04-05T08:15:00Z'),
      gross_ticket_id: pfisterGross1.id,
      tare_ticket_id: pfisterTare1.id,
      gross_weight_kg: 3400,
      tare_weight_kg: 1950,
      net_weight_kg: 1450,
      status: 'SORTED',
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-05T10:20:00Z'),
      notes: 'Sorted demo inbound',
      match_strategy: 'EXACT_SAME_DAY',
      matched_by: gateUser.id,
      matched_at: new Date('2026-04-05T08:18:00Z'),
      is_manual_match: false,
      device_id: 'WB_1',
      weighing_mode: 'SWAP',
    },
  });

  const inbound2 = await prisma.inbound.upsert({
    where: { inbound_number: 'INB-DEMO-002' },
    update: {
      order_id: inboundOrder2.id,
      vehicle_id: 'demo-vehicle-002',
      waste_stream_id: wasteStream.id,
      arrived_at: new Date('2026-04-10T09:30:00Z'),
      gross_ticket_id: pfisterGross2.id,
      tare_ticket_id: null,
      gross_weight_kg: 2300,
      tare_weight_kg: null,
      net_weight_kg: null,
      status: 'ARRIVED',
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-10T09:36:00Z'),
      notes: 'Fresh inbound awaiting tare weighing',
      match_strategy: 'EXACT_WINDOW',
      matched_by: gateUser.id,
      matched_at: new Date('2026-04-10T09:32:00Z'),
      is_manual_match: false,
      device_id: 'WB_1',
      weighing_mode: 'DIRECT',
    },
    create: {
      id: 'demo-inbound-002',
      inbound_number: 'INB-DEMO-002',
      order_id: inboundOrder2.id,
      vehicle_id: 'demo-vehicle-002',
      waste_stream_id: wasteStream.id,
      arrived_at: new Date('2026-04-10T09:30:00Z'),
      gross_ticket_id: pfisterGross2.id,
      tare_ticket_id: null,
      gross_weight_kg: 2300,
      tare_weight_kg: null,
      net_weight_kg: null,
      status: 'ARRIVED',
      confirmed_by: gateUser.id,
      confirmed_at: new Date('2026-04-10T09:36:00Z'),
      notes: 'Fresh inbound awaiting tare weighing',
      match_strategy: 'EXACT_WINDOW',
      matched_by: gateUser.id,
      matched_at: new Date('2026-04-10T09:32:00Z'),
      is_manual_match: false,
      device_id: 'WB_1',
      weighing_mode: 'DIRECT',
    },
  });

  for (const weighing of [
    ['demo-inbound-weighing-001', inbound1.id, 1, pfisterGross1.id, 3400, false],
    ['demo-inbound-weighing-002', inbound1.id, 2, pfisterTare1.id, 1950, true],
    ['demo-inbound-weighing-003', inbound2.id, 1, pfisterGross2.id, 2300, false],
  ]) {
    const [id, inbound_id, sequence, pfister_ticket_id, weight_kg, is_tare] = weighing;
    await prisma.inboundWeighing.upsert({
      where: { pfister_ticket_id },
      update: { inbound_id, sequence, weight_kg, is_tare },
      create: { id, inbound_id, sequence, pfister_ticket_id, weight_kg, is_tare },
    });
  }

  const asset1 = await prisma.asset.upsert({
    where: { asset_label: 'AST-DEMO-001' },
    update: {
      inbound_id: inbound1.id,
      parcel_type: 'CONTAINER',
      container_type: 'OPEN_TOP',
      container_label: 'CNT-DEMO-001',
      estimated_tare_weight_kg: 850,
      material_category_id: context.categories[0].id,
      waste_stream_id: wasteStream.id,
      sequence: 1,
      estimated_volume_m3: 40,
      gross_weighing_id: 'demo-inbound-weighing-001',
      tare_weighing_id: 'demo-inbound-weighing-002',
      gross_weight_kg: 3400,
      tare_weight_kg: 1950,
      net_weight_kg: 1450,
      notes: 'Primary inbound parcel demo record',
    },
    create: {
      id: 'demo-asset-001',
      asset_label: 'AST-DEMO-001',
      inbound_id: inbound1.id,
      parcel_type: 'CONTAINER',
      container_type: 'OPEN_TOP',
      container_label: 'CNT-DEMO-001',
      estimated_tare_weight_kg: 850,
      material_category_id: context.categories[0].id,
      waste_stream_id: wasteStream.id,
      sequence: 1,
      estimated_volume_m3: 40,
      gross_weighing_id: 'demo-inbound-weighing-001',
      tare_weighing_id: 'demo-inbound-weighing-002',
      gross_weight_kg: 3400,
      tare_weight_kg: 1950,
      net_weight_kg: 1450,
      notes: 'Primary inbound parcel demo record',
    },
  });

  const asset2 = await prisma.asset.upsert({
    where: { asset_label: 'AST-DEMO-002' },
    update: {
      inbound_id: inbound2.id,
      parcel_type: 'CONTAINER',
      container_type: 'GITTERBOX',
      container_label: 'CNT-DEMO-002',
      estimated_tare_weight_kg: 120,
      material_category_id: context.categories[1].id,
      waste_stream_id: wasteStream.id,
      sequence: 1,
      estimated_volume_m3: 1.5,
      gross_weighing_id: 'demo-inbound-weighing-003',
      tare_weighing_id: null,
      gross_weight_kg: 2300,
      tare_weight_kg: null,
      net_weight_kg: null,
      notes: 'Secondary inbound parcel awaiting tare',
    },
    create: {
      id: 'demo-asset-002',
      asset_label: 'AST-DEMO-002',
      inbound_id: inbound2.id,
      parcel_type: 'CONTAINER',
      container_type: 'GITTERBOX',
      container_label: 'CNT-DEMO-002',
      estimated_tare_weight_kg: 120,
      material_category_id: context.categories[1].id,
      waste_stream_id: wasteStream.id,
      sequence: 1,
      estimated_volume_m3: 1.5,
      gross_weighing_id: 'demo-inbound-weighing-003',
      tare_weighing_id: null,
      gross_weight_kg: 2300,
      tare_weight_kg: null,
      net_weight_kg: null,
      notes: 'Secondary inbound parcel awaiting tare',
    },
  });

  const sortingSession = await prisma.sortingSession.upsert({
    where: { inbound_id: inbound1.id },
    update: {
      order_id: inboundOrder1.id,
      recorded_by: sortingUser.id,
      recorded_at: new Date('2026-04-05T13:00:00Z'),
      status: 'SORTED',
      catalogue_status: 'COMPLETED',
      processing_status: 'COMPLETED',
      notes: 'Demo completed sorting session',
    },
    create: {
      id: 'demo-sorting-session-001',
      inbound_id: inbound1.id,
      order_id: inboundOrder1.id,
      recorded_by: sortingUser.id,
      recorded_at: new Date('2026-04-05T13:00:00Z'),
      status: 'SORTED',
      catalogue_status: 'COMPLETED',
      processing_status: 'COMPLETED',
      notes: 'Demo completed sorting session',
    },
  });

  await prisma.assetCatalogueEntry.upsert({
    where: { id: 'demo-catalogue-entry-001' },
    update: {
      session_id: sortingSession.id,
      asset_id: asset1.id,
      material_id: materials[0].id,
      weight_kg: 1450,
      reuse_eligible_quantity: 3,
      notes: 'Demo catalogue entry for SHA lot',
      entry_order: 1,
    },
    create: {
      id: 'demo-catalogue-entry-001',
      session_id: sortingSession.id,
      asset_id: asset1.id,
      material_id: materials[0].id,
      weight_kg: 1450,
      reuse_eligible_quantity: 3,
      notes: 'Demo catalogue entry for SHA lot',
      entry_order: 1,
    },
  });

  await prisma.processingRecord.upsert({
    where: { id: 'demo-processing-record-001' },
    update: {
      session_id: sortingSession.id,
      asset_id: asset1.id,
      catalogue_entry_id: 'demo-catalogue-entry-001',
      material_id: materials[0].id,
      material_code_snapshot: materials[0].code,
      material_name_snapshot: materials[0].name,
      weee_category_snapshot: materials[0].weee_category,
      status: 'CONFIRMED',
      version_no: 1,
      is_current: true,
      finalized_by: sortingUser.id,
      finalized_at: new Date('2026-04-05T14:20:00Z'),
      confirmed_by: sortingUser.id,
      confirmed_at: new Date('2026-04-05T14:30:00Z'),
      reason_code: 'DEMO_FINAL',
      reason_notes: 'Demo processing record fully confirmed',
      balance_delta_kg: 0,
    },
    create: {
      id: 'demo-processing-record-001',
      session_id: sortingSession.id,
      asset_id: asset1.id,
      catalogue_entry_id: 'demo-catalogue-entry-001',
      material_id: materials[0].id,
      material_code_snapshot: materials[0].code,
      material_name_snapshot: materials[0].name,
      weee_category_snapshot: materials[0].weee_category,
      status: 'CONFIRMED',
      version_no: 1,
      is_current: true,
      finalized_by: sortingUser.id,
      finalized_at: new Date('2026-04-05T14:20:00Z'),
      confirmed_by: sortingUser.id,
      confirmed_at: new Date('2026-04-05T14:30:00Z'),
      reason_code: 'DEMO_FINAL',
      reason_notes: 'Demo processing record fully confirmed',
      balance_delta_kg: 0,
    },
  });

  for (const outcome of [
    {
      id: 'demo-processing-outcome-001',
      processing_record_id: 'demo-processing-record-001',
      material_fraction: 'Ferrous Metals',
      fraction_id: fractions[0].id,
      weight_kg: 900,
      treatment_route: 'RECYCLED',
      process_description: 'Metals recovered and baled',
      share_pct: 62.07,
      prepared_for_reuse_pct: 0,
      recycling_pct: 100,
      other_material_recovery_pct: 0,
      energy_recovery_pct: 0,
      thermal_disposal_pct: 0,
      notes: 'Main ferrous recovery stream',
    },
    {
      id: 'demo-processing-outcome-002',
      processing_record_id: 'demo-processing-record-001',
      material_fraction: 'Plastics Mix',
      fraction_id: fractions[2].id,
      weight_kg: 550,
      treatment_route: 'RECYCLED',
      process_description: 'Polymer sort and granulation',
      share_pct: 37.93,
      prepared_for_reuse_pct: 0,
      recycling_pct: 60,
      other_material_recovery_pct: 0,
      energy_recovery_pct: 30,
      thermal_disposal_pct: 10,
      notes: 'Recovered mixed plastics stream',
    },
  ]) {
    await prisma.processingOutcomeLine.upsert({
      where: { id: outcome.id },
      update: outcome,
      create: outcome,
    });
  }

  await prisma.reusableItem.upsert({
    where: { id: 'demo-reusable-item-001' },
    update: {
      catalogue_entry_id: 'demo-catalogue-entry-001',
      material_id: materials[0].id,
      brand: 'DemoBrand',
      model_name: 'Compact Unit',
      type: 'Appliance',
      serial_number: 'RB-001',
      condition: 'B-grade',
      notes: 'Reusable sample item from demo intake',
    },
    create: {
      id: 'demo-reusable-item-001',
      catalogue_entry_id: 'demo-catalogue-entry-001',
      material_id: materials[0].id,
      brand: 'DemoBrand',
      model_name: 'Compact Unit',
      type: 'Appliance',
      serial_number: 'RB-001',
      condition: 'B-grade',
      notes: 'Reusable sample item from demo intake',
    },
  });

  const outboundOrder = await prisma.outboundOrder.upsert({
    where: { order_number: 'OO-DEMO-001' },
    update: {
      contract_id: outgoingContract.id,
      buyer_id: parties.renewiEntity.id,
      sender_id: parties.statice.id,
      disposer_id: parties.statice.id,
      disposer_site_id: parties.disposerSite.id,
      transporter_id: parties.vanHappenEntity.id,
      outsourced_transporter_id: parties.renewiEntity.id,
      vehicle_plate: 'DEMO-VH-001',
      planned_date: new Date('2026-04-12'),
      planned_time_start: new Date('2026-04-12T07:00:00Z'),
      planned_time_end: new Date('2026-04-12T09:00:00Z'),
      shipment_type: 'DOMESTIC_NL',
      expected_outbounds: 2,
      status: 'IN_PROGRESS',
      notes: 'Demo outbound order with shipped, assigned and available parcels',
      created_by: adminUser.id,
    },
    create: {
      id: 'demo-outbound-order-001',
      order_number: 'OO-DEMO-001',
      contract_id: outgoingContract.id,
      buyer_id: parties.renewiEntity.id,
      sender_id: parties.statice.id,
      disposer_id: parties.statice.id,
      disposer_site_id: parties.disposerSite.id,
      transporter_id: parties.vanHappenEntity.id,
      outsourced_transporter_id: parties.renewiEntity.id,
      vehicle_plate: 'DEMO-VH-001',
      planned_date: new Date('2026-04-12'),
      planned_time_start: new Date('2026-04-12T07:00:00Z'),
      planned_time_end: new Date('2026-04-12T09:00:00Z'),
      shipment_type: 'DOMESTIC_NL',
      expected_outbounds: 2,
      status: 'IN_PROGRESS',
      notes: 'Demo outbound order with shipped, assigned and available parcels',
      created_by: adminUser.id,
    },
  });

  await prisma.outboundOrderWasteStream.upsert({
    where: {
      outbound_order_id_waste_stream_id: {
        outbound_order_id: outboundOrder.id,
        waste_stream_id: wasteStream.id,
      },
    },
    update: {
      receiver_id: parties.renewiEntity.id,
      asn: 'ASN-DEMO-OUT-001',
      material_id: materials[0].id,
      processing_method: 'R4: Outbound recovery shipment',
      planned_amount_kg: 2200,
    },
    create: {
      id: 'demo-outbound-order-ws-001',
      outbound_order_id: outboundOrder.id,
      waste_stream_id: wasteStream.id,
      receiver_id: parties.renewiEntity.id,
      asn: 'ASN-DEMO-OUT-001',
      material_id: materials[0].id,
      processing_method: 'R4: Outbound recovery shipment',
      planned_amount_kg: 2200,
    },
  });

  const outbound1 = await prisma.outbound.upsert({
    where: { outbound_number: 'OUT-DEMO-001' },
    update: {
      outbound_order_id: outboundOrder.id,
      vehicle_plate: 'DEMO-VH-001',
      status: 'DEPARTED',
      gross_weight_kg: 4200,
      tare_weight_kg: 2600,
      net_weight_kg: 1600,
      loading_started_at: new Date('2026-04-12T07:05:00Z'),
      weighing_completed_at: new Date('2026-04-12T08:10:00Z'),
      documents_ready_at: new Date('2026-04-12T08:20:00Z'),
      departed_at: new Date('2026-04-12T08:45:00Z'),
      delivered_at: null,
      notes: 'Demo departed outbound shipment',
      created_by: adminUser.id,
    },
    create: {
      id: 'demo-outbound-001',
      outbound_number: 'OUT-DEMO-001',
      outbound_order_id: outboundOrder.id,
      vehicle_plate: 'DEMO-VH-001',
      status: 'DEPARTED',
      gross_weight_kg: 4200,
      tare_weight_kg: 2600,
      net_weight_kg: 1600,
      loading_started_at: new Date('2026-04-12T07:05:00Z'),
      weighing_completed_at: new Date('2026-04-12T08:10:00Z'),
      documents_ready_at: new Date('2026-04-12T08:20:00Z'),
      departed_at: new Date('2026-04-12T08:45:00Z'),
      delivered_at: null,
      notes: 'Demo departed outbound shipment',
      created_by: adminUser.id,
    },
  });

  const outbound2 = await prisma.outbound.upsert({
    where: { outbound_number: 'OUT-DEMO-002' },
    update: {
      outbound_order_id: outboundOrder.id,
      vehicle_plate: 'DEMO-VH-001',
      status: 'CREATED',
      gross_weight_kg: null,
      tare_weight_kg: null,
      net_weight_kg: null,
      loading_started_at: null,
      weighing_completed_at: null,
      documents_ready_at: null,
      departed_at: null,
      delivered_at: null,
      notes: 'Demo created outbound awaiting loading',
      created_by: adminUser.id,
    },
    create: {
      id: 'demo-outbound-002',
      outbound_number: 'OUT-DEMO-002',
      outbound_order_id: outboundOrder.id,
      vehicle_plate: 'DEMO-VH-001',
      status: 'CREATED',
      notes: 'Demo created outbound awaiting loading',
      created_by: adminUser.id,
    },
  });

  for (const weighing of [
    ['demo-outbound-weighing-001', outbound1.id, 'TARE', 2600, 'MANUAL', 'DEMO-TARE-001', gateUser.id, 'Tare weighing for demo outbound'],
    ['demo-outbound-weighing-002', outbound1.id, 'GROSS', 4200, 'MANUAL', 'DEMO-GROSS-001', gateUser.id, 'Gross weighing for demo outbound'],
  ]) {
    const [id, outbound_id, weighing_type, weight_kg, source, ticket_number, recorded_by, notes] = weighing;
    await prisma.outboundWeighingRecord.upsert({
      where: { id },
      update: { outbound_id, weighing_type, weight_kg, source, ticket_number, recorded_by, notes },
      create: { id, outbound_id, weighing_type, weight_kg, source, ticket_number, recorded_by, notes },
    });
  }

  const pdfDir = path.join(__dirname, '..', 'storage', 'outbound-documents', 'demo');
  fs.mkdirSync(pdfDir, { recursive: true });
  const pdfPath = path.join(pdfDir, 'demo-bgl-out-001.pdf');
  if (!fs.existsSync(pdfPath)) {
    fs.writeFileSync(
      pdfPath,
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 52 >>\nstream\nBT /F1 12 Tf 36 96 Td (Demo Begeleidingsbrief) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
    );
  }

  await prisma.outboundDocument.upsert({
    where: { id: 'demo-outbound-doc-001' },
    update: {
      outbound_id: outbound1.id,
      document_type: 'BEGELEIDINGSBRIEF',
      status: 'GENERATED',
      file_name: 'demo-bgl-out-001.pdf',
      storage_path: 'server/storage/outbound-documents/demo/demo-bgl-out-001.pdf',
      generated_at: new Date('2026-04-12T08:20:00Z'),
      generated_by: adminUser.id,
    },
    create: {
      id: 'demo-outbound-doc-001',
      outbound_id: outbound1.id,
      document_type: 'BEGELEIDINGSBRIEF',
      status: 'GENERATED',
      file_name: 'demo-bgl-out-001.pdf',
      storage_path: 'server/storage/outbound-documents/demo/demo-bgl-out-001.pdf',
      generated_at: new Date('2026-04-12T08:20:00Z'),
      generated_by: adminUser.id,
    },
  });

  for (const parcel of [
    {
      id: 'demo-outbound-parcel-001',
      parcel_label: 'OPR-DEMO-001',
      outbound_id: outbound1.id,
      material_id: materials[0].id,
      container_type: 'OPEN_TOP',
      volume_m3: 40,
      tare_weight_kg: 1200,
      description: 'Depolluted SHA load from demo sorting',
      notes: 'Shipped parcel linked to departed outbound',
      status: 'SHIPPED',
      created_by: adminUser.id,
    },
    {
      id: 'demo-outbound-parcel-002',
      parcel_label: 'OPR-DEMO-002',
      outbound_id: outbound1.id,
      material_id: materials[1].id,
      container_type: 'GITTERBOX',
      volume_m3: 1.5,
      tare_weight_kg: 400,
      description: 'PCB-rich fraction for downstream precious metal recovery',
      notes: 'Second shipped parcel on departed outbound',
      status: 'SHIPPED',
      created_by: adminUser.id,
    },
    {
      id: 'demo-outbound-parcel-003',
      parcel_label: 'OPR-DEMO-003',
      outbound_id: outbound2.id,
      material_id: materials[2].id,
      container_type: 'PALLET',
      volume_m3: 2.5,
      tare_weight_kg: 250,
      description: 'Monitors pallet prepared for next outbound',
      notes: 'Assigned parcel on created outbound',
      status: 'ASSIGNED',
      created_by: adminUser.id,
    },
    {
      id: 'demo-outbound-parcel-004',
      parcel_label: 'OPR-DEMO-004',
      outbound_id: null,
      material_id: materials[0].id,
      container_type: 'OPEN_TOP',
      volume_m3: 20,
      tare_weight_kg: 600,
      description: 'Available outbound parcel waiting for assignment',
      notes: 'Available parcel in yard inventory',
      status: 'AVAILABLE',
      created_by: adminUser.id,
    },
  ]) {
    await prisma.outboundParcel.upsert({
      where: { parcel_label: parcel.parcel_label },
      update: parcel,
      create: parcel,
    });
  }

  await prisma.invoice.upsert({
    where: { invoice_number: 'INV-DEMO-001' },
    update: {
      status: 'FINALIZED',
      supplier_id: parties.supplierOpen.id,
      contract_id: incomingContract.id,
      invoice_date: new Date('2026-04-08'),
      due_date: new Date('2026-05-08'),
      currency: 'EUR',
      subtotal: 65.25,
      btw_total: 13.70,
      total_amount: 78.95,
      notes: 'Demo invoice for inbound contract and order',
      recipient_name: parties.stichtingOpen.company_name,
      recipient_address: 'WEEElaan 12, 3811AA Amersfoort',
      created_by: financeUser.id,
    },
    create: {
      id: 'demo-invoice-001',
      invoice_number: 'INV-DEMO-001',
      status: 'FINALIZED',
      supplier_id: parties.supplierOpen.id,
      contract_id: incomingContract.id,
      invoice_date: new Date('2026-04-08'),
      due_date: new Date('2026-05-08'),
      currency: 'EUR',
      subtotal: 65.25,
      btw_total: 13.70,
      total_amount: 78.95,
      notes: 'Demo invoice for inbound contract and order',
      recipient_name: parties.stichtingOpen.company_name,
      recipient_address: 'WEEElaan 12, 3811AA Amersfoort',
      created_by: financeUser.id,
    },
  });

  await prisma.invoiceLine.upsert({
    where: { id: 'demo-invoice-line-001' },
    update: {
      invoice_id: 'demo-invoice-001',
      order_id: inboundOrder1.id,
      material_id: materials[0].id,
      description: 'Inbound handling for SHA lot',
      line_type: 'material',
      quantity: 1450,
      unit: 'kg',
      unit_rate: 0.045,
      btw_rate: 21,
      line_subtotal: 65.25,
      btw_amount: 13.70,
      line_total: 78.95,
      sort_order: 1,
    },
    create: {
      id: 'demo-invoice-line-001',
      invoice_id: 'demo-invoice-001',
      order_id: inboundOrder1.id,
      material_id: materials[0].id,
      description: 'Inbound handling for SHA lot',
      line_type: 'material',
      quantity: 1450,
      unit: 'kg',
      unit_rate: 0.045,
      btw_rate: 21,
      line_subtotal: 65.25,
      btw_amount: 13.70,
      line_total: 78.95,
      sort_order: 1,
    },
  });

  return {
    incomingContract,
    outgoingContract,
    inboundOrder1,
    inboundOrder2,
    inbound1,
    inbound2,
    outboundOrder,
    outbound1,
    outbound2,
    asset1,
    asset2,
  };
}

async function main() {
  console.log('Seeding non-destructive demo data...');

  const { adminUser, plannerUser, gateUser, sortingUser, financeUser } = await ensureDefaultUsers();
  const master = await ensureMasterData();
  const parties = await ensurePartiesAndFleet();
  const operations = await ensureContractsAndOperations({
    adminUser,
    plannerUser,
    gateUser,
    sortingUser,
    financeUser,
    ...master,
    parties,
  });

  const summary = {
    users: await prisma.user.count(),
    entities: await prisma.entity.count(),
    suppliers: await prisma.supplier.count(),
    carriers: await prisma.carrier.count(),
    vehicles: await prisma.vehicle.count(),
    contracts: await prisma.supplierContract.count(),
    inboundOrders: await prisma.inboundOrder.count(),
    inbounds: await prisma.inbound.count(),
    assets: await prisma.asset.count(),
    outboundOrders: await prisma.outboundOrder.count(),
    outbounds: await prisma.outbound.count(),
    outboundParcels: await prisma.outboundParcel.count(),
    invoices: await prisma.invoice.count(),
  };

  console.log('Demo data ready.');
  console.log(JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    inboundOrder: operations.inboundOrder1.order_number,
    inbound: operations.inbound1.inbound_number,
    outboundOrder: operations.outboundOrder.order_number,
    outbound: operations.outbound1.outbound_number,
    demoDate: DEMO_DATE.toISOString(),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
