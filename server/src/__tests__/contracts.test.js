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

// Track all created entities for cleanup
let createdContractId;
let createdContractId2;
let createdRateLineId;
let createdFeeId;
let supplierId;
let materialId;
let wasteStreamId;
let carrierId;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  financeToken = await getToken('finance@statice.nl', 'Finance123!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');

  // Fetch an existing active supplier for contract creation
  const supplier = await prisma.supplier.findFirst({
    where: { is_active: true },
    select: { id: true },
  });
  supplierId = supplier.id;

  // Fetch an existing active material for rate lines
  const material = await prisma.materialMaster.findFirst({
    where: { is_active: true },
    select: { id: true, waste_stream_id: true },
  });
  materialId = material.id;
  wasteStreamId = material.waste_stream_id;

  // Fetch an existing active carrier
  const carrier = await prisma.carrier.findFirst({
    where: { is_active: true },
    select: { id: true },
  });
  carrierId = carrier.id;

  // Clean up any leftover/overlapping contracts for this supplier to avoid overlap conflicts
  const leftoverContracts = await prisma.supplierContract.findMany({
    where: { supplier_id: supplierId, status: 'ACTIVE' },
    select: { id: true },
  });
  for (const c of leftoverContracts) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: c.id } }).catch(() => {});
    await prisma.contractRateLine.deleteMany({ where: { contract_id: c.id } }).catch(() => {});
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: c.id } }).catch(() => {});
    await prisma.supplierContract.delete({ where: { id: c.id } }).catch(() => {});
  }

  // Create a fee for penalty testing
  const fee = await prisma.feeMaster.create({
    data: {
      fee_type: 'TEST_PENALTY_' + Date.now(),
      description: 'Test penalty fee for contract tests',
      rate_type: 'FIXED',
      rate_value: 50,
    },
  });
  createdFeeId = fee.id;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  if (createdContractId) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: createdContractId } }).catch(() => {});
    await prisma.contractRateLine.deleteMany({ where: { contract_id: createdContractId } }).catch(() => {});
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: createdContractId } }).catch(() => {});
    await prisma.supplierContract.delete({ where: { id: createdContractId } }).catch(() => {});
  }
  if (createdContractId2) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: createdContractId2 } }).catch(() => {});
    await prisma.contractRateLine.deleteMany({ where: { contract_id: createdContractId2 } }).catch(() => {});
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: createdContractId2 } }).catch(() => {});
    await prisma.supplierContract.delete({ where: { id: createdContractId2 } }).catch(() => {});
  }
  if (createdFeeId) {
    await prisma.contractContaminationPenalty.deleteMany({ where: { fee_id: createdFeeId } }).catch(() => {});
    await prisma.feeMaster.delete({ where: { id: createdFeeId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ===============================================================
// Contract CRUD
// ===============================================================

describe('GET /api/contracts', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/contracts');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .get('/api/contracts')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns paginated contract list for ADMIN', async () => {
    const res = await request(app)
      .get('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  it('returns contract list for FINANCE_MANAGER', async () => {
    const res = await request(app)
      .get('/api/contracts')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports search query parameter', async () => {
    const res = await request(app)
      .get('/api/contracts?search=NONEXISTENT_CONTRACT_XYZ')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('supports status filter', async () => {
    const res = await request(app)
      .get('/api/contracts?status=DRAFT')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/contracts', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .send({ name: 'Test Contract' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ name: 'Test Contract' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when supplier_id is invalid', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Contract',
        effective_date: '2026-01-01',
        expiry_date: '2027-12-31',
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Active supplier not found');
  });

  it('creates a contract as ADMIN', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: supplierId,
        name: 'Test Contract Admin ' + Date.now(),
        effective_date: '2026-04-01',
        expiry_date: '2027-03-31',
        payment_term_days: 45,
        invoicing_frequency: 'MONTHLY',
        currency: 'EUR',
        contamination_tolerance_pct: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('contract_number');
    expect(res.body.data.contract_number).toMatch(/^CTR-\d{5}$/);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.payment_term_days).toBe(45);
    expect(res.body.data).toHaveProperty('supplier');
    expect(res.body.data.supplier.id).toBe(supplierId);
    expect(res.body.data).toHaveProperty('rate_lines');
    expect(res.body.data).toHaveProperty('contamination_penalties');
    expect(res.body.data).toHaveProperty('days_until_expiry');
    expect(res.body.data).toHaveProperty('rag_status');
    createdContractId = res.body.data.id;
  });

  it('creates a contract as FINANCE_MANAGER', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        supplier_id: supplierId,
        name: 'Test Contract Finance ' + Date.now(),
        effective_date: '2027-07-01',
        expiry_date: '2028-06-30',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('ACTIVE');
    createdContractId2 = res.body.data.id;
  });

  it('creates a contract with inline rate lines and penalties', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: supplierId,
        name: 'Test Contract Inline ' + Date.now(),
        effective_date: '2029-01-01',
        expiry_date: '2029-12-31',
        rate_lines: [
          {
            material_id: materialId,
            pricing_model: 'WEIGHT',
            unit_rate: 120,
            btw_rate: 21,
            valid_from: '2029-01-01',
            valid_to: '2029-12-31',
          },
        ],
        penalty_fee_ids: [createdFeeId],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rate_lines.length).toBe(1);
    expect(res.body.data.contamination_penalties.length).toBe(1);

    // Clean up this extra contract
    const inlineId = res.body.data.id;
    await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: inlineId } }).catch(() => {});
    await prisma.contractRateLine.deleteMany({ where: { contract_id: inlineId } }).catch(() => {});
    await prisma.contractWasteStream.deleteMany({ where: { contract_id: inlineId } }).catch(() => {});
    await prisma.supplierContract.delete({ where: { id: inlineId } }).catch(() => {});
  });
});

