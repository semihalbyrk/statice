const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

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
// GET /api/sorting — list sessions (paginated)
// ---------------------------------------------------------------------------
describe('GET /api/sorting', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/sorting');
    expect(res.status).toBe(401);
  });

  it('returns paginated sessions list for authenticated user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/sorting')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('respects page and limit query params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/sorting?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it('filters by status query param', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/sorting?status=PLANNED')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const session of res.body.data) {
      expect(session.status).toBe('PLANNED');
    }
  });

  it('returns sessions for a specific order_id (non-paginated)', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Use a fake order_id — should return empty data array
    const res = await request(app)
      .get(`/api/sorting?order_id=${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('any authenticated role can list sessions', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');

    const res = await request(app)
      .get('/api/sorting')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sorting/:sessionId — get session detail
// ---------------------------------------------------------------------------
describe('GET /api/sorting/:sessionId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/sorting/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent session', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get(`/api/sorting/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Sorting session not found');
  });

  it('returns session detail for existing session', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // First get the list to find a real session
    const listRes = await request(app)
      .get('/api/sorting?limit=1')
      .set('Authorization', `Bearer ${token}`);

    if (listRes.body.data.length === 0) return; // skip if no sessions exist

    const sessionId = listRes.body.data[0].id;
    const res = await request(app)
      .get(`/api/sorting/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id', sessionId);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('inbound');
    expect(res.body.data).toHaveProperty('sorting_lines');
  });
});

// ---------------------------------------------------------------------------
// GET /api/sorting/:sessionId/lines — list lines
// ---------------------------------------------------------------------------
describe('GET /api/sorting/:sessionId/lines', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/sorting/${FAKE_UUID}/lines`);
    expect(res.status).toBe(401);
  });

  it('returns empty array for non-existent session', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get(`/api/sorting/${FAKE_UUID}/lines`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns lines for an existing session', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const listRes = await request(app)
      .get('/api/sorting?limit=1')
      .set('Authorization', `Bearer ${token}`);

    if (listRes.body.data.length === 0) return;

    const sessionId = listRes.body.data[0].id;
    const res = await request(app)
      .get(`/api/sorting/${sessionId}/lines`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sorting/categories/:categoryId/defaults — get category defaults
// ---------------------------------------------------------------------------
describe('GET /api/sorting/categories/:categoryId/defaults', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/sorting/categories/${FAKE_UUID}/defaults`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent category', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get(`/api/sorting/categories/${FAKE_UUID}/defaults`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Product category not found');
  });

  it('returns defaults for a real product category', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Look up a real category from the database
    const category = await prisma.productCategory.findFirst();
    if (!category) return; // skip if no categories seeded

    const res = await request(app)
      .get(`/api/sorting/categories/${category.id}/defaults`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id', category.id);
    expect(res.body.data).toHaveProperty('recycled_pct_default');
    expect(res.body.data).toHaveProperty('reused_pct_default');
    expect(res.body.data).toHaveProperty('disposed_pct_default');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/sorting/:sessionId/submit — submit session
// ---------------------------------------------------------------------------
describe('PATCH /api/sorting/:sessionId/submit', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch(`/api/sorting/${FAKE_UUID}/submit`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent session as SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Sorting session not found');
  });

  it('returns 404 for non-existent session as GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent session as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/submit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/sorting/:sessionId/reopen — reopen session (ADMIN only)
// ---------------------------------------------------------------------------
describe('PATCH /api/sorting/:sessionId/reopen', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch(`/api/sorting/${FAKE_UUID}/reopen`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE role', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/reopen`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/reopen`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/reopen`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/reopen`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent session as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/sorting/${FAKE_UUID}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Correction needed' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Sorting session not found');
  });
});
