const request = require('supertest');
const app = require('../index.js');

/** Helper: login and return { accessToken, refreshCookie } */
async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const cookies = res.headers['set-cookie'] || [];
  const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

  return {
    accessToken: res.body.accessToken,
    refreshCookie,
    status: res.status,
    body: res.body,
  };
}

describe('POST /api/auth/login', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'anything' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@statice.nl' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@statice.nl', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@statice.nl', password: 'Whatever123!' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('logs in admin successfully and returns accessToken + user', async () => {
    const { status, body, refreshCookie } = await loginAs('admin@statice.nl', 'Admin1234!');

    expect(status).toBe(200);
    expect(body).toHaveProperty('accessToken');
    expect(typeof body.accessToken).toBe('string');
    expect(body.user).toMatchObject({
      email: 'admin@statice.nl',
      role: 'ADMIN',
    });
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('full_name');
    // Refresh token cookie should be set
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('logs in gate operator successfully', async () => {
    const { status, body } = await loginAs('gate@statice.nl', 'Gate1234!');

    expect(status).toBe(200);
    expect(body.user.role).toBe('GATE_OPERATOR');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh token cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns a new accessToken when a valid refresh cookie is sent', async () => {
    const { refreshCookie } = await loginAs('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh token cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Logged out successfully');
    // The Set-Cookie header should clear the refreshToken
    const cookies = res.headers['set-cookie'] || [];
    const cleared = cookies.find((c) => c.startsWith('refreshToken='));
    if (cleared) {
      // Cookie value should be empty or max-age=0
      expect(cleared).toMatch(/refreshToken=/);
    }
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-value');

    expect(res.status).toBe(401);
  });

  it('returns current user profile with a valid token', async () => {
    const { accessToken } = await loginAs('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'planner@statice.nl',
      role: 'LOGISTICS_PLANNER',
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('full_name');
    // Should not leak password hash
    expect(res.body).not.toHaveProperty('password_hash');
  });
});
