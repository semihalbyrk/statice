const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// We seed an audit log entry so we have something to query
const createdIds = [];

beforeAll(async () => {
  // Create a few audit log entries via direct DB insert
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@statice.nl' } });

  const entry1 = await prisma.auditLog.create({
    data: {
      user_id: adminUser.id,
      action: 'CREATE',
      entity_type: 'Supplier',
      entity_id: 'audit-test-entity-001',
      diff_json: { before: null, after: { name: 'Van der Berg Recycling' } },
    },
  });
  createdIds.push(entry1.id);

  const entry2 = await prisma.auditLog.create({
    data: {
      user_id: adminUser.id,
      action: 'UPDATE',
      entity_type: 'InboundOrder',
      entity_id: 'audit-test-entity-002',
      diff_json: { before: { status: 'PLANNED' }, after: { status: 'ARRIVED' } },
    },
  });
  createdIds.push(entry2.id);
});

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.auditLog.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/admin/audit-logs', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/audit-logs');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns paginated audit log entries for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('entries');
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body.page).toBe(1);
  });

  it('supports pagination with page and limit', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeLessThanOrEqual(1);
    expect(res.body.page).toBe(1);
  });

  it('filters by entity_type', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?entity_type=Supplier')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.entity_type).toBe('Supplier');
    }
  });

  it('filters by action', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.action).toBe('CREATE');
    }
  });

  it('filters by search (entity_id partial match)', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?search=audit-test-entity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of res.body.entries) {
      expect(entry.entity_id.toLowerCase()).toContain('audit-test-entity');
    }
  });

  it('includes user email and full_name in response', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?search=audit-test-entity')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
    const entry = res.body.entries[0];
    expect(entry.user).toHaveProperty('email');
    expect(entry.user).toHaveProperty('full_name');
  });

  it('returns entries ordered by timestamp descending', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs?limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const entries = res.body.entries;
    for (let i = 1; i < entries.length; i++) {
      const prev = new Date(entries[i - 1].timestamp).getTime();
      const curr = new Date(entries[i].timestamp).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});

describe('GET /api/admin/audit-logs/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/admin/audit-logs/${createdIds[0]}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get(`/api/admin/audit-logs/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent audit log entry', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/audit-logs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Audit log entry not found');
  });

  it('returns a single audit log entry by ID', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get(`/api/admin/audit-logs/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.id).toBe(createdIds[0]);
    expect(res.body.data.action).toBe('CREATE');
    expect(res.body.data.entity_type).toBe('Supplier');
    expect(res.body.data.user).toHaveProperty('email', 'admin@statice.nl');
  });
});
