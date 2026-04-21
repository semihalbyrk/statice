const prisma = require('./prismaClient');

function cloneDefined(source, keys) {
  const data = {};
  for (const key of keys) {
    if (source[key] !== undefined) data[key] = source[key];
  }
  return data;
}

async function ensureEntityAlias(tx, aliasId, sourceId, overrides = {}) {
  const existing = await tx.entity.findUnique({ where: { id: aliasId } });
  if (existing) return existing;

  const source = await tx.entity.findUnique({ where: { id: sourceId } });
  if (!source) return null;

  const data = {
    ...cloneDefined(source, [
      'company_name',
      'street_and_number',
      'postal_code',
      'city',
      'country',
      'kvk_number',
      'btw_number',
      'iban',
      'vihb_number',
      'environmental_permit_number',
      'contact_name',
      'contact_email',
      'contact_phone',
      'status',
      'is_supplier',
      'is_transporter',
      'is_disposer',
      'is_receiver',
      'supplier_type',
      'is_also_site',
      'is_protected',
    ]),
    ...overrides,
  };

  return tx.entity.create({
    data: {
      id: aliasId,
      ...data,
    },
  });
}

async function ensureCarrierAlias(tx, aliasId, sourceId, migratedEntityId, overrides = {}) {
  const existing = await tx.carrier.findUnique({ where: { id: aliasId } });
  if (existing) return existing;

  const source = sourceId ? await tx.carrier.findUnique({ where: { id: sourceId } }) : null;
  const data = source
    ? cloneDefined(source, [
        'name',
        'kvk_number',
        'contact_name',
        'contact_email',
        'contact_phone',
        'licence_number',
        'is_active',
      ])
    : {};

  return tx.carrier.create({
    data: {
      id: aliasId,
      name: overrides.name || data.name || aliasId,
      kvk_number: overrides.kvk_number !== undefined ? overrides.kvk_number : (data.kvk_number || null),
      contact_name: overrides.contact_name !== undefined ? overrides.contact_name : (data.contact_name || null),
      contact_email: overrides.contact_email !== undefined ? overrides.contact_email : (data.contact_email || null),
      contact_phone: overrides.contact_phone !== undefined ? overrides.contact_phone : (data.contact_phone || null),
      licence_number: overrides.licence_number !== undefined ? overrides.licence_number : (data.licence_number || null),
      is_active: overrides.is_active !== undefined ? overrides.is_active : (data.is_active ?? true),
      migrated_to_entity_id: migratedEntityId || null,
    },
  });
}

async function ensureSupplierAlias(tx, aliasId, sourceId, migratedEntityId, overrides = {}) {
  const existing = await tx.supplier.findUnique({ where: { id: aliasId } });
  if (existing) return existing;

  const source = sourceId ? await tx.supplier.findUnique({ where: { id: sourceId } }) : null;
  const data = source
    ? cloneDefined(source, [
        'name',
        'supplier_type',
        'kvk_number',
        'btw_number',
        'iban',
        'contact_name',
        'contact_email',
        'contact_phone',
        'address',
        'vihb_number',
        'pro_registration_number',
        'is_active',
      ])
    : {};

  return tx.supplier.create({
    data: {
      id: aliasId,
      name: overrides.name || data.name || aliasId,
      supplier_type: overrides.supplier_type || data.supplier_type || 'COMMERCIAL',
      kvk_number: overrides.kvk_number !== undefined ? overrides.kvk_number : (data.kvk_number || null),
      btw_number: overrides.btw_number !== undefined ? overrides.btw_number : (data.btw_number || null),
      iban: overrides.iban !== undefined ? overrides.iban : (data.iban || null),
      contact_name: overrides.contact_name !== undefined ? overrides.contact_name : (data.contact_name || null),
      contact_email: overrides.contact_email !== undefined ? overrides.contact_email : (data.contact_email || null),
      contact_phone: overrides.contact_phone !== undefined ? overrides.contact_phone : (data.contact_phone || null),
      address: overrides.address !== undefined ? overrides.address : (data.address || null),
      vihb_number: overrides.vihb_number !== undefined ? overrides.vihb_number : (data.vihb_number || null),
      pro_registration_number: overrides.pro_registration_number !== undefined
        ? overrides.pro_registration_number
        : (data.pro_registration_number || null),
      is_active: overrides.is_active !== undefined ? overrides.is_active : (data.is_active ?? true),
      migrated_to_entity_id: migratedEntityId || null,
    },
  });
}

