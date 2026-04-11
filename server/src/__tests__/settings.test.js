const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// Store original settings so we can restore them after tests
let originalSettings;

beforeAll(async () => {
  originalSettings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
  if (!originalSettings) {
    originalSettings = await prisma.systemSetting.create({ data: { id: 'singleton' } });
  }
});

afterAll(async () => {
  // Restore original settings
  if (originalSettings) {
    const { id, updated_at, ...restoreData } = originalSettings;
    await prisma.systemSetting.update({
      where: { id: 'singleton' },
      data: restoreData,
    }).catch(() => {});
  }
  // Clean up audit log entries created by settings tests
  await prisma.auditLog.deleteMany({
    where: { entity_type: 'SystemSetting', entity_id: 'singleton' },
  }).catch(() => {});
  await prisma.$disconnect();
});

describe('GET /api/admin/settings', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns system settings for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('facility_name');
    expect(res.body.data).toHaveProperty('facility_address');
    expect(res.body.data).toHaveProperty('facility_permit_number');
    expect(res.body.data).toHaveProperty('facility_kvk');
    expect(res.body.data).toHaveProperty('report_footer_text');
    expect(res.body.data).toHaveProperty('max_skips_per_event');
  });

  it('includes smtp_configured and simulation_mode flags', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.smtp_configured).toBe('boolean');
    expect(res.body.data.simulation_mode).toBe(true);
  });
});

describe('PUT /api/admin/settings', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .send({ facility_name: 'Statice Test B.V.' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_name: 'Statice Test B.V.' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for SORTING_EMPLOYEE role', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_name: 'Statice Test B.V.' });

    expect(res.status).toBe(403);
  });

  it('returns 422 when no valid fields are provided', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error', 'No valid fields to update');
  });

  it('returns 422 for invalid KvK number (not 8 digits)', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_kvk: '1234' });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('KvK');
  });

  it('returns 422 for KvK with non-digit characters', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_kvk: 'ABCD1234' });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('KvK');
  });

  it('returns 422 for max_skips_per_event below 1', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ max_skips_per_event: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('max_skips_per_event');
  });

  it('returns 422 for max_skips_per_event above 20', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ max_skips_per_event: 25 });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('max_skips_per_event');
  });

  it('updates facility_name', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_name: 'Statice Elektronica Recycling B.V.' });

    expect(res.status).toBe(200);
    expect(res.body.data.facility_name).toBe('Statice Elektronica Recycling B.V.');
  });

  it('updates facility_address', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_address: 'Industrieweg 42, 5678 CD Eindhoven' });

    expect(res.status).toBe(200);
    expect(res.body.data.facility_address).toBe('Industrieweg 42, 5678 CD Eindhoven');
  });

  it('updates facility_kvk with valid 8-digit number', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_kvk: '87654321' });

    expect(res.status).toBe(200);
    expect(res.body.data.facility_kvk).toBe('87654321');
  });

  it('updates max_skips_per_event within valid range', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ max_skips_per_event: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.max_skips_per_event).toBe(5);
  });

  it('updates report_footer_text', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_footer_text: 'Statice Elektronica Recycling B.V. -- Vertrouwelijk document' });

    expect(res.status).toBe(200);
    expect(res.body.data.report_footer_text).toBe('Statice Elektronica Recycling B.V. -- Vertrouwelijk document');
  });

  it('updates multiple fields at once', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        facility_name: 'Statice B.V.',
        facility_permit_number: 'ST-2026-002',
        max_skips_per_event: 8,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.facility_name).toBe('Statice B.V.');
    expect(res.body.data.facility_permit_number).toBe('ST-2026-002');
    expect(res.body.data.max_skips_per_event).toBe(8);
  });

  it('includes smtp_configured and simulation_mode in update response', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ facility_name: 'Statice B.V.' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.smtp_configured).toBe('boolean');
    expect(res.body.data.simulation_mode).toBe(true);
  });

  it('writes an audit log entry on update', async () => {
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entity_type: 'SystemSetting', entity_id: 'singleton', action: 'UPDATE' },
      orderBy: { timestamp: 'desc' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.action).toBe('UPDATE');
  });
});
