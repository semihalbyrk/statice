const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

const testEmail = `deactivated-${Date.now()}@statice.test`;
let deactivatedUserId;

beforeAll(async () => {
  // Create a user that will be deactivated
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password_hash: await bcrypt.hash('Deact1234!', 10),
      full_name: 'Gedeactiveerde Medewerker',
      role: 'GATE_OPERATOR',
      is_active: true,
    },
  });
  deactivatedUserId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: deactivatedUserId } }).catch(() => {});
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// authenticateToken — edge cases
// ---------------------------------------------------------------------------
describe('authenticateToken middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Access token required');
  });

  it('returns 401 when token is malformed (not a JWT)', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer not-a-real-jwt-token');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 401 when token is signed with wrong secret', async () => {
    const fakeToken = jwt.sign(
      { userId: deactivatedUserId, role: 'GATE_OPERATOR' },
      'wrong-secret-key-xxx',
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 401 when token is expired', async () => {
    const expiredToken = jwt.sign(
      { userId: deactivatedUserId, role: 'GATE_OPERATOR' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' } // already expired
    );

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid or expired token');
  });

  it('returns 401 when user has been deactivated after token was issued', async () => {
    // First, log in while active to get a valid token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'Deact1234!' });
    expect(loginRes.status).toBe(200);
    const validToken = loginRes.body.accessToken;

    // Deactivate the user
    await prisma.user.update({
      where: { id: deactivatedUserId },
      data: { is_active: false },
    });

    // The previously valid token should now be rejected
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Account disabled');

    // Re-activate for cleanup safety
    await prisma.user.update({
      where: { id: deactivatedUserId },
      data: { is_active: true },
    });
  });

  it('returns 401 when token references a deleted user', async () => {
    const ghostToken = jwt.sign(
      { userId: FAKE_UUID, role: 'ADMIN' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${ghostToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Account disabled');
  });
});

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// requireRole — edge cases
// ---------------------------------------------------------------------------
describe('requireRole middleware', () => {
  it('returns 403 when GATE_OPERATOR accesses ADMIN-only endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'gate@statice.nl', password: 'Gate1234!' });
    const gateToken = loginRes.body.accessToken;

    // /api/admin/users is ADMIN-only
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 403 when SORTING_EMPLOYEE accesses FINANCE endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sorting@statice.nl', password: 'Sorting123!' });
    const sortingToken = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${sortingToken}`);
    expect(res.status).toBe(403);
  });

  it('allows ADMIN to access any protected endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@statice.nl', password: 'Admin1234!' });
    const adminToken = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
