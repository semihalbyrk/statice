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
  // Clean up test-created suppliers
  for (const id of createdIds) {
    await prisma.supplier.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('GET /api/suppliers', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/suppliers');
    expect(res.status).toBe(401);
  });

  it('returns paginated supplier list with auth', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('supports search query parameter', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/suppliers?search=NONEXISTENT_SUPPLIER_XYZ')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('allows any authenticated role to list suppliers', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .get('/api/suppliers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/suppliers/:id', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/suppliers/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/suppliers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Supplier not found');
  });
});

describe('POST /api/suppliers', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .send({ name: 'Test', supplier_type: 'THIRD_PARTY' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', supplier_type: 'THIRD_PARTY' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ supplier_type: 'THIRD_PARTY' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when supplier_type is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Supplier' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a supplier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Supplier Admin',
        supplier_type: 'THIRD_PARTY',
        contact_name: 'Jan de Vries',
        contact_email: 'jan@test.nl',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Supplier Admin');
    expect(res.body.supplier_type).toBe('THIRD_PARTY');
    createdIds.push(res.body.id);
  });

  it('creates a supplier as LOGISTICS_PLANNER', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Supplier Planner',
        supplier_type: 'THIRD_PARTY',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    createdIds.push(res.body.id);
  });
});

describe('PUT /api/suppliers/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/suppliers/some-id')
      .send({ name: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .put('/api/suppliers/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .put('/api/suppliers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Supplier not found');
  });

  it('updates a supplier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Use one of the created suppliers
    expect(createdIds.length).toBeGreaterThan(0);
    const id = createdIds[0];

    const res = await request(app)
      .put(`/api/suppliers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Supplier Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Supplier Name');
  });
});

describe('GET /api/suppliers?hasActiveContract=true', () => {
  it('filters suppliers to only those with active contracts', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .get('/api/suppliers?hasActiveContract=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Every returned supplier should have at least one active contract
    for (const supplier of res.body.data) {
      const contracts = await prisma.supplierContract.findMany({
        where: { supplier_id: supplier.id, status: 'ACTIVE', is_active: true },
      });
      expect(contracts.length).toBeGreaterThan(0);
    }
  });

  it('returns fewer or equal results than unfiltered query', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const [allRes, filteredRes] = await Promise.all([
      request(app).get('/api/suppliers?limit=100').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/suppliers?hasActiveContract=true&limit=100').set('Authorization', `Bearer ${token}`),
    ]);

    expect(allRes.status).toBe(200);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.total).toBeLessThanOrEqual(allRes.body.total);
  });
});

describe('PATCH /api/suppliers/:id/status', () => {
  let toggleSupplierId;

  beforeAll(async () => {
    // Create a dedicated supplier for toggle tests
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Toggle Test Supplier', supplier_type: 'THIRD_PARTY' });
    toggleSupplierId = res.body.id;
    createdIds.push(toggleSupplierId);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/suppliers/some-id/status')
      .send({ is_active: false });

    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN roles', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .patch('/api/suppliers/some-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(403);
  });

  it('returns 400 when is_active is not a boolean', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'is_active (boolean) is required');
  });

  it('returns 400 when is_active is missing', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for non-existent supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch('/api/suppliers/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Supplier not found');
  });

  it('deactivates a supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });

  it('reactivates a supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(true);
  });

  it('returns current state without changes when already in desired state', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Supplier is already active from previous test
    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: true });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(true);
  });

  it('terminates active contracts on deactivation', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    // Create a contract for this supplier so we can verify termination
    const contract = await prisma.supplierContract.create({
      data: {
        contract_number: `SC-TOGGLE-TEST-${Date.now()}`,
        supplier_id: toggleSupplierId,
        name: 'Toggle Test Contract',
        effective_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .patch(`/api/suppliers/${toggleSupplierId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);

    // Verify the contract was terminated
    const updatedContract = await prisma.supplierContract.findUnique({
      where: { id: contract.id },
    });
    expect(updatedContract.status).toBe('INACTIVE');

    // Clean up
    await prisma.supplierContract.delete({ where: { id: contract.id } }).catch(() => {});
  });
});

describe('DELETE /api/suppliers/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/suppliers/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const token = await getToken('planner@statice.nl', 'Planner123!');

    const res = await request(app)
      .delete('/api/suppliers/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');

    const res = await request(app)
      .delete('/api/suppliers/some-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent supplier', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    const res = await request(app)
      .delete('/api/suppliers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Supplier not found');
  });

  it('deactivates a supplier as ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');

    expect(createdIds.length).toBeGreaterThan(0);
    const id = createdIds[0];

    const res = await request(app)
      .delete(`/api/suppliers/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Supplier deactivated');
  });
});
