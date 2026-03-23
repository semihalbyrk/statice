const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

const createdIds = [];

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.carrier.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/carriers', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/carriers');
    expect(res.status).toBe(401);
  });

  it('returns paginated carrier list with auth', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/carriers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('supports search query parameter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/carriers?search=NONEXISTENT_CARRIER_XYZ')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('allows any authenticated role to list carriers', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/carriers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/carriers/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/carriers/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/carriers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Carrier not found');
  });
});

describe('POST /api/carriers', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/carriers')
      .send({ name: 'Test Carrier' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .post('/api/carriers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Carrier' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/carriers')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a carrier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/carriers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Carrier Admin',
        contact_name: 'Piet Jansen',
        contact_email: 'piet@carrier.nl',
        licence_number: 'VIHB-TEST-001',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Carrier Admin');
    createdIds.push(res.body.id);
  });

  it('creates a carrier as LOGISTICS_PLANNER', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/carriers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Carrier Planner',
        licence_number: 'VIHB-TEST-002',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdIds.push(res.body.id);
  });
});

describe('PUT /api/carriers/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/carriers/some-id')
      .send({ name: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put('/api/carriers/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/carriers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Carrier not found');
  });

  it('updates a carrier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdIds.length).toBeGreaterThan(0);
    const id = createdIds[0];

    const res = await request(app)
      .put(`/api/carriers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Carrier Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Carrier Name');
  });
});

describe('PATCH /api/carriers/:id/status', () => {
  let toggleCarrierId;

  beforeAll(async () => {
    // Create a dedicated carrier for toggle tests
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/carriers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Koeriersdienst Van Dijk', licence_number: 'VIHB-TOGGLE-001' });
    toggleCarrierId = res.body.id;
    createdIds.push(toggleCarrierId);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/carriers/some-id/status')
      .send({ is_active: false });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch('/api/carriers/some-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(403);
  });

  it('returns 400 when is_active is not a boolean', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 'ja' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'is_active (boolean) is required');
  });

  it('returns 400 when is_active is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for non-existent carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch('/api/carriers/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Carrier not found');
  });

  it('deactivates a carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });

  it('reactivates a carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(true);
  });

  it('returns current state when already in desired state', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Carrier is already active from previous test
    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(true);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .patch(`/api/carriers/${toggleCarrierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/carriers/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/carriers/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .delete('/api/carriers/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .delete('/api/carriers/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent carrier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .delete('/api/carriers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Carrier not found');
  });

  it('deactivates a carrier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdIds.length).toBeGreaterThan(0);
    const id = createdIds[0];

    const res = await request(app)
      .delete(`/api/carriers/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Carrier deactivated');
  });
});
