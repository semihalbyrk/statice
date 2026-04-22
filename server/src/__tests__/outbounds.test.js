const request = require('supertest');
const fs = require('fs');
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

let adminToken;
let outgoingContract;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');

  outgoingContract = await prisma.supplierContract.findFirst({
    where: { contract_number: 'O-Contract #1' },
    include: { contract_waste_streams: true },
  });
});

afterAll(async () => {
  for (const orderId of createdOutboundOrderIds) {
    const outbounds = await prisma.outbound.findMany({
      where: { outbound_order_id: orderId },
      select: { id: true },
    });
    const ids = outbounds.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.outboundDocument.deleteMany({ where: { outbound_id: { in: ids } } });
      await prisma.outboundWeighingRecord.deleteMany({ where: { outbound_id: { in: ids } } });
      await prisma.outbound.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.outboundOrderWasteStream.deleteMany({ where: { outbound_order_id: orderId } });
  }
  await prisma.outboundOrder.deleteMany({
    where: { id: { in: createdOutboundOrderIds } },
  });
  await prisma.$disconnect();
});

/** Helper: create a fresh outbound order for testing */
async function createTestOrder(overrides = {}) {
  const cws = outgoingContract.contract_waste_streams[0];
  const res = await request(app)
    .post('/api/outbound-orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      contract_id: outgoingContract.id,
      planned_date: '2026-05-01',
      expected_outbounds: overrides.expected_outbounds || 1,
      waste_streams: cws ? [{
        waste_stream_id: cws.waste_stream_id,
        receiver_id: outgoingContract.buyer_id,
        asn: cws.afvalstroomnummer,
      }] : [],
      ...overrides,
    });
  if (res.status === 201) {
    createdOutboundOrderIds.push(res.body.id);
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTBOUND CREATION
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/outbounds/order/:orderId', () => {
  it('creates an outbound for a PLANNED order', async () => {
    const orderRes = await createTestOrder();
    expect(orderRes.status).toBe(201);

    const res = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_plate: 'NL-TEST-01' });

    expect(res.status).toBe(201);
    expect(res.body.data.outbound_number).toMatch(/^OUT-/);
    expect(res.body.data.status).toBe('CREATED');
    expect(res.body.data.vehicle_plate).toBe('NL-TEST-01');
  });

  it('auto-transitions order from PLANNED to IN_PROGRESS', async () => {
    const orderRes = await createTestOrder();
    const orderId = orderRes.body.id;

    await request(app)
      .post(`/api/outbounds/order/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Verify order status changed
    const orderCheck = await request(app)
      .get(`/api/outbound-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(orderCheck.body.status).toBe('IN_PROGRESS');
  });

  it('rejects when outbound count exceeds expected', async () => {
    const orderRes = await createTestOrder({ expected_outbounds: 1 });
    const orderId = orderRes.body.id;

    // First outbound - should succeed
    const first = await request(app)
      .post(`/api/outbounds/order/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(first.status).toBe(201);

    // Second outbound - should fail
    const second = await request(app)
      .post(`/api/outbounds/order/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(second.status).toBe(400);
    expect(second.body.error).toContain('1/1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHING FLOW
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/outbounds/:id/weighings', () => {
  let outboundId;

  beforeAll(async () => {
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_plate: 'NL-WEIGH-01' });
    outboundId = outRes.body.data.id;
  });

  it('records tare weighing (manual) — transitions CREATED → LOADING', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        weighingType: 'TARE',
        source: 'MANUAL',
        weightKg: 15000,
        notes: 'Empty truck tare',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOADING');
    expect(res.body.data.tare_weight_kg).toBeNull(); // not set yet until both complete
  });

  it('records gross weighing — transitions LOADING → WEIGHED with net computed', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        weighingType: 'GROSS',
        source: 'MANUAL',
        weightKg: 20000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('WEIGHED');
    expect(Number(res.body.data.gross_weight_kg)).toBe(20000);
    expect(Number(res.body.data.tare_weight_kg)).toBe(15000);
    expect(Number(res.body.data.net_weight_kg)).toBe(5000);
  });

  it('rejects weighing after both recorded (status = WEIGHED)', async () => {
    // Outbound is now WEIGHED after both tare and gross — no more weighings allowed
    const res = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 15000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('WEIGHED');
  });

  it('rejects weighing for non-CREATED/LOADING outbound', async () => {
    // outbound is now in WEIGHED status
    const res = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 25000 });

    expect(res.status).toBe(400);
  });
});

describe('Weighing — gross first then tare (reverse order)', () => {
  it('computes net correctly regardless of weighing order', async () => {
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    const outboundId = outRes.body.data.id;

    // Gross first
    const grossRes = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 22000 });

    expect(grossRes.status).toBe(200);
    expect(grossRes.body.data.status).toBe('LOADING');

    // Tare second
    const tareRes = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 16000 });

    expect(tareRes.status).toBe(200);
    expect(tareRes.body.data.status).toBe('WEIGHED');
    expect(Number(tareRes.body.data.net_weight_kg)).toBe(6000);
  });
});