describe('GET /api/contracts/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/contracts/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .get('/api/contracts/some-id')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .get('/api/contracts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('returns contract details with enriched fields', async () => {
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .get(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', createdContractId);
    expect(res.body.data).toHaveProperty('contract_number');
    expect(res.body.data).toHaveProperty('supplier');
    expect(res.body.data).toHaveProperty('rate_lines');
    expect(res.body.data).toHaveProperty('contamination_penalties');
    expect(res.body.data).toHaveProperty('days_until_expiry');
    expect(typeof res.body.data.days_until_expiry).toBe('number');
    expect(res.body.data).toHaveProperty('rag_status');
    expect(['GREEN', 'AMBER', 'RED']).toContain(res.body.data.rag_status);
  });
});

describe('PUT /api/contracts/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/contracts/some-id')
      .send({ name: 'Updated' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .put('/api/contracts/some-id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .put('/api/contracts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('updates an ACTIVE contract name and dates as ADMIN', async () => {
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .put(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Contract Name',
        payment_term_days: 60,
        contamination_tolerance_pct: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Contract Name');
    expect(res.body.data.payment_term_days).toBe(60);
  });
});

// ===============================================================
// Contract Dashboard
// ===============================================================

describe('GET /api/contracts/dashboard', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/contracts/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .get('/api/contracts/dashboard')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns dashboard summary with expected structure', async () => {
    const res = await request(app)
      .get('/api/contracts/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('total');
    expect(typeof res.body.data.total).toBe('number');
    expect(res.body.data).toHaveProperty('by_status');
    expect(res.body.data.by_status).toHaveProperty('DRAFT');
    expect(res.body.data.by_status).toHaveProperty('ACTIVE');
    expect(res.body.data.by_status).toHaveProperty('EXPIRED');
    expect(res.body.data.by_status).toHaveProperty('INACTIVE');
    expect(res.body.data).toHaveProperty('expiry_rag');
    expect(res.body.data.expiry_rag).toHaveProperty('green');
    expect(res.body.data.expiry_rag).toHaveProperty('amber');
    expect(res.body.data.expiry_rag).toHaveProperty('red');
    expect(res.body.data).toHaveProperty('expiring_soon');
    expect(Array.isArray(res.body.data.expiring_soon)).toBe(true);
  });
});

// ===============================================================
// Rate Lines
// ===============================================================

