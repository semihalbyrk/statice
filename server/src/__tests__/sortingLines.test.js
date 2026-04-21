const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// ─── Test state ────────────────────────────────────────────────
let adminToken;
let sortingToken;
let plannerToken;

let testOrderId;
let testInboundId;
let testAssetId;
let testSessionId;
let testCategoryId;
let createdLineIds = [];
let wasteStreamId;

// Track all resources for cleanup
const createdOrderIds = [];
const createdInboundIds = [];

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  sortingToken = await getToken('sorting@statice.nl', 'Sorting123!');
  plannerToken = await getToken('planner@statice.nl', 'Planner123!');

  // Look up required reference data
  const ws = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
  wasteStreamId = ws.id;

  const category = await prisma.productCategory.findFirst();
  testCategoryId = category.id;

  // Create an order
  const orderRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      carrier_id: 'carrier-van-happen',
      supplier_id: 'supplier-techrecycle',
      waste_stream_ids: [wasteStreamId],
      planned_date: new Date().toISOString().split('T')[0],
      vehicle_plate: 'NL-SL-88',
      notes: 'Sorteerlijnen testorder vanuit Almere',
    });
  testOrderId = orderRes.body.id;
  createdOrderIds.push(testOrderId);

  // Create inbound (weighing event)
  const inboundRes = await request(app)
    .post('/api/inbounds')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ order_id: testOrderId, registration_plate: 'NL-SL-88' });
  testInboundId = inboundRes.body.data.id;
  createdInboundIds.push(testInboundId);

  // W1 (gross) — manual
  await request(app)
    .post(`/api/inbounds/${testInboundId}/weighing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ is_manual: true, manual_weight_kg: 5000, manual_reason: 'Testweging bruto' });

  // Register parcel (creates asset)
  await request(app)
    .post(`/api/inbounds/${testInboundId}/parcels`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ parcel_type: 'MATERIAL', waste_stream_id: wasteStreamId });

  // W2 (tare) — manual
  await request(app)
    .post(`/api/inbounds/${testInboundId}/weighing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ is_manual: true, manual_weight_kg: 1500, manual_reason: 'Testweging tarra' });

  // Get the asset that was created
  const assets = await prisma.asset.findMany({ where: { inbound_id: testInboundId } });
  testAssetId = assets[0].id;

  // Transition inbound to READY_FOR_SORTING (this auto-creates a SortingSession)
  const statusRes = await request(app)
    .patch(`/api/inbounds/${testInboundId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'READY_FOR_SORTING' });
  expect(statusRes.status).toBe(200);

  // Look up the sorting session created for this inbound
  const session = await prisma.sortingSession.findUnique({ where: { inbound_id: testInboundId } });
  testSessionId = session.id;
});

afterAll(async () => {
  // Clean up sorting lines
  for (const lineId of createdLineIds) {
    await prisma.sortingLine.delete({ where: { id: lineId } }).catch(() => {});
  }
  // Clean up audit logs for our test entities
  await prisma.auditLog.deleteMany({
    where: { entity_type: 'SortingLine', entity_id: { in: createdLineIds } },
  }).catch(() => {});

  // Clean up inbounds and their dependencies
  for (const inboundId of createdInboundIds) {
    const weighings = await prisma.inboundWeighing.findMany({
      where: { inbound_id: inboundId },
      select: { pfister_ticket_id: true },
    });
    const ticketIds = weighings.map((w) => w.pfister_ticket_id).filter(Boolean);

    await prisma.sortingLine.deleteMany({ where: { session: { inbound_id: inboundId } } }).catch(() => {});
    await prisma.sortingSession.deleteMany({ where: { inbound_id: inboundId } }).catch(() => {});
    await prisma.asset.deleteMany({ where: { inbound_id: inboundId } }).catch(() => {});
    await prisma.inboundWeighing.deleteMany({ where: { inbound_id: inboundId } }).catch(() => {});
    await prisma.inbound.updateMany({
      where: { id: inboundId },
      data: { gross_ticket_id: null, tare_ticket_id: null },
    }).catch(() => {});
    await prisma.inbound.deleteMany({ where: { id: inboundId } }).catch(() => {});
    if (ticketIds.length > 0) {
      await prisma.pfisterTicket.deleteMany({ where: { id: { in: ticketIds } } }).catch(() => {});
    }
  }

  for (const orderId of createdOrderIds) {
    await prisma.orderWasteStream.deleteMany({ where: { order_id: orderId } }).catch(() => {});
    await prisma.inboundOrder.delete({ where: { id: orderId } }).catch(() => {});
  }

  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// POST /api/sorting/:sessionId/lines — create sorting line
// ---------------------------------------------------------------------------
describe('POST /api/sorting/:sessionId/lines', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 1000,
        recycled_pct: 60,
        reused_pct: 30,
        disposed_pct: 10,
      });
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 800,
        recycled_pct: 50,
        reused_pct: 40,
        disposed_pct: 10,
      });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Insufficient permissions');
  });

  it('returns 422 when recovery rates do not sum to 100', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 500,
        recycled_pct: 40,
        reused_pct: 40,
        disposed_pct: 40,
      });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
    expect(res.body.received_sum).toBe(120);
  });

  it('returns 422 when only partial pct fields sent', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 500,
        recycled_pct: 60,
        // missing reused_pct and disposed_pct
      });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('missing_fields');
  });

  it('returns 404 for non-existent session', async () => {
    const res = await request(app)
      .post(`/api/sorting/${FAKE_UUID}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 1000,
        recycled_pct: 60,
        reused_pct: 30,
        disposed_pct: 10,
      });
    // validateSessionDraft middleware returns 404
    expect(res.status).toBe(404);
  });

  it('returns 400 when asset does not belong to the inbound', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: FAKE_UUID,
        category_id: testCategoryId,
        net_weight_kg: 500,
        recycled_pct: 50,
        reused_pct: 30,
        disposed_pct: 20,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not belong/i);
  });

  it('creates a sorting line as SORTING_EMPLOYEE and writes audit log', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 1200,
        recycled_pct: 55,
        reused_pct: 35,
        disposed_pct: 10,
        notes: 'Koelkasten partij Almere-Buiten',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.session_id).toBe(testSessionId);
    expect(res.body.data.asset_id).toBe(testAssetId);
    expect(Number(res.body.data.net_weight_kg)).toBe(1200);
    expect(Number(res.body.data.recycled_pct)).toBe(55);
    expect(Number(res.body.data.reused_pct)).toBe(35);
    expect(Number(res.body.data.disposed_pct)).toBe(10);

    createdLineIds.push(res.body.data.id);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'SortingLine', entity_id: res.body.data.id, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
    expect(audit.user_id).toBeDefined();
  });

  it('creates a sorting line as ADMIN', async () => {
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 800,
        recycled_pct: 70,
        reused_pct: 20,
        disposed_pct: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    createdLineIds.push(res.body.data.id);
  });

  it('returns weight warning when allocated exceeds asset net', async () => {
    // Asset net is ~3500 (5000 - 1500). We already allocated 2000 (1200 + 800).
    // Adding 2000 more should exceed and return a warning.
    const res = await request(app)
      .post(`/api/sorting/${testSessionId}/lines`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        asset_id: testAssetId,
        category_id: testCategoryId,
        net_weight_kg: 2000,
        recycled_pct: 80,
        reused_pct: 10,
        disposed_pct: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('warning');
    expect(res.body.warning).toMatch(/exceeds/i);
    createdLineIds.push(res.body.data.id);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/sorting/:sessionId/lines/:lineId — update sorting line
// ---------------------------------------------------------------------------
describe('PUT /api/sorting/:sessionId/lines/:lineId', () => {
  it('returns 401 without auth token', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .send({ net_weight_kg: 500 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ net_weight_kg: 500, recycled_pct: 50, reused_pct: 30, disposed_pct: 20 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent line', async () => {
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ net_weight_kg: 500, recycled_pct: 50, reused_pct: 30, disposed_pct: 20 });
    expect(res.status).toBe(404);
  });

  it('updates line weight and percentages and writes audit log', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({
        net_weight_kg: 900,
        recycled_pct: 45,
        reused_pct: 40,
        disposed_pct: 15,
        notes: 'Gecorrigeerd na herweging',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Number(res.body.data.net_weight_kg)).toBe(900);
    expect(Number(res.body.data.recycled_pct)).toBe(45);
    expect(Number(res.body.data.reused_pct)).toBe(40);
    expect(Number(res.body.data.disposed_pct)).toBe(15);

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'SortingLine', entity_id: lineId, action: 'UPDATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('returns 422 when updated pcts do not sum to 100', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ recycled_pct: 90, reused_pct: 20, disposed_pct: 10 });
    expect(res.status).toBe(422);
    expect(res.body.received_sum).toBe(120);
  });

  it('allows partial update without pct fields', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .put(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${sortingToken}`)
      .send({ notes: 'Tweede correctie opmerking' });

    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Tweede correctie opmerking');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/sorting/:sessionId/lines/:lineId — delete sorting line
// ---------------------------------------------------------------------------
describe('DELETE /api/sorting/:sessionId/lines/:lineId', () => {
  it('returns 401 without auth token', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .delete(`/api/sorting/${testSessionId}/lines/${lineId}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for LOGISTICS_PLANNER role', async () => {
    const lineId = createdLineIds[0];
    const res = await request(app)
      .delete(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${plannerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent line', async () => {
    const res = await request(app)
      .delete(`/api/sorting/${testSessionId}/lines/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${sortingToken}`);
    expect(res.status).toBe(404);
  });

  it('deletes a sorting line and writes audit log', async () => {
    // Delete the last created line
    const lineId = createdLineIds[createdLineIds.length - 1];
    const res = await request(app)
      .delete(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${sortingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('message', 'Line deleted');

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { entity_type: 'SortingLine', entity_id: lineId, action: 'DELETE' },
    });
    expect(audit).not.toBeNull();

    // Verify line is actually gone
    const line = await prisma.sortingLine.findUnique({ where: { id: lineId } });
    expect(line).toBeNull();

    // Remove from tracking since it's deleted
    createdLineIds.pop();
  });

  it('deletes as ADMIN role', async () => {
    const lineId = createdLineIds[createdLineIds.length - 1];
    const res = await request(app)
      .delete(`/api/sorting/${testSessionId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    createdLineIds.pop();
  });
});