async function ensureOutgoingContractAlias(tx) {
  const source = await tx.supplierContract.findFirst({
    where: { contract_type: 'OUTGOING', status: 'ACTIVE' },
    include: {
      contract_waste_streams: {
        include: {
          rate_lines: {
            where: { superseded_at: null },
            orderBy: { valid_from: 'asc' },
          },
        },
      },
    },
  });

  if (!source) return null;

  let sourceWasteStreams = source.contract_waste_streams;
  if (!sourceWasteStreams || sourceWasteStreams.length === 0) {
    const fallbackWasteStream = await tx.wasteStream.findFirst({
      where: { is_active: true },
      select: { id: true },
    });
    const fallbackMaterial = await tx.materialMaster.findFirst({
      where: { is_active: true },
      select: { id: true },
    });

    sourceWasteStreams = fallbackWasteStream
      ? [{
          id: 'compat-source-cws-1',
          waste_stream_id: fallbackWasteStream.id,
          afvalstroomnummer: 'ASN-DEMO-OUT-001',
          receiver_id: 'entity-renewi',
          rate_lines: fallbackMaterial
            ? [{
                id: 'compat-source-rate-1',
                material_id: fallbackMaterial.id,
                pricing_model: 'WEIGHT',
                unit_rate: 0.035,
                btw_rate: 21,
                processing_method: 'R4: Outbound recovery shipment',
                valid_from: source.effective_date,
                valid_to: source.expiry_date,
                superseded_at: null,
              }]
            : [],
        }]
      : [];
  }

  const existing = await tx.supplierContract.findFirst({
    where: { contract_number: 'O-Contract #1' },
  });

  const contract = existing
    ? await tx.supplierContract.update({
        where: { id: existing.id },
        data: {
          contract_type: 'OUTGOING',
          name: source.name,
          effective_date: source.effective_date,
          expiry_date: source.expiry_date,
          status: source.status,
          receiver_name: source.receiver_name,
          payment_term_days: source.payment_term_days,
          invoicing_frequency: source.invoicing_frequency,
          currency: source.currency,
          invoice_delivery_method: source.invoice_delivery_method,
          contamination_tolerance_pct: source.contamination_tolerance_pct,
          is_active: source.is_active,
          buyer_id: 'entity-renewi',
          sender_id: source.sender_id,
          disposer_id: source.disposer_id,
          disposer_site_id: source.disposer_site_id,
          agreement_transporter_id: 'entity-van-happen',
          invoice_entity_id: 'entity-renewi',
          shipment_type: source.shipment_type,
        },
      })
    : await tx.supplierContract.create({
        data: {
          id: 'compat-contract-out-001',
          contract_number: 'O-Contract #1',
          contract_type: 'OUTGOING',
          name: source.name,
          effective_date: source.effective_date,
          expiry_date: source.expiry_date,
          status: source.status,
          receiver_name: source.receiver_name,
          payment_term_days: source.payment_term_days,
          invoicing_frequency: source.invoicing_frequency,
          currency: source.currency,
          invoice_delivery_method: source.invoice_delivery_method,
          contamination_tolerance_pct: source.contamination_tolerance_pct,
          is_active: source.is_active,
          buyer_id: 'entity-renewi',
          sender_id: source.sender_id,
          disposer_id: source.disposer_id,
          disposer_site_id: source.disposer_site_id,
          agreement_transporter_id: 'entity-van-happen',
          invoice_entity_id: 'entity-renewi',
          shipment_type: source.shipment_type,
        },
      });

  for (const [index, cws] of sourceWasteStreams.entries()) {
    const compatCwsId = `compat-contract-out-cws-${index + 1}`;
    // Use compound unique key to avoid conflict when seed already created ContractWasteStream
    const existingCws = await tx.contractWasteStream.findFirst({
      where: { contract_id: contract.id, waste_stream_id: cws.waste_stream_id },
    });
    const resolvedCwsId = existingCws ? existingCws.id : compatCwsId;
    await tx.contractWasteStream.upsert({
      where: { id: resolvedCwsId },
      update: {
        afvalstroomnummer: cws.afvalstroomnummer,
        receiver_id: 'entity-renewi',
      },
      create: {
        id: compatCwsId,
        contract_id: contract.id,
        waste_stream_id: cws.waste_stream_id,
        afvalstroomnummer: cws.afvalstroomnummer,
        receiver_id: 'entity-renewi',
      },
    });

    for (const [rateIndex, rateLine] of cws.rate_lines.entries()) {
      const compatRateId = `compat-contract-out-rate-${index + 1}-${rateIndex + 1}`;
      await tx.contractRateLine.upsert({
        where: { id: compatRateId },
        update: {
          contract_id: contract.id,
          contract_waste_stream_id: resolvedCwsId,
          material_id: rateLine.material_id,
          pricing_model: rateLine.pricing_model,
          unit_rate: rateLine.unit_rate,
          btw_rate: rateLine.btw_rate,
          processing_method: rateLine.processing_method,
          valid_from: rateLine.valid_from,
          valid_to: rateLine.valid_to,
          superseded_at: rateLine.superseded_at,
        },
        create: {
          id: compatRateId,
          contract_id: contract.id,
          contract_waste_stream_id: resolvedCwsId,
          material_id: rateLine.material_id,
          pricing_model: rateLine.pricing_model,
          unit_rate: rateLine.unit_rate,
          btw_rate: rateLine.btw_rate,
          processing_method: rateLine.processing_method,
          valid_from: rateLine.valid_from,
          valid_to: rateLine.valid_to,
          superseded_at: rateLine.superseded_at,
        },
      });
    }
  }

  return contract;
}

