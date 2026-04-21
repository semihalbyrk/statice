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

describe('GET /api/assets', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/assets');

    expect(res.status).toBe(401);
  });

  it('returns 400 when inbound_id query param is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'inbound_id query parameter is required');
  });

  it('returns empty array for non-existent inbound_id', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/assets?inbound_id=00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns paginated global asset list when list query params are provided', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/assets?search=&page=1&limit=25')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(25);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/assets/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/assets/some-id');

    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent asset', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/assets/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Asset not found');
  });
});

describe('GET /api/assets/next-label', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/assets/next-label');

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-gate/admin role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/assets/next-label')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns next asset label for GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/next-label')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('label');
    expect(typeof res.body.data.label).toBe('string');
    expect(res.body.data.label.length).toBeGreaterThan(0);
  });

  it('returns next asset label for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/assets/next-label')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('label');
  });
});

describe('GET /api/assets/next-container-label', () => {
  it('returns 403 for non-gate/admin role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/assets/next-container-label')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns next container label for GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/next-container-label')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('label');
    expect(typeof res.body.data.label).toBe('string');
  });
});

describe('GET /api/assets/lookup', () => {
  it('returns 400 when label query param is missing', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/lookup')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'label query param required');
  });

  it('returns null/empty data for non-existent label', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/lookup?label=NONEXISTENT-LABEL-999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    // data should be null when asset not found
    expect(res.body.data).toBeNull();
  });
});

describe('GET /api/assets/lookup-container', () => {
  it('returns 400 when label query param is missing', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/lookup-container')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'label query param required');
  });

  it('returns null for non-existent container label', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/assets/lookup-container?label=CONT-NONEXISTENT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

describe('POST /api/assets', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/assets')
      .send({ inbound_id: 'fake' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-gate/admin role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${token}`)
      .send({ inbound_id: 'fake' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/assets/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/assets/some-id');

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-gate/admin role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .delete('/api/assets/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent asset as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .delete('/api/assets/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Asset not found');
  });
});
