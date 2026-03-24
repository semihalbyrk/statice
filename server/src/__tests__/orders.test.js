const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

/** Helper: login and return Bearer token string */
async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// We'll track IDs of orders we create so we can clean them up
const createdOrderIds = [];

afterAll(async () => {
  // Clean up test orders (cascade via Prisma)
  if (createdOrderIds.length > 0) {
    await prisma.orderWasteStream.deleteMany({
      where: { order_id: { in: createdOrderIds } },
    });
    await prisma.inboundOrder.deleteMany({
      where: { id: { in: createdOrderIds } },
    });
  }
  await prisma.$disconnect();
});

describe('GET /api/orders', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns paginated order list with valid token', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('accepts pagination query params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });

  it('accepts status filter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders?status=PLANNED')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Every returned order should have status PLANNED
    for (const order of res.body.data) {
      expect(order.status).toBe('PLANNED');
    }
  });
});

describe('POST /api/orders', () => {
  let adminToken;
  let gateToken;
  let wasteStreamId;

  beforeAll(async () => {
    adminToken = await getToken('admin@statice.nl', 'Admin1234!');
    gateToken = await getToken('gate@statice.nl', 'Gate1234!');

    // Get a waste stream ID from the DB (seeded WEEE)
    const ws = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
    wasteStreamId = ws.id;
  });

  it('returns 403 for GATE_OPERATOR role (not allowed to create)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({
        carrier_id: 'carrier-van-happen',
        supplier_id: 'supplier-techrecycle',
        waste_stream_ids: [wasteStreamId],
        planned_date: '2026-04-01',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ carrier_id: 'carrier-van-happen' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates an order successfully as ADMIN', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        carrier_id: 'carrier-van-happen',
        supplier_id: 'supplier-techrecycle',
        waste_stream_ids: [wasteStreamId],
        planned_date: '2026-04-15',
        expected_skip_count: 2,
        vehicle_plate: 'TEST-ZZ-99',
        notes: 'Integration test order',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('order_number');
    expect(res.body.status).toBe('PLANNED');
    expect(res.body.carrier).toHaveProperty('name');
    expect(res.body.supplier).toHaveProperty('name');

    createdOrderIds.push(res.body.id);
  });

  it('creates an order as LOGISTICS_PLANNER', async () => {
    const plannerToken = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        carrier_id: 'carrier-direct-dropoff',
        supplier_id: 'supplier-techrecycle',
        waste_stream_ids: [wasteStreamId],
        planned_date: '2026-04-16',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PLANNED');

    createdOrderIds.push(res.body.id);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/orders/nonexistent-id');

    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Order not found');
  });

  it('returns a created order by ID', async () => {
    if (createdOrderIds.length === 0) return; // skip if create tests didn't run

    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body).toHaveProperty('order_number');
    expect(res.body).toHaveProperty('carrier');
    expect(res.body).toHaveProperty('supplier');
    expect(res.body).toHaveProperty('inbounds');
  });
});

describe('PUT /api/orders/:id', () => {
  it('returns 403 for GATE_OPERATOR role', async () => {
    if (createdOrderIds.length === 0) return;

    const gateToken = await getToken('gate@statice.nl', 'Gate1234!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ notes: 'Should fail' });

    expect(res.status).toBe(403);
  });

  it('updates order notes as ADMIN', async () => {
    if (createdOrderIds.length === 0) return;

    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .put(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Updated by test' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated by test');
  });

  it('returns 404 for a non-existent order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/orders/:id (cancel)', () => {
  it('returns 403 for non-ADMIN roles', async () => {
    if (createdOrderIds.length === 0) return;

    const plannerToken = await getToken('planner@statice.nl', 'Planner123!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${plannerToken}`);

    expect(res.status).toBe(403);
  });

  it('cancels a PLANNED order as ADMIN', async () => {
    if (createdOrderIds.length === 0) return;

    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('returns 400 when trying to cancel an already cancelled order', async () => {
    if (createdOrderIds.length === 0) return;

    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const orderId = createdOrderIds[0];

    const res = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/orders/planning-board', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/orders/planning-board');

    expect(res.status).toBe(401);
  });

  it('returns planning board data for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('accepts a date filter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/orders/planning-board?date=2026-04-15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
