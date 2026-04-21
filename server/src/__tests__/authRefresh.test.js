const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

describe('POST /api/auth/refresh cookie handling', () => {
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'disabled-refresh@statice.nl' },
      update: {
        password_hash: await bcrypt.hash('Disabled123!', 10),
        full_name: 'Disabled Refresh User',
        role: 'ADMIN',
        is_active: false,
      },
      create: {
        email: 'disabled-refresh@statice.nl',
        password_hash: await bcrypt.hash('Disabled123!', 10),
        full_name: 'Disabled Refresh User',
        role: 'ADMIN',
        is_active: false,
      },
    });
  });

  it('clears refresh cookie when token belongs to a disabled user', async () => {
    const disabledUser = await prisma.user.findUnique({
      where: { email: 'disabled-refresh@statice.nl' },
    });

    expect(disabledUser).toBeTruthy();

    const refreshToken = jwt.sign(
      { userId: disabledUser.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'User not found or disabled' });

    const cookies = res.headers['set-cookie'] || [];
    const cleared = cookies.find((cookie) => cookie.startsWith('refreshToken='));
    expect(cleared).toBeDefined();
  });
});