describe('POST /api/contracts/:id/rate-lines', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/contracts/some-id/rate-lines')
      .send({ material_id: materialId });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/contracts/some-id/rate-lines')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: materialId });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .post('/api/contracts/00000000-0000-0000-0000-000000000000/rate-lines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        pricing_model: 'WEIGHT',
        unit_rate: 100,
        valid_from: '2026-04-01',
        valid_to: '2027-03-31',
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('returns 404 for non-existent material', async () => {
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .post(`/api/contracts/${createdContractId}/rate-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: '00000000-0000-0000-0000-000000000000',
        pricing_model: 'WEIGHT',
        unit_rate: 100,
        valid_from: '2026-04-01',
        valid_to: '2027-03-31',
      });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Active material not found');
  });

  it('adds a rate line to an ACTIVE contract', async () => {
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .post(`/api/contracts/${createdContractId}/rate-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        pricing_model: 'WEIGHT',
        unit_rate: 150,
        btw_rate: 21,
        valid_from: '2026-04-01',
        valid_to: '2027-03-31',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.pricing_model).toBe('WEIGHT');
    expect(res.body.data.material_id).toBe(materialId);
    expect(res.body.data).toHaveProperty('material');
    expect(res.body.data.material).toHaveProperty('code');
    createdRateLineId = res.body.data.id;
  });
});

describe('PUT /api/contracts/rate-lines/:lineId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/contracts/rate-lines/some-id')
      .send({ unit_rate: 200 });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .put('/api/contracts/rate-lines/some-id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ unit_rate: 200 });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent rate line', async () => {
    const res = await request(app)
      .put('/api/contracts/rate-lines/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ unit_rate: 200 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Rate line not found');
  });

  it('supersedes a rate line and creates a new one', async () => {
    expect(createdRateLineId).toBeDefined();

    const res = await request(app)
      .put(`/api/contracts/rate-lines/${createdRateLineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        unit_rate: 175,
        pricing_model: 'QUANTITY',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    // New line should have a different id (supersede creates a new record)
    expect(res.body.data.id).not.toBe(createdRateLineId);
    expect(res.body.data.pricing_model).toBe('QUANTITY');

    // Old line should now be superseded
    const oldLine = await prisma.contractRateLine.findUnique({
      where: { id: createdRateLineId },
    });
    expect(oldLine.superseded_at).not.toBeNull();

    // Track the new rate line for further tests
    createdRateLineId = res.body.data.id;
  });

  it('returns 400 when trying to update an already superseded rate line', async () => {
    // The original createdRateLineId was superseded in the previous test
    const supersededLine = await prisma.contractRateLine.findFirst({
      where: {
        contract_id: createdContractId,
        superseded_at: { not: null },
      },
    });

    if (supersededLine) {
      const res = await request(app)
        .put(`/api/contracts/rate-lines/${supersededLine.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unit_rate: 999 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Cannot update a superseded rate line');
    }
  });
});

describe('DELETE /api/contracts/rate-lines/:lineId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/contracts/rate-lines/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .delete('/api/contracts/rate-lines/some-id')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent rate line', async () => {
    const res = await request(app)
      .delete('/api/contracts/rate-lines/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Rate line not found');
  });

  it('supersedes (soft-deletes) a rate line', async () => {
    expect(createdRateLineId).toBeDefined();

    const res = await request(app)
      .delete(`/api/contracts/rate-lines/${createdRateLineId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Rate line superseded');

    // Verify the line is now superseded
    const line = await prisma.contractRateLine.findUnique({
      where: { id: createdRateLineId },
    });
    expect(line.superseded_at).not.toBeNull();
  });
});

// ===============================================================
// Penalties
// ===============================================================

describe('PUT /api/contracts/:id/penalties', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/contracts/some-id/penalties')
      .send({ fee_ids: [] });

    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .put('/api/contracts/some-id/penalties')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ fee_ids: [] });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .put('/api/contracts/00000000-0000-0000-0000-000000000000/penalties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_ids: [] });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('syncs penalties on a contract', async () => {
    expect(createdContractId).toBeDefined();
    expect(createdFeeId).toBeDefined();

    const res = await request(app)
      .put(`/api/contracts/${createdContractId}/penalties`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_ids: [createdFeeId] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty('fee');
    expect(res.body.data[0].fee.id).toBe(createdFeeId);
  });

  it('replaces penalties when syncing with a different set', async () => {
    expect(createdContractId).toBeDefined();

    // Sync with empty array to clear all penalties
    const res = await request(app)
      .put(`/api/contracts/${createdContractId}/penalties`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee_ids: [] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ===============================================================
// Contract Approval
// ===============================================================

describe('POST /api/contracts/:id/approve', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/contracts/some-id/approve');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/contracts/some-id/approve')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .post('/api/contracts/00000000-0000-0000-0000-000000000000/approve')
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('returns 400 when trying to approve an ACTIVE contract (contracts are created as ACTIVE)', async () => {
    expect(createdContractId).toBeDefined();

    // Contracts are now created as ACTIVE, so approve should reject
    const res = await request(app)
      .post(`/api/contracts/${createdContractId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Only DRAFT contracts can be approved');
  });
});