async function ensureCompatibilityFixtures() {
  return prisma.$transaction(async (tx) => {
    await ensureEntityAlias(tx, 'entity-stichting-open', 'demo-entity-stichting-open');
    await ensureEntityAlias(tx, 'entity-techrecycle', 'demo-entity-techrecycle');
    await ensureEntityAlias(tx, 'entity-van-happen', 'demo-entity-van-happen');
    await ensureEntityAlias(tx, 'entity-renewi', 'demo-entity-renewi');
    await ensureEntityAlias(tx, 'entity-direct-dropoff', 'demo-entity-van-happen', {
      company_name: 'Direct Drop-off',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      kvk_number: null,
      vihb_number: null,
      is_transporter: true,
      is_receiver: false,
      is_supplier: false,
    });

    await ensureSupplierAlias(tx, 'supplier-stichting-open', 'demo-supplier-open', 'entity-stichting-open');
    await ensureSupplierAlias(tx, 'supplier-techrecycle', 'demo-supplier-tech', 'entity-techrecycle');

    await ensureCarrierAlias(tx, 'carrier-van-happen', 'demo-carrier-van-happen', 'entity-van-happen');
    await ensureCarrierAlias(tx, 'carrier-direct-dropoff', null, 'entity-direct-dropoff', {
      name: 'Direct Drop-off',
      is_active: true,
    });

    await ensureOutgoingContractAlias(tx);
  });
}

module.exports = { ensureCompatibilityFixtures };
