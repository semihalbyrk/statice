const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

let adminToken;
let plannerToken;
let gateToken;
let sortingToken;
let reportingToken;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  plannerToken = await getToken('planner@statice.nl', 'Planner123!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
  sortingToken = await getToken('sorting@statice.nl', 'Sorting123!');
  reportingToken = await getToken('reporting@statice.nl', 'Report123!');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// --------------- Planning Board ---------------

describe('GET /api/orders/planning-board', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/orders/planning-board');
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE (not in allowed roles)', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${sortingToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${reportingToken}`);
    expect(res.status).toBe(403);
  });

  it('returns planning board for ADMIN', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // Response should be an object with orders or data array
    expect(res.body).toBeDefined();
    expect(typeof res.body).toBe('object');
  });

  it('returns planning board for LOGISTICS_PLANNER', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${plannerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('returns planning board for GATE_OPERATOR', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('accepts date query parameter', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board?date=2026-03-22')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('accepts filter query parameters', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board?status=PLANNED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('returns empty result for far-future date with no orders', async () => {
    const res = await request(app)
      .get('/api/orders/planning-board?date=2099-12-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// --------------- Set Incident ---------------

describe('POST /api/orders/:id/incident', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/orders/some-id/incident')
      .send({ incident_category: 'DAMAGE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE', async () => {
    const res = await request(app)
      .post('/api/orders/some-id/incident')
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ incident_category: 'DAMAGE' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for LOGISTICS_PLANNER', async () => {
    const res = await request(app)
      .post('/api/orders/some-id/incident')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ incident_category: 'DAMAGE' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when incident_category is missing', async () => {
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/incident')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ incident_notes: 'Some notes without category' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'incident_category is required');
  });

  it('returns error for non-existent order as ADMIN', async () => {
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/incident')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ incident_category: 'DAMAGE', incident_notes: 'Test incident' });
    // Service should throw 404 or 500 for non-existent order
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('allows GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/orders/00000000-0000-0000-0000-000000000000/incident')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ incident_category: 'DAMAGE', incident_notes: 'Gate operator incident' });
    // Should pass auth (not 403) — error will be about non-existent order
    expect(res.status).not.toBe(403);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
