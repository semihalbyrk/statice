const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

const createdContractIds = [];
let adminToken;
let staticeEntity;
let buyerEntity;
let transporterEntity;
let weeeStream;
let materialId;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');

  staticeEntity = await prisma.entity.findFirst({ where: { is_protected: true } });
  // Use a DIFFERENT buyer than the one used in outboundOrders tests (entity-renewi)
  // to avoid overlap conflicts on parallel runs.
  buyerEntity = await prisma.entity.findFirst({ where: { id: 'entity-stichting-open' } });
  transporterEntity = await prisma.entity.findFirst({ where: { id: 'entity-van-happen' } });
  weeeStream = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
  const mat = await prisma.materialMaster.findFirst({ where: { is_active: true } });
  materialId = mat?.id;

  // Clean up any leftover test OUTGOING contracts from previous runs (with this test's buyer)
  const stale = await prisma.supplierContract.findMany({
    where: {
      contract_type: 'OUTGOING',
      buyer_id: buyerEntity?.id,
    },
    select: { id: true },
  });
  for (const c of stale) {
    await prisma.contractRateLine.deleteMany({ where: { contract_id: c.id } });
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: c.id } });
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: c.id } });
    await prisma.supplierContract.delete({ where: { id: c.id } }).catch(() => {});
  }
});

afterAll(async () => {
  for (const cid of createdContractIds) {
    await prisma.contractRateLine.deleteMany({ where: { contract_id: cid } });
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: cid } });
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: cid } });
    await prisma.supplierContract.delete({ where: { id: cid } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// OUTGOING CONTRACT CREATION
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/contracts — OUTGOING type', () => {
  it('creates an OUTGOING contract with all required fields', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_type: 'OUTGOING',
        name: 'Test Outgoing Contract E2E',
        buyer_id: buyerEntity.id,
        agreement_transporter_id: transporterEntity.id,
        shipment_type: 'DOMESTIC_NL',
        effective_date: '2030-01-01',
        expiry_date: '2030-06-30',
        contract_waste_streams: [
          {
            waste_stream_id: weeeStream.id,
            afvalstroomnummer: 'AFS-TEST-OUT-001',
            receiver_id: buyerEntity.id,
            rate_lines: materialId ? [
              {
                material_id: materialId,
                pricing_model: 'WEIGHT',
                unit_rate: 0.05,
                btw_rate: 21,
              },
            ] : [],
          },
        ],
      });

    expect(res.status).toBe(201);
    const contract = res.body.data;
    expect(contract.contract_type).toBe('OUTGOING');
    expect(contract.buyer?.company_name).toBeTruthy();
    expect(contract.shipment_type).toBe('DOMESTIC_NL');
    // Sender and disposer should be auto-filled from Statice entity
    expect(contract.sender?.company_name).toContain('Statice');
    expect(contract.disposer?.company_name).toContain('Statice');
    // supplier_id should be null for OUTGOING
    expect(contract.supplier_id).toBeNull();

    createdContractIds.push(contract.id);
  });

  it('auto-fills sender and disposer from Statice entity', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_type: 'OUTGOING',
        name: 'Test Auto-fill Sender/Disposer',
        buyer_id: buyerEntity.id,
        agreement_transporter_id: transporterEntity.id,
        shipment_type: 'EU_CROSS_BORDER',
        effective_date: '2030-07-01',
        expiry_date: '2030-12-31',
        contract_waste_streams: [
          {
            waste_stream_id: weeeStream.id,
            afvalstroomnummer: 'AFS-TEST-OUT-002',
          },
        ],
      });

    expect(res.status).toBe(201);
    const contract = res.body.data;
    expect(contract.sender_id).toBe(staticeEntity.id);
    expect(contract.disposer_id).toBe(staticeEntity.id);

    createdContractIds.push(contract.id);
  });

  it('returns 400 without buyer_id for OUTGOING', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_type: 'OUTGOING',
        name: 'Missing Buyer Test',
        agreement_transporter_id: transporterEntity.id,
        shipment_type: 'DOMESTIC_NL',
        effective_date: '2027-01-01',
        contract_waste_streams: [
          { waste_stream_id: weeeStream.id, afvalstroomnummer: 'AFS-X' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Buyer');
  });

  it('returns 400 without shipment_type for OUTGOING', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_type: 'OUTGOING',
        name: 'Missing Shipment Test',
        buyer_id: buyerEntity.id,
        agreement_transporter_id: transporterEntity.id,
        effective_date: '2027-01-01',
        contract_waste_streams: [
          { waste_stream_id: weeeStream.id, afvalstroomnummer: 'AFS-X' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Shipment');
  });

  it('returns 400 without agreement_transporter for OUTGOING', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_type: 'OUTGOING',
        name: 'Missing Transporter Test',
        buyer_id: buyerEntity.id,
        shipment_type: 'DOMESTIC_NL',
        effective_date: '2027-01-01',
        contract_waste_streams: [
          { waste_stream_id: weeeStream.id, afvalstroomnummer: 'AFS-X' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('transporter');
  });

  it('includes receiver in waste stream response', async () => {
    // Get the first created OUTGOING contract
    const contractId = createdContractIds[0];
    expect(contractId).toBeTruthy();

    const res = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const contract = res.body.data;
    const cws = contract.contract_waste_streams;
    expect(cws).toBeDefined();
    expect(cws.length).toBeGreaterThan(0);
    // receiver should be populated for OUTGOING
    if (cws[0].receiver) {
      expect(cws[0].receiver.company_name).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Entity Protection (Statice)', () => {
  it('Statice entity exists with correct flags', async () => {
    expect(staticeEntity).toBeTruthy();
    expect(staticeEntity.is_protected).toBe(true);
    expect(staticeEntity.is_disposer).toBe(true);
    expect(staticeEntity.is_receiver).toBe(true);
    expect(staticeEntity.status).toBe('ACTIVE');
  });

  it('cannot deactivate protected entity', async () => {
    const res = await request(app)
      .patch(`/api/entities/${staticeEntity.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('protected');
  });

  it('can edit protected entity details', async () => {
    const res = await request(app)
      .put(`/api/entities/${staticeEntity.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: staticeEntity.company_name,
        street_and_number: staticeEntity.street_and_number,
        postal_code: staticeEntity.postal_code,
        city: staticeEntity.city,
        country: staticeEntity.country,
        is_disposer: true,
        is_receiver: true,
        environmental_permit_number: staticeEntity.environmental_permit_number,
        contact_phone: '+31 (0)77 306 0699',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.contact_phone || res.body.contact_phone).toBe('+31 (0)77 306 0699');

    // Restore original
    await prisma.entity.update({
      where: { id: staticeEntity.id },
      data: { contact_phone: staticeEntity.contact_phone },
    });
  });

  it('protected entity endpoint returns Statice entity', async () => {
    const res = await request(app)
      .get('/api/entities/protected')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_protected).toBe(true);
    expect(res.body.data.company_name).toContain('Statice');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// INBOUND ORDER — PLANNED AMOUNT
// ─────────────────────────────────────────────────────────────────────────────

describe('Inbound Order — Planned Amount', () => {
  it('returns planned_amount_kg in order waste streams', async () => {
    // Get an existing seeded order
    const order = await prisma.inboundOrder.findFirst({
      include: { waste_streams: true },
    });

    if (order) {
      const res = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // The field should exist in the response (may be null for seeded data)
      if (res.body.waste_streams?.length > 0) {
        expect(res.body.waste_streams[0]).toHaveProperty('planned_amount_kg');
      }
    }
  });
});
