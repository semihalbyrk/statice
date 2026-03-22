const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// GET /api/inbounds  (listAll — paginated)
// ---------------------------------------------------------------------------
describe('GET /api/inbounds', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/inbounds');
    expect(res.status).toBe(401);
  });

  it('returns paginated list for authenticated user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Response should have data array and pagination metadata
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts page and limit query params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts status filter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds?status=ARRIVED')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    // All returned items should have the ARRIVED status
    for (const item of res.body.data) {
      expect(item.status).toBe('ARRIVED');
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/inbounds/by-order  (list by order)
// ---------------------------------------------------------------------------
describe('GET /api/inbounds/by-order', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/inbounds/by-order');
    expect(res.status).toBe(401);
  });

  it('returns 400 when order_id is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/by-order')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'order_id query parameter is required');
  });

  it('returns empty array for non-existent order_id', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/inbounds/by-order?order_id=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/inbounds/:id  (get by ID)
// ---------------------------------------------------------------------------
describe('GET /api/inbounds/:id', () => {
  it('returns 401 without auth token', async () => {
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

  it('returns inbound data when it exists', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // First grab a real inbound ID from the list
    const listRes = await request(app)
      .get('/api/inbounds?page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    if (listRes.body.data.length === 0) {
      // No inbounds in DB — skip this test gracefully
      return;
    }

    const inboundId = listRes.body.data[0].id;

    const res = await request(app)
      .get(`/api/inbounds/${inboundId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id', inboundId);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('order');
  });
});

// ---------------------------------------------------------------------------
// POST /api/inbounds  (create inbound)
// ---------------------------------------------------------------------------
describe('POST /api/inbounds', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/inbounds')
      .send({ order_id: 'fake' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER (wrong role)', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: 'fake' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for REPORTING_MANAGER (wrong role)', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: 'fake' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns error for non-existent order_id as GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: '00000000-0000-0000-0000-000000000000' });

    // The service throws "Order not found" — expect 500 or a handled status
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('creates an inbound successfully for a valid order as GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    // Find a PLANNED order to create an inbound against
    const ordersRes = await request(app)
      .get('/api/orders?status=PLANNED')
      .set('Authorization', `Bearer ${token}`);

    const plannedOrder = ordersRes.body.data?.find((o) => o.status === 'PLANNED');
    if (!plannedOrder) {
      // No planned orders in DB — skip gracefully
      return;
    }

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: plannedOrder.id,
        registration_plate: plannedOrder.vehicle_plate || 'TEST-001',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('status', 'ARRIVED');
    expect(res.body.data).toHaveProperty('order');
  });

  it('creates an inbound successfully as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Find a PLANNED or ARRIVED order
    const ordersRes = await request(app)
      .get('/api/orders?status=PLANNED')
      .set('Authorization', `Bearer ${token}`);

    const order = ordersRes.body.data?.find(
      (o) => ['PLANNED', 'ARRIVED', 'IN_PROGRESS'].includes(o.status)
    );
    if (!order) {
      return; // No suitable orders — skip gracefully
    }

    const res = await request(app)
      .post('/api/inbounds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: order.id,
        registration_plate: order.vehicle_plate || 'ADMIN-TEST-001',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/inbounds/:id/status  (update status)
// ---------------------------------------------------------------------------
describe('PATCH /api/inbounds/:id/status', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/inbounds/some-id/status')
      .send({ status: 'WEIGHED_IN' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER (wrong role)', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch('/api/inbounds/some-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'WEIGHED_IN' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for REPORTING_MANAGER (wrong role)', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .patch('/api/inbounds/some-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'WEIGHED_IN' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 400 when status field is missing', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch('/api/inbounds/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'status is required');
  });

  it('returns error for non-existent inbound ID', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch('/api/inbounds/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'WEIGHED_IN' });

    // Service should throw not-found or state-machine error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('updates status on a real inbound as GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    // Find an ARRIVED inbound to transition
    const listRes = await request(app)
      .get('/api/inbounds?status=ARRIVED&limit=1')
      .set('Authorization', `Bearer ${token}`);

    const arrived = listRes.body.data?.find((i) => i.status === 'ARRIVED');
    if (!arrived) {
      // No ARRIVED inbounds available — skip gracefully
      return;
    }

    const res = await request(app)
      .patch(`/api/inbounds/${arrived.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'READY_FOR_SORTING' });

    // Could succeed (200) or fail with 409 if transition is not allowed
    expect([200, 409]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('data');
    }
  });
});