describe('Weighing — manual source validation', () => {
  it('rejects MANUAL without weightKg', async () => {
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .post(`/api/outbounds/${outRes.body.data.id}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('weightKg');
  });

  it('rejects invalid weighingType', async () => {
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .post(`/api/outbounds/${outRes.body.data.id}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'NET', source: 'MANUAL', weightKg: 5000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('GROSS or TARE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BGL GENERATION
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/outbounds/:id/generate-bgl', () => {
  let weighedOutboundId;

  beforeAll(async () => {
    // Create order → outbound → complete weighing
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_plate: 'NL-BGL-01' });
    weighedOutboundId = outRes.body.data.id;

    // Tare + Gross
    await request(app)
      .post(`/api/outbounds/${weighedOutboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 14000 });
    await request(app)
      .post(`/api/outbounds/${weighedOutboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 19000 });
  });

  it('generates BGL for WEIGHED outbound → transitions to DOCUMENTS_READY', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${weighedOutboundId}/generate-bgl`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DOCUMENTS_READY');
    expect(res.body.data.documents_ready_at).toBeTruthy();
    expect(res.body.data.documents).toBeDefined();
    expect(res.body.data.documents.length).toBeGreaterThan(0);

    const doc = res.body.data.documents[0];
    expect(doc.document_type).toBe('BEGELEIDINGSBRIEF');
    expect(doc.status).toBe('GENERATED');

    // Verify the PDF file exists on disk
    expect(fs.existsSync(doc.storage_path)).toBe(true);
    // Verify it is a real PDF (starts with %PDF magic bytes)
    const header = Buffer.alloc(4);
    const fd = fs.openSync(doc.storage_path, 'r');
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);
    expect(header.toString()).toBe('%PDF');
  });

  it('rejects BGL generation for non-WEIGHED outbound', async () => {
    // Create a fresh CREATED outbound
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .post(`/api/outbounds/${outRes.body.data.id}/generate-bgl`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('WEIGHED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTURE & DELIVERY
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/outbounds/:id/depart', () => {
  it('rejects departure without BGL (WEIGHED status)', async () => {
    // Create weighed outbound (no BGL)
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    const obId = outRes.body.data.id;

    await request(app)
      .post(`/api/outbounds/${obId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 15000 });
    await request(app)
      .post(`/api/outbounds/${obId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 20000 });

    // Try departure without BGL
    const res = await request(app)
      .patch(`/api/outbounds/${obId}/depart`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });
});

describe('Full outbound lifecycle — end to end', () => {
  it('completes the full CREATED → DELIVERED flow', async () => {
    // 1. Create outbound order
    const orderRes = await createTestOrder({ expected_outbounds: 1 });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.id;

    // 2. Create outbound
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_plate: 'NL-E2E-01' });
    expect(outRes.status).toBe(201);
    const outboundId = outRes.body.data.id;
    expect(outRes.body.data.status).toBe('CREATED');

    // 3. Record tare → LOADING
    const tareRes = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 15960 });
    expect(tareRes.body.data.status).toBe('LOADING');

    // 4. Record gross → WEIGHED
    const grossRes = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 18020 });
    expect(grossRes.body.data.status).toBe('WEIGHED');
    expect(Number(grossRes.body.data.net_weight_kg)).toBe(2060);

    // 5. Generate BGL → DOCUMENTS_READY
    const bglRes = await request(app)
      .post(`/api/outbounds/${outboundId}/generate-bgl`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(bglRes.body.data.status).toBe('DOCUMENTS_READY');

    // 6. Confirm departure → DEPARTED
    const departRes = await request(app)
      .patch(`/api/outbounds/${outboundId}/depart`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(departRes.status).toBe(200);
    expect(departRes.body.data.status).toBe('DEPARTED');
    expect(departRes.body.data.departed_at).toBeTruthy();

    // 7. Confirm delivery → DELIVERED
    const deliverRes = await request(app)
      .patch(`/api/outbounds/${outboundId}/deliver`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.status).toBe('DELIVERED');
    expect(deliverRes.body.data.delivered_at).toBeTruthy();

    // 8. Verify parent order auto-completed
    const orderCheck = await request(app)
      .get(`/api/outbound-orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(orderCheck.body.status).toBe('COMPLETED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OUTBOUND LIST & DETAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/outbounds', () => {
  it('returns paginated outbound list', async () => {
    const res = await request(app)
      .get('/api/outbounds')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/outbounds?status=DELIVERED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const ob of res.body.data) {
      expect(ob.status).toBe('DELIVERED');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LINE COUNT GUARD — WEIGHED transition requires ≥1 line
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/outbounds/:id/weighings — line count guard', () => {
  let outboundId;
  const cleanup = { outbound_ids: [] };

  beforeAll(async () => {
    // Build a fresh outbound with ZERO lines, already in LOADING after a TARE.
    const orderRes = await createTestOrder();
    const outRes = await request(app)
      .post(`/api/outbounds/order/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_plate: 'NL-GUARD-01' });
    outboundId = outRes.body.data.id;
    cleanup.outbound_ids.push(outboundId);

    // Record TARE first — transitions CREATED → LOADING, no guard yet
    const tareRes = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 15000 });
    expect(tareRes.status).toBe(200);
    expect(tareRes.body.data.status).toBe('LOADING');
  });

  afterAll(async () => {
    if (cleanup.outbound_ids.length) {
      await prisma.outboundLine.deleteMany({
        where: { outbound_id: { in: cleanup.outbound_ids } },
      });
      await prisma.outboundWeighingRecord.deleteMany({
        where: { outbound_id: { in: cleanup.outbound_ids } },
      });
      await prisma.outbound.deleteMany({
        where: { id: { in: cleanup.outbound_ids } },
      });
    }
  });

  it('blocks the GROSS weighing when no lines exist', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outboundId}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 20000 });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toMatch(/at least one line/i);
  });
});
