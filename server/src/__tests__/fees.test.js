const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

let adminToken;
let financeToken;
let gateToken;

const createdFeeIds = [];

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  financeToken = await getToken('finance@statice.nl', 'Finance123!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
});

afterAll(async () => {
  // Clean up test-created fees (hard delete since soft-delete sets is_active=false)
  for (const id of createdFeeIds) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { fee_id: id } }).catch(() => {});
    await prisma.feeMaster.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// --------------- List Fees ---------------

describe('GET /api/fees', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/fees');
    expect(res.status).toBe(401);
  });

  it('returns fee list for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/fees')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports search query parameter', async () => {
    const res = await request(app)
      .get('/api/fees?search=NONEXISTENT_FEE_TYPE_XYZ')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('supports fee_type filter', async () => {
    const res = await request(app)
      .get('/api/fees?fee_type=NONEXISTENT_TYPE')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// --------------- Get Fee by ID ---------------

describe('GET /api/fees/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/fees/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent fee', async () => {
    const res = await request(app)
      .get('/api/fees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Fee not found');
  });
});

// --------------- Create Fee ---------------

describe('POST /api/fees', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/fees')
      .send({ fee_type: 'CONTAMINATION', rate_type: 'FIXED', rate_value: 50 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ fee_type: 'CONTAMINATION', rate_type: 'FIXED', rate_value: 50 });

    expect(res.status).toBe(403);
  });

  it('creates a fee as ADMIN', async () => {
    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fee_type: 'TEST_CONTAMINATION_' + Date.now(),
        description: 'Test contamination fee for integration tests',
        rate_type: 'FIXED',
        rate_value: 75.50,
        min_cap: 10,
        max_cap: 500,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('fee_type');
    expect(res.body.data.rate_type).toBe('FIXED');
    expect(res.body.data.is_active).toBe(true);
    createdFeeIds.push(res.body.data.id);
  });

  it('creates a fee as FINANCE_MANAGER', async () => {
    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        fee_type: 'TEST_TRANSPORT_' + Date.now(),
        description: 'Test transport fee',
        rate_type: 'PER_KG',
        rate_value: 0.25,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.rate_type).toBe('PER_KG');
    createdFeeIds.push(res.body.data.id);
  });

  it('creates a fee with PERCENTAGE rate type', async () => {
    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fee_type: 'TEST_PERCENTAGE_' + Date.now(),
        description: 'Test percentage-based fee',
        rate_type: 'PERCENTAGE',
        rate_value: 5.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rate_type).toBe('PERCENTAGE');
    createdFeeIds.push(res.body.data.id);
  });
});

// --------------- Get Fee by ID (with created data) ---------------

describe('GET /api/fees/:id (with data)', () => {
  it('returns fee details for a valid id', async () => {
    expect(createdFeeIds.length).toBeGreaterThan(0);
    const id = createdFeeIds[0];

    const res = await request(app)
      .get(`/api/fees/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', id);
    expect(res.body.data).toHaveProperty('fee_type');
    expect(res.body.data).toHaveProperty('description');
    expect(res.body.data).toHaveProperty('rate_type');
    expect(res.body.data).toHaveProperty('rate_value');
    expect(res.body.data).toHaveProperty('is_active', true);
  });
});

// --------------- Update Fee ---------------

describe('PUT /api/fees/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/fees/some-id')
      .send({ description: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .put('/api/fees/some-id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ description: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent fee', async () => {
    const res = await request(app)
      .put('/api/fees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Fee not found');
  });

  it('updates a fee as ADMIN', async () => {
    expect(createdFeeIds.length).toBeGreaterThan(0);
    const id = createdFeeIds[0];

    const res = await request(app)
      .put(`/api/fees/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'Updated contamination fee description',
        rate_value: 100,
        min_cap: 20,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated contamination fee description');
  });

  it('updates a fee as FINANCE_MANAGER', async () => {
    expect(createdFeeIds.length).toBeGreaterThan(0);
    const id = createdFeeIds[0];

    const res = await request(app)
      .put(`/api/fees/${id}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ rate_value: 85 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', id);
  });
});

// --------------- Delete (Deactivate) Fee ---------------

describe('DELETE /api/fees/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/fees/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for FINANCE_MANAGER role (ADMIN-only)', async () => {
    const res = await request(app)
      .delete('/api/fees/some-id')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .delete('/api/fees/some-id')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent fee', async () => {
    const res = await request(app)
      .delete('/api/fees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Fee not found');
  });

  it('deactivates a fee as ADMIN', async () => {
    expect(createdFeeIds.length).toBeGreaterThan(0);
    // Use the last created fee to avoid interfering with other tests
    const id = createdFeeIds[createdFeeIds.length - 1];

    const res = await request(app)
      .delete(`/api/fees/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Fee deactivated');

    // Verify the fee is now inactive
    const checkRes = await request(app)
      .get(`/api/fees/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.is_active).toBe(false);
  });
});

// --------------- Audit Log Verification ---------------

describe('Fee audit logging', () => {
  it('writes audit log entry when fee is created', async () => {
    expect(createdFeeIds.length).toBeGreaterThan(0);
    const id = createdFeeIds[0];

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity_type: 'FeeMaster',
        entity_id: id,
        action: 'CREATE',
      },
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry.entity_id).toBe(id);
  });
});
