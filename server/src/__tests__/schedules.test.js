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
    await prisma.reportSchedule.delete({ where: { id } }).catch(() => {});
  }
  // Clean up audit log entries created by schedule operations
  await prisma.auditLog.deleteMany({
    where: { entity_type: 'ReportSchedule', entity_id: { in: createdIds } },
  }).catch(() => {});
  await prisma.$disconnect();
});

describe('GET /api/reports/schedules', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/reports/schedules');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for SORTING_EMPLOYEE role', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');

    const res = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns schedule list for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns schedule list for REPORTING_MANAGER', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/reports/schedules', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/reports/schedules')
      .send({ report_type: 'RPT-01', frequency: 'DAILY', format: 'PDF' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'RPT-01', frequency: 'DAILY', format: 'PDF' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid report_type', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'INVALID', frequency: 'DAILY', format: 'PDF', recipient_emails: ['admin@statice.nl'] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('report_type');
  });

  it('returns 400 for invalid frequency', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'RPT-01', frequency: 'HOURLY', format: 'PDF', recipient_emails: ['admin@statice.nl'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('frequency');
  });

  it('returns 400 for invalid format', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'RPT-01', frequency: 'DAILY', format: 'CSV', recipient_emails: ['admin@statice.nl'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('format');
  });

  it('returns 422 when WEEKLY is missing day_of_week', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'RPT-01', frequency: 'WEEKLY', format: 'PDF', recipient_emails: ['admin@statice.nl'] });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('day_of_week');
  });

  it('returns 422 when MONTHLY is missing day_of_month', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({ report_type: 'RPT-02', frequency: 'MONTHLY', format: 'XLSX', recipient_emails: ['admin@statice.nl'] });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('day_of_month');
  });

  it('returns 422 for invalid recipient email', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_type: 'RPT-01',
        frequency: 'DAILY',
        format: 'PDF',
        recipient_emails: ['not-an-email'],
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Invalid email');
  });

  it('creates a daily schedule as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_type: 'RPT-01',
        frequency: 'DAILY',
        format: 'PDF',
        recipient_emails: ['administratie@statice.nl', 'rapportage@statice.nl'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.report_type).toBe('RPT-01');
    expect(res.body.data.frequency).toBe('DAILY');
    expect(res.body.data.format).toBe('PDF');
    expect(res.body.data.is_active).toBe(true);
    expect(res.body.data.next_run_at).toBeDefined();
    expect(res.body.data.recipient_emails).toEqual(['administratie@statice.nl', 'rapportage@statice.nl']);
    createdIds.push(res.body.data.id);
  });

  it('creates a weekly schedule as REPORTING_MANAGER', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_type: 'RPT-03',
        frequency: 'WEEKLY',
        day_of_week: 1, // Monday
        format: 'XLSX',
        recipient_emails: ['logistiek@statice.nl'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('WEEKLY');
    expect(res.body.data.day_of_week).toBe(1);
    createdIds.push(res.body.data.id);
  });

  it('creates a monthly schedule with BOTH format', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        report_type: 'RPT-05',
        frequency: 'MONTHLY',
        day_of_month: 15,
        format: 'BOTH',
        recipient_emails: ['milieu@statice.nl'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('MONTHLY');
    expect(res.body.data.day_of_month).toBe(15);
    expect(res.body.data.format).toBe('BOTH');
    createdIds.push(res.body.data.id);
  });

  it('writes an audit log entry on create', async () => {
    // The last created schedule should have an audit log entry
    const lastId = createdIds[createdIds.length - 1];
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entity_type: 'ReportSchedule', entity_id: lastId, action: 'CREATE' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.action).toBe('CREATE');
  });
});

describe('GET /api/reports/schedules/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/reports/schedules/${createdIds[0]}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent schedule', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/reports/schedules/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Schedule not found');
  });

  it('returns a single schedule by ID', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.id).toBe(createdIds[0]);
    expect(res.body.data.report_type).toBe('RPT-01');
  });
});

describe('PUT /api/reports/schedules/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .send({ format: 'XLSX' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'XLSX' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent schedule', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/reports/schedules/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'XLSX' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Schedule not found');
  });

  it('returns 422 for invalid recipient email on update', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipient_emails: ['ongeldige-email'] });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Invalid email');
  });

  it('updates format of an existing schedule', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'BOTH' });

    expect(res.status).toBe(200);
    expect(res.body.data.format).toBe('BOTH');
  });

  it('updates frequency and recomputes next_run_at', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Get current next_run_at
    const before = await request(app)
      .get(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`);
    const originalNextRun = before.body.data.next_run_at;

    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ frequency: 'WEEKLY', day_of_week: 3 }); // Wednesday

    expect(res.status).toBe(200);
    expect(res.body.data.frequency).toBe('WEEKLY');
    expect(res.body.data.day_of_week).toBe(3);
    // next_run_at should have changed
    expect(res.body.data.next_run_at).not.toBe(originalNextRun);
  });

  it('updates recipient emails', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recipient_emails: ['directie@statice.nl', 'compliance@statice.nl'] });

    expect(res.status).toBe(200);
    expect(res.body.data.recipient_emails).toEqual(['directie@statice.nl', 'compliance@statice.nl']);
  });

  it('writes an audit log entry on update', async () => {
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entity_type: 'ReportSchedule', entity_id: createdIds[0], action: 'UPDATE' },
      orderBy: { timestamp: 'desc' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.action).toBe('UPDATE');
  });
});

describe('DELETE /api/reports/schedules/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/reports/schedules/${createdIds[0]}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .delete(`/api/reports/schedules/${createdIds[0]}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent schedule', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .delete('/api/reports/schedules/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Schedule not found');
  });

  it('soft-deletes (deactivates) a schedule', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Use the monthly schedule for deletion
    const targetId = createdIds[2];

    const res = await request(app)
      .delete(`/api/reports/schedules/${targetId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Schedule deactivated');

    // Verify it was soft-deleted (is_active = false), not hard-deleted
    const schedule = await prisma.reportSchedule.findUnique({ where: { id: targetId } });
    expect(schedule).not.toBeNull();
    expect(schedule.is_active).toBe(false);
  });

  it('writes an audit log entry on delete', async () => {
    const targetId = createdIds[2];
    const auditEntry = await prisma.auditLog.findFirst({
      where: { entity_type: 'ReportSchedule', entity_id: targetId, action: 'DELETE' },
    });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry.action).toBe('DELETE');
  });
});
