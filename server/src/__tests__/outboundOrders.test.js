const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// Track IDs for cleanup
const createdOutboundOrderIds = [];
const createdContractIds = [];

// Shared test data
let adminToken;
let gateToken;
let outgoingContract;
let buyerEntity;
let transporterEntity;
let staticeEntity;
let weeeStream;
let materialId;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');

  // Get seeded entities
  staticeEntity = await prisma.entity.findFirst({ where: { is_protected: true } });
  buyerEntity = await prisma.entity.findFirst({
    where: { id: 'entity-renewi' },
  });
  transporterEntity = await prisma.entity.findFirst({
    where: { id: 'entity-renewi' },
  });
  weeeStream = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
  const mat = await prisma.materialMaster.findFirst({ where: { is_active: true } });
  materialId = mat?.id;

  // Get seeded OUTGOING contract (specifically CTR-00006)
  outgoingContract = await prisma.supplierContract.findFirst({
    where: { contract_number: 'O-Contract #1' },
    include: {
      contract_waste_streams: {
        include: { waste_stream: true, rate_lines: true },
      },
    },
  });
});

afterAll(async () => {
  // Cleanup in reverse dependency order
  if (createdOutboundOrderIds.length > 0) {
    // Delete outbound documents, weighing records, outbounds first
    const outbounds = await prisma.outbound.findMany({
      where: { outbound_order_id: { in: createdOutboundOrderIds } },
      select: { id: true },
    });
    const outboundIds = outbounds.map((o) => o.id);
    if (outboundIds.length > 0) {
      await prisma.outboundDocument.deleteMany({ where: { outbound_id: { in: outboundIds } } });
      await prisma.outboundWeighingRecord.deleteMany({ where: { outbound_id: { in: outboundIds } } });
      await prisma.outbound.deleteMany({ where: { id: { in: outboundIds } } });
    }
    await prisma.outboundOrderWasteStream.deleteMany({
      where: { outbound_order_id: { in: createdOutboundOrderIds } },
    });
    await prisma.outboundOrder.deleteMany({
      where: { id: { in: createdOutboundOrderIds } },
    });
  }
  if (createdContractIds.length > 0) {
    for (const cid of createdContractIds) {
      await prisma.contractRateLine.deleteMany({ where: { contract_id: cid } });
      await prisma.contractWasteStream.deleteMany({ where: { contract_id: cid } });
      await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: cid } });
      await prisma.supplierContract.delete({ where: { id: cid } }).catch(() => {});
    }
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// OUTBOUND ORDER CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/outbound-orders', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/outbound-orders').send({});
    expect(res.status).toBe(401);
  });

  it('creates an outbound order from OUTGOING contract', async () => {
    const cws = outgoingContract.contract_waste_streams[0];

    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: outgoingContract.id,
        planned_date: '2026-04-20',
        waste_streams: [
          {
            waste_stream_id: cws.waste_stream_id,
            receiver_id: buyerEntity.id,
            asn: cws.afvalstroomnummer,
            planned_amount_kg: 20000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.order_number).toMatch(/^OBO-/);
    expect(res.body.status).toBe('PLANNED');
    expect(res.body.buyer?.company_name).toBeTruthy();
    expect(res.body.sender?.company_name).toBeTruthy();
    expect(res.body.transporter?.company_name).toBeTruthy();
    expect(res.body.waste_streams[0].receiver?.company_name).toBeTruthy();
    expect(res.body.waste_streams[0].asn).toBe(cws.afvalstroomnummer);

    createdOutboundOrderIds.push(res.body.id);
  });

  it('auto-fills buyer/sender/disposer/transporter from contract', async () => {
    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: outgoingContract.id,
        planned_date: '2026-04-21',
      });

    expect(res.status).toBe(201);
    expect(res.body.buyer_id).toBe(outgoingContract.buyer_id);
    expect(res.body.sender_id).toBe(outgoingContract.sender_id);
    expect(res.body.disposer_id).toBe(outgoingContract.disposer_id);
    expect(res.body.transporter_id).toBe(outgoingContract.agreement_transporter_id);
    expect(res.body.shipment_type).toBe(outgoingContract.shipment_type);

    createdOutboundOrderIds.push(res.body.id);
  });

  it('respects expected_outbounds default of 1', async () => {
    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: outgoingContract.id,
        planned_date: '2026-04-22',
      });

    expect(res.status).toBe(201);
    expect(res.body.expected_outbounds).toBe(1);

    createdOutboundOrderIds.push(res.body.id);
  });

  it('accepts frontend field aliases and derives waste stream fields from contract', async () => {
    const cws = outgoingContract.contract_waste_streams[0];
    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: outgoingContract.id,
        planned_date: '2026-04-23',
        time_window_start: '2026-04-23T08:00:00.000Z',
        time_window_end: '2026-04-23T10:00:00.000Z',
        expected_outbound_count: 3,
        waste_streams: [
          {
            contract_waste_stream_id: cws.id,
            planned_amount_kg: 1500,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.expected_outbounds).toBe(3);
    expect(res.body.planned_time_start).toBeTruthy();
    expect(res.body.planned_time_end).toBeTruthy();
    expect(res.body.waste_streams[0].receiver?.company_name).toBeTruthy();
    expect(res.body.waste_streams[0].asn).toBe(cws.afvalstroomnummer);
    expect(res.body.waste_streams[0].material?.id).toBeTruthy();
    expect(res.body.waste_streams[0].processing_method).toBeTruthy();

    createdOutboundOrderIds.push(res.body.id);
  });

  it('returns 400 without contract_id', async () => {
    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planned_date: '2026-04-20' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 without planned_date', async () => {
    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contract_id: outgoingContract.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 for INCOMING contract', async () => {
    const incomingContract = await prisma.supplierContract.findFirst({
      where: { contract_type: 'INCOMING', status: 'ACTIVE' },
    });

    const res = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: incomingContract.id,
        planned_date: '2026-04-20',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('OUTGOING');
  });
});

