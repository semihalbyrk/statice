const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken;
}

// ─── Test state ────────────────────────────────────────────────
let createdFeeId;
let createdSupplierId;
let createdContractId;
let createdOrderId;
let createdIncidentId;
let adminUserId;
let carrierId;
let wasteStreamId;

beforeAll(async () => {
  // Fetch required IDs from DB
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@statice.nl' }, select: { id: true } });
  adminUserId = adminUser.id;
  const carrier = await prisma.carrier.findFirst({ select: { id: true } });
  carrierId = carrier.id;
  const ws = await prisma.wasteStream.findFirst({ select: { id: true } });
  wasteStreamId = ws.id;

  // 1. Create an isolated test supplier
  const ts = Date.now();
  const supplier = await prisma.supplier.create({
    data: {
      name: `TestContamination B.V. ${ts}`,
      supplier_type: 'THIRD_PARTY',
      kvk_number: String(ts).slice(-8),
      contact_name: 'Test Contact',
      contact_email: `contamination-test-${ts}@statice.test`,
      is_active: true,
    },
  });
  createdSupplierId = supplier.id;

  // 2. Create a fee master for contamination penalty
  const fee = await prisma.feeMaster.create({
    data: {
      fee_type: `CONTAMINATION_TEST_${ts}`,
      description: 'Test contamination penalty fee',
      rate_type: 'FIXED',
      rate_value: 75,
      is_active: true,
    },
  });
  createdFeeId = fee.id;

  // 3. Create a contract for the test supplier with contamination tolerance + penalty
  const contract = await prisma.supplierContract.create({
    data: {
      contract_number: `TST-CONTRACT-CON-${ts}`,
      name: `Test Contamination Contract ${ts}`,
      supplier_id: createdSupplierId,
      carrier_id: carrierId,
      status: 'ACTIVE',
      is_active: true,
      effective_date: new Date('2026-01-01'),
      expiry_date: new Date('2026-12-31'),
      contamination_tolerance_pct: 5,
      payment_term_days: 30,
      invoicing_frequency: 'MONTHLY',
      contract_type: 'INCOMING',
      contamination_penalties: { create: [{ fee_id: fee.id }] },
    },
  });
  createdContractId = contract.id;

  // 4. Create an InboundOrder in IN_PROGRESS status
  const order = await prisma.inboundOrder.create({
    data: {
      order_number: `TST-CON-${ts}`,
      supplier_id: createdSupplierId,
      carrier_id: carrierId,
      waste_stream_id: wasteStreamId,
      planned_date: new Date('2026-03-15'),
      status: 'IN_PROGRESS',
      created_by: adminUserId,
    },
  });
  createdOrderId = order.id;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  if (createdIncidentId) {
    await prisma.auditLog.deleteMany({ where: { entity_type: 'ContaminationIncident', entity_id: createdIncidentId } }).catch(() => {});
    await prisma.contaminationIncident.delete({ where: { id: createdIncidentId } }).catch(() => {});
  }
  if (createdOrderId) {
    await prisma.inbound.deleteMany({ where: { order_id: createdOrderId } }).catch(() => {});
    await prisma.inboundOrder.delete({ where: { id: createdOrderId } }).catch(() => {});
  }
  if (createdContractId) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: createdContractId } }).catch(() => {});
    await prisma.supplierContract.delete({ where: { id: createdContractId } }).catch(() => {});
  }
  if (createdFeeId) {
    await prisma.feeMaster.delete({ where: { id: createdFeeId } }).catch(() => {});
  }
  if (createdSupplierId) {
    await prisma.supplier.delete({ where: { id: createdSupplierId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ─── GET /api/contamination ──────────────────────────────────────
describe('GET /api/contamination', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/contamination');
    expect(res.status).toBe(401);
  });

  it('returns paginated list for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/contamination')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('returns paginated list for FINANCE_MANAGER', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .get('/api/contamination')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns paginated list for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .get('/api/contamination')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by order_id', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get(`/api/contamination?order_id=${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters by is_invoiced', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/contamination?is_invoiced=false')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const incident of res.body.data) {
      expect(incident.is_invoiced).toBe(false);
    }
  });

  it('respects page and limit params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/contamination?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });
});

// ─── GET /api/contamination/config/:contractId ───────────────────
describe('GET /api/contamination/config/:contractId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/contamination/config/${createdContractId}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for FINANCE_MANAGER (not in SORTING_ROLES)', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .get(`/api/contamination/config/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns contract contamination config for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .get(`/api/contamination/config/${createdContractId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('contract_id', createdContractId);
    expect(res.body.data).toHaveProperty('contamination_tolerance_pct');
    expect(Array.isArray(res.body.data.penalties)).toBe(true);
    expect(res.body.data.penalties.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent contract', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get(`/api/contamination/config/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/contamination ─────────────────────────────────────
describe('POST /api/contamination', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/contamination').send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 for FINANCE_MANAGER (not in SORTING_ROLES)', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .post('/api/contamination')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: createdOrderId, contamination_type: 'NON_WEEE', description: 'Test' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/contamination')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_id: FAKE_UUID, contamination_type: 'NON_WEEE', description: 'Test' });
    expect(res.status).toBe(404);
  });

  it('records a contamination incident and writes audit log', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/contamination')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_id: createdOrderId,
        contamination_type: 'NON_WEEE',
        description: 'Mixed non-WEEE plastics found in batch',
        contamination_weight_kg: 3.5,
        contamination_pct: 2.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('incident_number');
    expect(res.body.data.contamination_type).toBe('NON_WEEE');
    expect(res.body.data.description).toBe('Mixed non-WEEE plastics found in batch');
    expect(res.body.data.is_invoiced).toBe(false);
    createdIncidentId = res.body.data.id;

    // Verify audit log was written
    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'ContaminationIncident', entity_id: createdIncidentId, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });
});

// ─── GET /api/contamination/:id ──────────────────────────────────
describe('GET /api/contamination/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/contamination/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent id', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get(`/api/contamination/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns incident by id for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .get(`/api/contamination/${createdIncidentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', createdIncidentId);
    expect(res.body.data).toHaveProperty('incident_number');
    expect(res.body.data).toHaveProperty('order');
  });

  it('returns incident by id for FINANCE_MANAGER', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .get(`/api/contamination/${createdIncidentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', createdIncidentId);
  });
});

// ─── PUT /api/contamination/:id ──────────────────────────────────
describe('PUT /api/contamination/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).put(`/api/contamination/${FAKE_UUID}`).send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 for FINANCE_MANAGER (not in SORTING_ROLES)', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .put(`/api/contamination/${createdIncidentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent incident', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/contamination/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates description and notes and writes audit log', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/contamination/${createdIncidentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated: heavy plastic contamination confirmed', notes: 'Reviewed by QC' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Updated: heavy plastic contamination confirmed');
    expect(res.body.data.notes).toBe('Reviewed by QC');

    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'ContaminationIncident', entity_id: createdIncidentId, action: 'UPDATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('recalculates fee when contamination_weight_kg changes', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/contamination/${createdIncidentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ contamination_weight_kg: 12.0 });

    expect(res.status).toBe(200);
    // fee_amount should be present (FIXED fee = 75)
    expect(res.body.data).toHaveProperty('fee_amount');
  });
});
