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

describe('GET /api/dashboard/stats', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  it('returns dashboard stats for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayArrivals');
    expect(res.body).toHaveProperty('plannedOrders');
    expect(res.body).toHaveProperty('inProgressOrders');
    expect(res.body).toHaveProperty('completedToday');
    expect(res.body).toHaveProperty('tomorrowOrders');
    expect(res.body).toHaveProperty('activeInbounds');
    expect(res.body).toHaveProperty('recentOrders');
    expect(res.body).toHaveProperty('todayInboundsTable');
    expect(res.body).toHaveProperty('recentReports');

    // Numeric fields
    expect(typeof res.body.todayArrivals).toBe('number');
    expect(typeof res.body.plannedOrders).toBe('number');
    expect(typeof res.body.inProgressOrders).toBe('number');
    expect(typeof res.body.completedToday).toBe('number');
    expect(typeof res.body.tomorrowOrders).toBe('number');
    expect(typeof res.body.activeInbounds).toBe('number');

    // Array fields
    expect(Array.isArray(res.body.recentOrders)).toBe(true);
    expect(Array.isArray(res.body.todayInboundsTable)).toBe(true);
    expect(Array.isArray(res.body.recentReports)).toBe(true);
  });

  it('returns dashboard stats for GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayArrivals');
    expect(res.body).toHaveProperty('plannedOrders');
  });

  it('returns dashboard stats for LOGISTICS_PLANNER', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('todayArrivals');
  });

  it('returns dashboard stats for REPORTING_MANAGER', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('recentReports');
    expect(Array.isArray(res.body.recentReports)).toBe(true);
  });
});
