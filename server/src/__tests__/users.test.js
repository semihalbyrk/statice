const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

const createdUserIds = [];

afterAll(async () => {
  for (const id of createdUserIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/admin/users', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for REPORTING_MANAGER role', async () => {
    const token = await getToken('reporting@statice.nl', 'Report123!');

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns users list for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');

    // Should not expose password_hash
    const user = res.body.users[0];
    expect(user).not.toHaveProperty('password_hash');
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
  });

  it('supports search query parameter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/users?search=admin@statice.nl')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.users[0].email).toBe('admin@statice.nl');
  });

  it('supports role filter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/admin/users?role=ADMIN')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    res.body.users.forEach((u) => {
      expect(u.role).toBe('ADMIN');
    });
  });
});

describe('POST /api/admin/users', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({ email: 'new@test.nl', full_name: 'New User', role: 'GATE_OPERATOR', password: 'Test1234!' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@test.nl', full_name: 'New User', role: 'GATE_OPERATOR', password: 'Test1234!' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid email', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email', full_name: 'Test User', role: 'GATE_OPERATOR', password: 'Test1234!' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid role', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@test.nl', full_name: 'Test User', role: 'INVALID_ROLE', password: 'Test1234!' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for weak password', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'test@test.nl', full_name: 'Test User', role: 'GATE_OPERATOR', password: 'weak' });

    expect(res.status).toBe(422);
  });

  it('creates a user as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const uniqueEmail = `testuser-${Date.now()}@statice.nl`;

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: uniqueEmail,
        full_name: 'Test User Created',
        role: 'GATE_OPERATOR',
        password: 'TestPass1!',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(uniqueEmail);
    expect(res.body.data.role).toBe('GATE_OPERATOR');
    expect(res.body.data).not.toHaveProperty('password_hash');
    createdUserIds.push(res.body.data.id);
  });

  it('returns 409 for duplicate email', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'admin@statice.nl',
        full_name: 'Duplicate Admin',
        role: 'ADMIN',
        password: 'Test1234!',
      });

    expect(res.status).toBe(409);
  });
});

describe('PUT /api/admin/users/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/admin/users/some-id')
      .send({ full_name: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put('/api/admin/users/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Updated Name' });

    expect(res.status).toBe(404);
  });

  it('updates a user as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdUserIds.length).toBeGreaterThan(0);
    const id = createdUserIds[0];

    const res = await request(app)
      .put(`/api/admin/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Updated Test User' });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Updated Test User');
  });
});

describe('POST /api/admin/users/:id/reset-password', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/admin/users/some-id/reset-password')
      .send({ new_password: 'NewPass1!' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/admin/users/some-id/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'NewPass1!' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/admin/users/00000000-0000-0000-0000-000000000000/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'NewPass1!' });

    expect(res.status).toBe(404);
  });

  it('returns 422 for weak password', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdUserIds.length).toBeGreaterThan(0);
    const id = createdUserIds[0];

    const res = await request(app)
      .post(`/api/admin/users/${id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'weak' });

    expect(res.status).toBe(422);
  });

  it('resets password successfully as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdUserIds.length).toBeGreaterThan(0);
    const id = createdUserIds[0];

    const res = await request(app)
      .post(`/api/admin/users/${id}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ new_password: 'NewPass1!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Password reset successfully');
  });
});
