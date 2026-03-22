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
    await prisma.wasteStream.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/admin/waste-streams', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/waste-streams');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns waste streams list for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // Each waste stream should have expected fields
    const ws = res.body.data[0];
    expect(ws).toHaveProperty('id');
    expect(ws).toHaveProperty('name_en');
    expect(ws).toHaveProperty('code');
  });
});

describe('POST /api/admin/waste-streams', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/admin/waste-streams')
      .send({ name_en: 'Test', name_nl: 'Test', code: 'TST' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name_en: 'Test', name_nl: 'Test', code: 'TST' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when required fields are missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name_en: 'Test Only English' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a waste stream as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const uniqueCode = `TST-${Date.now()}`;

    const res = await request(app)
      .post('/api/admin/waste-streams')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name_en: 'Test Waste Stream',
        name_nl: 'Test Afvalstroom',
        code: uniqueCode,
        ewc_code: '160211',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name_en).toBe('Test Waste Stream');
    expect(res.body.code).toBe(uniqueCode);
    createdIds.push(res.body.id);
  });
});

describe('PUT /api/admin/waste-streams/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/admin/waste-streams/some-id')
      .send({ name_en: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put('/api/admin/waste-streams/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name_en: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent waste stream', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/waste-streams/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name_en: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Waste stream not found');
  });

  it('updates a waste stream as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdIds.length).toBeGreaterThan(0);
    const id = createdIds[0];

    const res = await request(app)
      .put(`/api/admin/waste-streams/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name_en: 'Updated Waste Stream Name' });

    expect(res.status).toBe(200);
    expect(res.body.name_en).toBe('Updated Waste Stream Name');
  });
});