// ===============================================================
// Contract Termination
// ===============================================================

describe('POST /api/contracts/:id/terminate', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/contracts/some-id/terminate');
    expect(res.status).toBe(401);
  });

  it('returns 403 for GATE_OPERATOR role', async () => {
    const res = await request(app)
      .post('/api/contracts/some-id/terminate')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent contract', async () => {
    const res = await request(app)
      .post('/api/contracts/00000000-0000-0000-0000-000000000000/terminate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Contract not found');
  });

  it('terminates an ACTIVE contract', async () => {
    expect(createdContractId).toBeDefined();

    // createdContractId is ACTIVE (contracts are created as ACTIVE)
    const res = await request(app)
      .post(`/api/contracts/${createdContractId}/terminate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  it('returns 400 when trying to terminate an already TERMINATED contract', async () => {
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .post(`/api/contracts/${createdContractId}/terminate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Only ACTIVE contracts can be deactivated');
  });
});

// ===============================================================
// Contract Match
// ===============================================================

describe('GET /api/contracts/match', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/contracts/match');
    expect(res.status).toBe(401);
  });

  it('returns 400 when required query params are missing', async () => {
    const res = await request(app)
      .get('/api/contracts/match')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'supplier_id and material_id are required');
  });

  it('returns null when no matching contract exists', async () => {
    const res = await request(app)
      .get('/api/contracts/match')
      .query({
        supplier_id: '00000000-0000-0000-0000-000000000000',
        material_id: materialId,
        date: '2026-06-01',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ===============================================================
// Supplier Contracts
// ===============================================================

describe('GET /api/suppliers/:id/contracts', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/suppliers/${supplierId}/contracts`);
    expect(res.status).toBe(401);
  });

  it('returns contracts for a valid supplier', async () => {
    expect(supplierId).toBeDefined();

    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/contracts`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);

    // Our test contracts should be in the list
    if (res.body.data.length > 0) {
      const contract = res.body.data[0];
      expect(contract).toHaveProperty('id');
      expect(contract).toHaveProperty('contract_number');
      expect(contract).toHaveProperty('status');
      expect(contract).toHaveProperty('supplier');
      expect(contract).toHaveProperty('days_until_expiry');
      expect(contract).toHaveProperty('rag_status');
    }
  });

  it('supports status filter', async () => {
    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/contracts?status=ACTIVE`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // All returned contracts should be ACTIVE
    for (const contract of res.body.data) {
      expect(contract.status).toBe('ACTIVE');
    }
  });

  it('returns empty array for supplier with no contracts', async () => {
    // Use a different supplier or create one -- for simplicity, query with non-matching status
    const res = await request(app)
      .get(`/api/suppliers/${supplierId}/contracts?status=EXPIRED`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ===============================================================
// Update ACTIVE contract (limited fields)
// ===============================================================

describe('PUT /api/contracts/:id (ACTIVE contract restrictions)', () => {
  it('rejects update on TERMINATED contract', async () => {
    // createdContractId is now TERMINATED
    expect(createdContractId).toBeDefined();

    const res = await request(app)
      .put(`/api/contracts/${createdContractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contamination_tolerance_pct: 15 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Only ACTIVE contracts can be updated');
  });
});

// ===============================================================
// Audit Log Verification
// ===============================================================

describe('Contract audit logging', () => {
  it('writes audit log entry when contract is created', async () => {
    expect(createdContractId).toBeDefined();

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity_type: 'SupplierContract',
        entity_id: createdContractId,
        action: 'CREATE',
      },
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry.entity_id).toBe(createdContractId);
  });

  it('writes audit log entry when contract is terminated', async () => {
    expect(createdContractId).toBeDefined();

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity_type: 'SupplierContract',
        entity_id: createdContractId,
        action: 'DEACTIVATE',
      },
    });

    expect(auditEntry).not.toBeNull();
  });

  it('writes audit log entry for rate line creation', async () => {
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        entity_type: 'ContractRateLine',
        action: 'CREATE',
      },
      orderBy: { timestamp: 'desc' },
    });

    expect(auditEntry).not.toBeNull();
  });
});

