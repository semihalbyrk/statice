const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

const createdContainerIds = [];

afterAll(async () => {
  for (const id of createdContainerIds) {
    await prisma.containerRegistry.deleteMany({ where: { id } });
  }
  await prisma.$disconnect();
});

describe('POST /api/containers', () => {
  it('creates a container and returns 201', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        container_label: 'WERF-SKIP-001',
        container_type: 'OPEN_TOP',
        tare_weight_kg: 850,
        volume_m3: 10,
        notes: 'Grote skip voor metaal',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.container_label).toBe('WERF-SKIP-001');
    expect(res.body.container_type).toBe('OPEN_TOP');
    expect(res.body.is_active).toBe(true);
    createdContainerIds.push(res.body.id);
  });

  it('rejects duplicate container label with 409', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        container_label: 'WERF-SKIP-001',
        container_type: 'GITTERBOX',
        tare_weight_kg: 200,
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Container label already exists');
  });

  it('returns 400 when required fields are missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({ container_label: 'GITTER-A12' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/containers', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/containers');
    expect(res.status).toBe(401);
  });

  it('lists active containers with pagination envelope', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/containers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('PUT /api/containers/:id', () => {
  it('updates a container', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Create a container to update
    const createRes = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        container_label: 'GITTER-A12',
        container_type: 'GITTERBOX',
        tare_weight_kg: 120,
      });
    expect(createRes.status).toBe(201);
    createdContainerIds.push(createRes.body.id);

    const res = await request(app)
      .put(`/api/containers/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tare_weight_kg: 130, notes: 'Gewicht bijgewerkt' });

    expect(res.status).toBe(200);
    expect(Number(res.body.tare_weight_kg)).toBe(130);
    expect(res.body.notes).toBe('Gewicht bijgewerkt');
  });

  it('returns 404 for non-existent container', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/containers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'nothing' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/containers/:id', () => {
  it('soft-deletes (deactivates) a container', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const createRes = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        container_label: 'PALLET-B07',
        container_type: 'PALLET',
        tare_weight_kg: 25,
      });
    expect(createRes.status).toBe(201);
    const containerId = createRes.body.id;
    createdContainerIds.push(containerId);

    const deleteRes = await request(app)
      .delete(`/api/containers/${containerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.is_active).toBe(false);
    expect(deleteRes.body.id).toBe(containerId);
  });

  it('deactivated container does not appear in active=true list', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Create and deactivate a container
    const createRes = await request(app)
      .post('/api/containers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        container_label: 'WERF-SKIP-INACTIEF',
        container_type: 'CLOSED_TOP',
        tare_weight_kg: 900,
      });
    expect(createRes.status).toBe(201);
    const containerId = createRes.body.id;
    createdContainerIds.push(containerId);

    await request(app)
      .delete(`/api/containers/${containerId}`)
      .set('Authorization', `Bearer ${token}`);

    const listRes = await request(app)
      .get('/api/containers?active=true')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((c) => c.id);
    expect(ids).not.toContain(containerId);
  });
});
