const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken;
}

// ─── Test state ────────────────────────────────────────────────
let createdInvoiceId;
let createdLineId;
let createdOrderId;
let createdSupplierId;
let createdContractId;
let adminUserId;
let carrierId;
let wasteStreamId;

beforeAll(async () => {
  const ts = Date.now();
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@statice.nl' }, select: { id: true } });
  adminUserId = adminUser.id;
  const carrier = await prisma.carrier.findFirst({ select: { id: true } });
  carrierId = carrier.id;
  const ws = await prisma.wasteStream.findFirst({ select: { id: true } });
  wasteStreamId = ws.id;

  // Create an isolated test supplier + contract so contracts.test.js cleanup can't affect us
  const supplier = await prisma.supplier.create({
    data: {
      name: `TestInvoice B.V. ${ts}`,
      supplier_type: 'THIRD_PARTY',
      kvk_number: String(ts + 1).slice(-8),
      contact_name: 'Invoice Test',
      contact_email: `invoice-test-${ts}@statice.test`,
      is_active: true,
    },
  });
  createdSupplierId = supplier.id;

  const contract = await prisma.supplierContract.create({
    data: {
      contract_number: `TST-CONTRACT-INV-${ts}`,
      name: `Test Invoice Contract ${ts}`,
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
    },
  });
  createdContractId = contract.id;

  // Create a completed inbound order for validation tests
  const order = await prisma.inboundOrder.create({
    data: {
      order_number: `TST-INV-${ts}`,
      supplier_id: createdSupplierId,
      carrier_id: carrierId,
      waste_stream_id: wasteStreamId,
      planned_date: new Date('2026-06-01'),
      status: 'COMPLETED',
      created_by: adminUserId,
    },
  });
  createdOrderId = order.id;

  // Create a minimal DRAFT invoice directly for CRUD tests
  const invoice = await prisma.invoice.create({
    data: {
      invoice_number: `TEST-INV-${ts}`,
      status: 'DRAFT',
      supplier_id: createdSupplierId,
      contract_id: createdContractId,
      invoice_date: new Date('2026-06-01'),
      due_date: new Date('2026-07-01'),
      currency: 'EUR',
      subtotal: 0,
      btw_total: 0,
      total_amount: 0,
      recipient_name: 'TestInvoice B.V.',
      created_by: adminUserId,
    },
  });
  createdInvoiceId = invoice.id;
});