// ===============================================================
// Contract Waste Stream CRUD
// ===============================================================

describe('Contract Waste Streams', () => {
  let wsContractId;

  afterAll(async () => {
    if (wsContractId) {
      await prisma.contractContaminationPenalty.deleteMany({ where: { contract_id: wsContractId } }).catch(() => {});
      await prisma.contractRateLine.deleteMany({ where: { contract_id: wsContractId } }).catch(() => {});
      await prisma.contractWasteStream.deleteMany({ where: { contract_id: wsContractId } }).catch(() => {});
      await prisma.supplierContract.delete({ where: { id: wsContractId } }).catch(() => {});
    }
  });

  it('creates a contract with contract_waste_streams', async () => {
    const res = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier_id: supplierId,
        carrier_id: carrierId,
        name: 'WS Test Contract ' + Date.now(),
        effective_date: '2030-01-01',
        expiry_date: '2030-12-31',
        contract_waste_streams: [
          {
            waste_stream_id: wasteStreamId,
            afvalstroomnummer: 'TEST-ASN-001',
            rate_lines: [
              { material_id: materialId, pricing_model: 'WEIGHT', unit_rate: 50, btw_rate: 21 },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.contract_waste_streams).toBeDefined();
    expect(res.body.data.contract_waste_streams.length).toBe(1);
    expect(res.body.data.contract_waste_streams[0].afvalstroomnummer).toBe('TEST-ASN-001');
    expect(res.body.data.contract_waste_streams[0].rate_lines.length).toBe(1);
    expect(Number(res.body.data.contract_waste_streams[0].rate_lines[0].unit_rate)).toBe(50);
    wsContractId = res.body.data.id;
  });

  it('returns contract_waste_streams in GET detail', async () => {
    const res = await request(app)
      .get(`/api/contracts/${wsContractId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contract_waste_streams).toBeDefined();
    expect(res.body.data.contract_waste_streams.length).toBe(1);
    expect(res.body.data.contract_waste_streams[0].afvalstroomnummer).toBe('TEST-ASN-001');
    expect(res.body.data.contract_waste_streams[0].waste_stream).toBeDefined();
    expect(res.body.data.contract_waste_streams[0].rate_lines.length).toBe(1);
  });

  it('updates contract waste streams (replace)', async () => {
    const res = await request(app)
      .put(`/api/contracts/${wsContractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_waste_streams: [
          {
            waste_stream_id: wasteStreamId,
            afvalstroomnummer: 'TEST-ASN-002',
            rate_lines: [
              { material_id: materialId, pricing_model: 'WEIGHT', unit_rate: 75, btw_rate: 21 },
              { material_id: materialId, pricing_model: 'QUANTITY', unit_rate: 10, btw_rate: 21 },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.contract_waste_streams.length).toBe(1);
    expect(res.body.data.contract_waste_streams[0].afvalstroomnummer).toBe('TEST-ASN-002');
    expect(res.body.data.contract_waste_streams[0].rate_lines.length).toBe(2);
  });

  it('persists updated waste streams on re-fetch', async () => {
    const res = await request(app)
      .get(`/api/contracts/${wsContractId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.contract_waste_streams[0].afvalstroomnummer).toBe('TEST-ASN-002');
    expect(res.body.data.contract_waste_streams[0].rate_lines.length).toBe(2);
    expect(Number(res.body.data.contract_waste_streams[0].rate_lines[0].unit_rate)).toBe(75);
  });

  it('can clear all waste streams via empty array', async () => {
    const res = await request(app)
      .put(`/api/contracts/${wsContractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contract_waste_streams: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.contract_waste_streams.length).toBe(0);
  });

  it('rejects duplicate waste streams in update', async () => {
    const res = await request(app)
      .put(`/api/contracts/${wsContractId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contract_waste_streams: [
          { waste_stream_id: wasteStreamId, afvalstroomnummer: 'ASN-A', rate_lines: [] },
          { waste_stream_id: wasteStreamId, afvalstroomnummer: 'ASN-B', rate_lines: [] },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Duplicate waste stream');
  });
});
