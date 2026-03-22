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
let gateToken;
let plannerToken;
let sortingToken;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
  plannerToken = await getToken('planner@statice.nl', 'Planner123!');
  sortingToken = await getToken('sorting@statice.nl', 'Sorting123!');
});

afterAll(async () => {
  await prisma.$disconnect();
});

// --------------- List Session Records ---------------

describe('GET /api/processing/sessions/:sessionId/records', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/processing/sessions/some-session-id/records');
    expect(res.status).toBe(401);
  });

  it('returns empty array for non-existent session', async () => {
    const res = await request(app)
      .get('/api/processing/sessions/00000000-0000-0000-0000-000000000000/records')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns records for any authenticated user', async () => {
    // Find an existing session if any
    const session = await prisma.sortingSession.findFirst({
      select: { id: true },
    });

    if (session) {
      const res = await request(app)
        .get(`/api/processing/sessions/${session.id}/records`)
        .set('Authorization', `Bearer ${sortingToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });
});

// --------------- Record History ---------------

describe('GET /api/processing/records/:recordId/history', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/processing/records/some-id/history');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent record', async () => {
    const res = await request(app)
      .get('/api/processing/records/00000000-0000-0000-0000-000000000000/history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Processing record not found');
  });
});

// --------------- Create Outcome ---------------

describe('POST /api/processing/records/:recordId/outcomes', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processing/records/some-id/outcomes')
      .send({ weight_kg: 10, treatment_route: 'RECYCLED' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER (not in PROCESSING_ROLES)', async () => {
    const res = await request(app)
      .post('/api/processing/records/some-id/outcomes')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ weight_kg: 10, treatment_route: 'RECYCLED' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent record', async () => {
    const res = await request(app)
      .post('/api/processing/records/00000000-0000-0000-0000-000000000000/outcomes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weight_kg: 10, treatment_route: 'RECYCLED' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Processing record not found');
  });

  it('allows SORTING_EMPLOYEE role', async () => {
    // Should get past auth (403) but may get 404 for non-existent record
    const res = await request(app)
      .post('/api/processing/records/00000000-0000-0000-0000-000000000000/outcomes')
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ weight_kg: 10, treatment_route: 'RECYCLED' });
    // Either 404 or 409 — but NOT 403
    expect([404, 409]).toContain(res.status);
  });

  it('allows GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/processing/records/00000000-0000-0000-0000-000000000000/outcomes')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ weight_kg: 10, treatment_route: 'RECYCLED' });
    expect([404, 409]).toContain(res.status);
  });
});

// --------------- Update Outcome ---------------

describe('PUT /api/processing/outcomes/:outcomeId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/processing/outcomes/some-id')
      .send({ weight_kg: 15 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER', async () => {
    const res = await request(app)
      .put('/api/processing/outcomes/some-id')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ weight_kg: 15 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent outcome', async () => {
    const res = await request(app)
      .put('/api/processing/outcomes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weight_kg: 15 });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Processing outcome not found');
  });
});

// --------------- Delete Outcome ---------------

describe('DELETE /api/processing/outcomes/:outcomeId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/processing/outcomes/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER', async () => {
    const res = await request(app)
      .delete('/api/processing/outcomes/some-id')
      .set('Authorization', `Bearer ${plannerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent outcome', async () => {
    const res = await request(app)
      .delete('/api/processing/outcomes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Processing outcome not found');
  });
});

// --------------- Finalize Asset ---------------

describe('POST /api/processing/sessions/:sessionId/assets/:assetId/finalize', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/finalize');
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/finalize')
      .set('Authorization', `Bearer ${plannerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/00000000-0000-0000-0000-000000000000/assets/00000000-0000-0000-0000-000000000001/finalize')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// --------------- Confirm Asset ---------------

describe('POST /api/processing/sessions/:sessionId/assets/:assetId/confirm', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/confirm');
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE (only ADMIN/COMPLIANCE_OFFICER allowed)', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/confirm')
      .set('Authorization', `Bearer ${sortingToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/confirm')
      .set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent session as ADMIN', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/00000000-0000-0000-0000-000000000000/assets/00000000-0000-0000-0000-000000000001/confirm')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// --------------- Reopen Asset ---------------

describe('POST /api/processing/sessions/:sessionId/assets/:assetId/reopen', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/reopen')
      .send({ reason_code: 'CORRECTION' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/reopen')
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ reason_code: 'CORRECTION' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/s1/assets/a1/reopen')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ reason_code: 'CORRECTION' });
    expect(res.status).toBe(403);
  });

  it('returns 400/404 for non-existent session as ADMIN', async () => {
    const res = await request(app)
      .post('/api/processing/sessions/00000000-0000-0000-0000-000000000000/assets/00000000-0000-0000-0000-000000000001/reopen')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason_code: 'CORRECTION' });
    // Expects 400 (reason_code check) or 404 (session not found)
    expect([400, 404]).toContain(res.status);
  });
});