afterAll(async () => {
  // Clean up in reverse dependency order
  if (createdInvoiceId) {
    await prisma.invoiceLine.deleteMany({ where: { invoice_id: createdInvoiceId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entity_type: 'Invoice', entity_id: createdInvoiceId } }).catch(() => {});
    await prisma.invoice.delete({ where: { id: createdInvoiceId } }).catch(() => {});
  }
  if (createdOrderId) {
    await prisma.inbound.deleteMany({ where: { order_id: createdOrderId } }).catch(() => {});
    await prisma.inboundOrder.delete({ where: { id: createdOrderId } }).catch(() => {});
  }
  if (createdContractId) {
    await prisma.supplierContract.delete({ where: { id: createdContractId } }).catch(() => {});
  }
  if (createdSupplierId) {
    await prisma.supplier.delete({ where: { id: createdSupplierId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ─── GET /api/invoices ────────────────────────────────────────
describe('GET /api/invoices', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE (not in FINANCE_ROLES)', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for GATE_OPERATOR', async () => {
    const token = await getToken('gate@statice.nl', 'Gate1234!');
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns invoice list for ADMIN', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  it('returns invoice list for FINANCE_MANAGER', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by status=DRAFT', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/invoices?status=DRAFT')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const inv of res.body.data) {
      expect(inv.status).toBe('DRAFT');
    }
  });

  it('respects page and limit params', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get('/api/invoices?page=1&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
  });
});

// ─── GET /api/invoices/:id ────────────────────────────────────
describe('GET /api/invoices/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/invoices/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent invoice', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get(`/api/invoices/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns invoice with supplier, contract, and lines', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .get(`/api/invoices/${createdInvoiceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', createdInvoiceId);
    expect(res.body.data).toHaveProperty('invoice_number');
    expect(res.body.data).toHaveProperty('status', 'DRAFT');
    expect(res.body.data).toHaveProperty('supplier');
    expect(res.body.data).toHaveProperty('contract');
    expect(Array.isArray(res.body.data.lines)).toBe(true);
  });
});

// ─── GET /api/invoices/completed-orders/:supplierId ──────────
describe('GET /api/invoices/completed-orders/:supplierId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/invoices/completed-orders/${createdSupplierId}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .get(`/api/invoices/completed-orders/${createdSupplierId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns completed orders for FINANCE_MANAGER', async () => {
    const token = await getToken('finance@statice.nl', 'Finance123!');
    const res = await request(app)
      .get(`/api/invoices/completed-orders/${createdSupplierId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── POST /api/invoices (validation errors) ──────────────────
describe('POST /api/invoices (validation)', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/invoices').send({ order_ids: [] });
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_ids: [FAKE_UUID] });
    expect(res.status).toBe(403);
  });

  it('returns 400 for empty order_ids', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for non-completed order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    // Create a PLANNED order that cannot be invoiced
    const plannedOrder = await prisma.inboundOrder.create({
      data: {
        order_number: `TST-PLAN-${Date.now()}`,
        supplier_id: createdSupplierId,
        carrier_id: carrierId,
        waste_stream_id: wasteStreamId,
        planned_date: new Date('2026-07-01'),
        status: 'PLANNED',
        created_by: adminUserId,
      },
    });

    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_ids: [plannedOrder.id] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');

    // cleanup
    await prisma.inboundOrder.delete({ where: { id: plannedOrder.id } }).catch(() => {});
  });

  it('returns 404 for non-existent order', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ order_ids: [FAKE_UUID] });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── POST /api/invoices/:id/lines ────────────────────────────
describe('POST /api/invoices/:id/lines', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/invoices/${createdInvoiceId}/lines`).send({});
    expect(res.status).toBe(401);
  });

  it('returns 403 for SORTING_EMPLOYEE', async () => {
    const token = await getToken('sorting@statice.nl', 'Sorting123!');
    const res = await request(app)
      .post(`/api/invoices/${createdInvoiceId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Test line', quantity: 1, unit_rate: 10 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent invoice', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post(`/api/invoices/${FAKE_UUID}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Test', quantity: 1, unit_rate: 10 });
    expect(res.status).toBe(404);
  });

  it('adds a line to a DRAFT invoice and writes audit log', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post(`/api/invoices/${createdInvoiceId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'WEEE verwerking — batch Q2-2026',
        quantity: 500,
        unit: 'kg',
        unit_rate: 0.18,
        btw_rate: 21,
        line_type: 'material',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.lines).toHaveLength(1);
    expect(Number(res.body.data.subtotal)).toBeCloseTo(90);
    expect(Number(res.body.data.btw_total)).toBeCloseTo(18.9);
    expect(Number(res.body.data.total_amount)).toBeCloseTo(108.9);

    createdLineId = res.body.data.lines[0].id;

    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'Invoice', entity_id: createdInvoiceId, action: 'ADD_LINE' },
    });
    expect(audit).not.toBeNull();
  });
});

// ─── PUT /api/invoices/lines/:lineId ─────────────────────────
describe('PUT /api/invoices/lines/:lineId', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).put(`/api/invoices/lines/${FAKE_UUID}`).send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent line', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/invoices/lines/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 10 });
    expect(res.status).toBe(404);
  });

  it('updates line quantity and recalculates totals', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/invoices/lines/${createdLineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1000, unit_rate: 0.18 });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.subtotal)).toBeCloseTo(180);

    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'Invoice', entity_id: createdInvoiceId, action: 'UPDATE_LINE' },
    });
    expect(audit).not.toBeNull();
  });
});

// ─── PUT /api/invoices/:id/status ────────────────────────────
describe('PUT /api/invoices/:id/status', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).put(`/api/invoices/${createdInvoiceId}/status`).send({ status: 'FINALIZED' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent invoice', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/invoices/${FAKE_UUID}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'FINALIZED' });
    expect(res.status).toBe(404);
  });

  it('transitions DRAFT → FINALIZED and writes audit log', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .put(`/api/invoices/${createdInvoiceId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'FINALIZED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FINALIZED');

    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'Invoice', entity_id: createdInvoiceId, action: 'STATUS_CHANGE' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects adding lines to a FINALIZED invoice', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .post(`/api/invoices/${createdInvoiceId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Late addition', quantity: 1, unit_rate: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── DELETE /api/invoices/lines/:lineId ──────────────────────
describe('DELETE /api/invoices/lines/:lineId', () => {
  let draftInvoiceId2;
  let lineToDeleteId;

  beforeAll(async () => {
    // Create a fresh DRAFT invoice for delete tests
    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@statice.nl' }, select: { id: true } });
    const inv = await prisma.invoice.create({
      data: {
        invoice_number: `TEST-DEL-${Date.now()}`,
        status: 'DRAFT',
        supplier_id: createdSupplierId,
        contract_id: createdContractId,
        invoice_date: new Date('2026-06-01'),
        due_date: new Date('2026-07-01'),
        currency: 'EUR',
        subtotal: 0,
        btw_total: 0,
        total_amount: 0,
        recipient_name: 'Stichting OPEN Demo',
        created_by: adminUser?.id,
      },
    });
    draftInvoiceId2 = inv.id;

    // Add a line to delete
    const line = await prisma.invoiceLine.create({
      data: {
        invoice_id: inv.id,
        description: 'Line to be deleted',
        line_type: 'material',
        quantity: 10,
        unit: 'kg',
        unit_rate: 5,
        btw_rate: 0,
        line_subtotal: 50,
        btw_amount: 0,
        line_total: 50,
        sort_order: 0,
      },
    });
    lineToDeleteId = line.id;
  });

  afterAll(async () => {
    if (draftInvoiceId2) {
      await prisma.invoiceLine.deleteMany({ where: { invoice_id: draftInvoiceId2 } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { entity_type: 'Invoice', entity_id: draftInvoiceId2 } }).catch(() => {});
      await prisma.invoice.delete({ where: { id: draftInvoiceId2 } }).catch(() => {});
    }
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/invoices/lines/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent line', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .delete(`/api/invoices/lines/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('deletes a line and recalculates invoice totals', async () => {
    const token = await getToken('admin@statice.nl', 'Admin1234!');
    const res = await request(app)
      .delete(`/api/invoices/lines/${lineToDeleteId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lines).toHaveLength(0);
    expect(Number(res.body.data.total_amount)).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'Invoice', entity_id: draftInvoiceId2, action: 'DELETE_LINE' },
    });
    expect(audit).not.toBeNull();
  });
});