describe('GET /api/outbound-orders', () => {
  it('returns paginated list', async () => {
    const res = await request(app)
      .get('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/outbound-orders?status=PLANNED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const order of res.body.data) {
      expect(order.status).toBe('PLANNED');
    }
  });

  it('searches by order number', async () => {
    const res = await request(app)
      .get('/api/outbound-orders?search=OBO-')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const order of res.body.data) {
      expect(order.order_number).toContain('OBO-');
    }
  });
});

describe('GET /api/outbound-orders/:id', () => {
  it('returns full detail with relations', async () => {
    const orderId = createdOutboundOrderIds[0];
    const res = await request(app)
      .get(`/api/outbound-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body).toHaveProperty('contract');
    expect(res.body).toHaveProperty('buyer');
    expect(res.body).toHaveProperty('sender');
    expect(res.body).toHaveProperty('transporter');
    expect(res.body).toHaveProperty('waste_streams');
    expect(res.body).toHaveProperty('outbounds');
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/api/outbound-orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/outbound-orders/:id', () => {
  it('updates a PLANNED order', async () => {
    const orderId = createdOutboundOrderIds[0];
    const res = await request(app)
      .put(`/api/outbound-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Updated notes for testing' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated notes for testing');
  });
});

describe('DELETE /api/outbound-orders/:id (cancel)', () => {
  it('cancels a PLANNED order', async () => {
    // Create a fresh order to cancel
    const createRes = await request(app)
      .post('/api/outbound-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_id: outgoingContract.id,
        planned_date: '2026-04-28',
      });

    expect(createRes.status).toBe(201);
    createdOutboundOrderIds.push(createRes.body.id);

    const res = await request(app)
      .delete(`/api/outbound-orders/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});
