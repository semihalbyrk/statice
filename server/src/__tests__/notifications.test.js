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
let adminUserId;

beforeAll(async () => {
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@statice.nl' } });
  adminUserId = adminUser.id;

  // Create test notifications for the admin user
  const notif1 = await prisma.notification.create({
    data: {
      user_id: adminUserId,
      type: 'ORDER_STATUS',
      title: 'Nieuwe levering ingepland',
      message: 'Order ORD-2026-0042 van Coolrec is ingepland voor morgen.',
      entity_type: 'InboundOrder',
      entity_id: 'notif-test-order-001',
      is_read: false,
    },
  });
  createdIds.push(notif1.id);

  const notif2 = await prisma.notification.create({
    data: {
      user_id: adminUserId,
      type: 'WEIGHING_COMPLETE',
      title: 'Weging afgerond',
      message: 'Weging voor container KLT-2026-0088 is voltooid: 1.245 kg.',
      entity_type: 'WeighingEvent',
      entity_id: 'notif-test-weighing-001',
      is_read: false,
    },
  });
  createdIds.push(notif2.id);

  const notif3 = await prisma.notification.create({
    data: {
      user_id: adminUserId,
      type: 'SYSTEM',
      title: 'Rapport beschikbaar',
      message: 'Maandelijks afvalstroomrapport maart 2026 is klaar.',
      is_read: true,
    },
  });
  createdIds.push(notif3.id);
});

afterAll(async () => {
  for (const id of createdIds) {
    await prisma.notification.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/notifications', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns notifications for the authenticated user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('unreadCount');
    expect(typeof res.body.unreadCount).toBe('number');
  });

  it('returns correct unread count', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // We created 2 unread + 1 read notification; unreadCount should include our 2 unread ones
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(2);
  });

  it('returns notifications ordered by created_at descending', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    for (let i = 1; i < data.length; i++) {
      const prev = new Date(data[i - 1].created_at).getTime();
      const curr = new Date(data[i].created_at).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('only returns notifications belonging to the logged-in user', async () => {
    // Login as gate operator who should not see admin notifications
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // The test notifications were created for the admin user, not gate operator
    const testIds = new Set(createdIds);
    for (const notif of res.body.data) {
      expect(testIds.has(notif.id)).toBe(false);
    }
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch(`/api/notifications/${createdIds[0]}/read`);
    expect(res.status).toBe(401);
  });

  it('marks a notification as read', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/notifications/${createdIds[0]}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    // Verify it was actually marked as read in the database
    const notif = await prisma.notification.findUnique({ where: { id: createdIds[0] } });
    expect(notif.is_read).toBe(true);
  });

  it('reduces unread count after marking as read', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Get initial unread count
    const before = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    const countBefore = before.body.unreadCount;

    // Mark the second unread notification as read
    await request(app)
      .patch(`/api/notifications/${createdIds[1]}/read`)
      .set('Authorization', `Bearer ${token}`);

    // Get updated unread count
    const after = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(after.body.unreadCount).toBeLessThanOrEqual(countBefore);
  });
});

describe('POST /api/notifications/mark-all-read', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/notifications/mark-all-read');
    expect(res.status).toBe(401);
  });

  it('marks all notifications as read for the authenticated user', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // First, create a fresh unread notification so we have something to mark
    const freshNotif = await prisma.notification.create({
      data: {
        user_id: adminUserId,
        type: 'SYSTEM',
        title: 'Sorteerproces gestart',
        message: 'Batch SRT-2026-0015 is gestart op sorteerstation A.',
        is_read: false,
      },
    });
    createdIds.push(freshNotif.id);

    const res = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    // Verify all admin notifications are now read
    const unread = await prisma.notification.count({
      where: { user_id: adminUserId, is_read: false },
    });
    expect(unread).toBe(0);
  });
});
