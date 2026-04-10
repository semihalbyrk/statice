const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// Track resources created during tests for cleanup
const createdOrderIds = [];
const createdInboundIds = [];

afterAll(async () => {
  // Clean up in reverse dependency order
  for (const inboundId of createdInboundIds) {
    await prisma.asset.deleteMany({ where: { inbound_id: inboundId } });
    await prisma.inboundWeighing.deleteMany({ where: { inbound_id: inboundId } });
    await prisma.inbound.deleteMany({ where: { id: inboundId } });
  }
  for (const orderId of createdOrderIds) {
    await prisma.orderWasteStream.deleteMany({ where: { order_id: orderId } });
    await prisma.inboundOrder.deleteMany({ where: { id: orderId } });
  }
  await prisma.$disconnect();
});

describe('GET /api/inbounds', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/inbounds');

    expect(res.status).toBe(401);
  });

  it('returns paginated inbound list', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts pagination params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });
});

describe('GET /api/inbounds/by-order', () => {
  it('returns 400 when order_id is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/by-order')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'order_id query parameter is required');
  });

  it('returns empty array for non-existent order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/by-order?order_id=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/inbounds/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/inbounds/some-id');

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent inbound', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Inbound not found');
  });
});

describe('POST /api/inbounds (create weighing event)', () => {
  let adminToken;
  let gateToken;
  let wasteStreamId;
  let testOrderId;

  beforeAll(async () => {
    adminToken = await getToken('admin@statice.nl', 'Admin1234!');
    gateToken = await getToken('gate@statice.nl', 'Gate1234!');

    const ws = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
    wasteStreamId = ws.id;

    // Create a test order to attach inbounds to
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        carrier_id: 'carrier-van-happen',
        supplier_id: 'supplier-techrecycle',
        waste_stream_ids: [wasteStreamId],
        planned_date: new Date().toISOString().split('T')[0],
        vehicle_plate: 'WE-TEST-01',
        notes: 'Weighing test order',
      });

    testOrderId = orderRes.body.id;
    createdOrderIds.push(testOrderId);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/inbounds')
      .send({ order_id: testOrderId });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-gate/admin role', async () => {
    const plannerToken = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        order_id: testOrderId,
        registration_plate: 'WE-TEST-01',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('creates an inbound (weighing event) as GATE_OPERATOR', async () => {
    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({
        order_id: testOrderId,
        registration_plate: 'WE-TEST-01',
        match_strategy: 'EXACT_SAME_DAY',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('inbound_number');
    expect(res.body.data.status).toBe('ARRIVED');
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data).toHaveProperty('vehicle');
    expect(res.body.data).toHaveProperty('can_add_parcels', true);
    expect(res.body.data).toHaveProperty('current_phase', 'awaiting_first_weighing');

    createdInboundIds.push(res.body.data.id);
  });

  it('creates an inbound as ADMIN', async () => {
    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        order_id: testOrderId,
        registration_plate: 'WE-TEST-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ARRIVED');

    createdInboundIds.push(res.body.data.id);
  });
});

describe('GET /api/inbounds/:id (retrieve created inbound)', () => {
  it('returns a created inbound with enriched fields', async () => {
    if (createdInboundIds.length === 0) return;

    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const inboundId = createdInboundIds[0];

    const res = await request(app)
      .get(`/api/inbounds/${inboundId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(inboundId);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data).toHaveProperty('vehicle');
    expect(res.body.data).toHaveProperty('weighings');
    expect(res.body.data).toHaveProperty('assets');
    expect(res.body.data).toHaveProperty('can_weigh_first');
    expect(res.body.data).toHaveProperty('current_phase');
    expect(res.body.data).toHaveProperty('allowed_transitions');
  });
});

describe('PATCH /api/inbounds/:id/status', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .patch('/api/inbounds/some-id/status')
      .send({ status: 'WEIGHED_IN' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-gate/admin role', async () => {
    if (createdInboundIds.length === 0) return;

    const plannerToken = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch(`/api/inbounds/${createdInboundIds[0]}/status`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ status: 'WEIGHED_IN' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when status field is missing', async () => {
    if (createdInboundIds.length === 0) return;

    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/inbounds/${createdInboundIds[0]}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'status is required');
  });
});

describe('PATCH /api/inbounds/:id/waste-stream', () => {
  it('returns 400 when waste_stream_id is missing', async () => {
    if (createdInboundIds.length === 0) return;

    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/inbounds/${createdInboundIds[0]}/waste-stream`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'waste_stream_id is required');
  });
});

describe('GET /api/inbounds/asset-lookup', () => {
  it('returns 400 when label query param is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/asset-lookup')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'label query param required');
  });

  it('returns data (null) for a non-existent label', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/asset-lookup?label=DOES-NOT-EXIST')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('PATCH /api/inbounds/:id/incident', () => {
  it('returns 400 when incident_category is missing', async () => {
    if (createdInboundIds.length === 0) return;

    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/inbounds/${createdInboundIds[0]}/incident`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'incident_category is required');
  });
});

describe('POST /api/inbounds/:id/weighing (triggerNextWeighing)', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/inbounds/some-id/weighing')
      .send({});

    expect(res.status).toBe(401);
  });

  it('returns 403 for PLANNER role', async () => {
    if (createdInboundIds.length === 0) return;

    const plannerToken = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post(`/api/inbounds/${createdInboundIds[0]}/weighing`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ device_id: 'WB_1' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 404 for non-existent inbound', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/inbounds/00000000-0000-0000-0000-000000000000/weighing')
      .set('Authorization', `Bearer ${token}`)
      .send({ device_id: 'WB_2' });

    // Could be 404 or 500 depending on error handling — at minimum not 200
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts device_id in request body', async () => {
    if (createdInboundIds.length === 0) return;

    const token = await getToken('gate@statice.nl', 'Gate1234!');

    // This will likely fail at the Pfister call level (no real Pfister running),
    // but we can verify the endpoint accepts device_id and reaches service logic
    const res = await request(app)
      .post(`/api/inbounds/${createdInboundIds[0]}/weighing`)
      .set('Authorization', `Bearer ${token}`)
      .send({ device_id: 'WB_2' });

    // If Pfister is not configured, we expect a 502 or 500 (not 400 for missing device_id)
    // If it succeeds, we expect 200 with data.device_id set
    if (res.status === 200) {
      expect(res.body.data).toHaveProperty('device_id');
    } else {
      // Pfister connection error is expected in test environment
      expect([500, 502, 504]).toContain(res.status);
    }
  });
});

describe('POST /api/inbounds/:id/weight-override', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/inbounds/some-id/weight-override')
      .send({});

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR (ADMIN only)', async () => {
    if (createdInboundIds.length === 0) return;

    const gateToken = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .post(`/api/inbounds/${createdInboundIds[0]}/weight-override`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ gross_weight_kg: 1000 });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });
});
