const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

// Track IDs for cleanup
const createdParcelIds = [];
const createdOutboundOrderIds = [];

let adminToken;
let materialId;
let outgoingContract;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');

  // Get an active material (SDA / Small Household Appliances)
  const material = await prisma.materialMaster.findFirst({
    where: { is_active: true },
  });
  materialId = material.id;

  outgoingContract = await prisma.supplierContract.findFirst({
    where: { contract_number: 'O-Contract #1' },
    include: { contract_waste_streams: true },
  });
});

afterAll(async () => {
  // Clean up parcels
  if (createdParcelIds.length > 0) {
    await prisma.outboundParcel.deleteMany({
      where: { id: { in: createdParcelIds } },
    });
  }

  // Clean up outbound orders and their outbounds
  for (const orderId of createdOutboundOrderIds) {
    const outbounds = await prisma.outbound.findMany({
      where: { outbound_order_id: orderId },
      select: { id: true },
    });
    const ids = outbounds.map((o) => o.id);
    if (ids.length > 0) {
      // Detach parcels from these outbounds
      await prisma.outboundParcel.updateMany({
        where: { outbound_id: { in: ids } },
        data: { outbound_id: null, status: 'AVAILABLE' },
      });
      await prisma.outboundDocument.deleteMany({ where: { outbound_id: { in: ids } } });
      await prisma.outboundWeighingRecord.deleteMany({ where: { outbound_id: { in: ids } } });
      await prisma.outbound.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.outboundOrderWasteStream.deleteMany({ where: { outbound_order_id: orderId } });
  }
  await prisma.outboundOrder.deleteMany({
    where: { id: { in: createdOutboundOrderIds } },
  });

  // Final parcel cleanup (some may have been deleted during tests)
  if (createdParcelIds.length > 0) {
    await prisma.outboundParcel.deleteMany({
      where: { id: { in: createdParcelIds } },
    });
  }

  await prisma.$disconnect();
});

/** Helper: create an outbound order */
async function createTestOrder(overrides = {}) {
  const cws = outgoingContract.contract_waste_streams[0];
  const res = await request(app)
    .post('/api/outbound-orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      contract_id: outgoingContract.id,
      planned_date: '2026-06-01',
      expected_outbounds: overrides.expected_outbounds || 1,
      waste_streams: cws ? [{
        waste_stream_id: cws.waste_stream_id,
        receiver_id: outgoingContract.buyer_id,
        asn: cws.afvalstroomnummer,
      }] : [],
      ...overrides,
    });
  if (res.status === 201) {
    createdOutboundOrderIds.push(res.body.id);
  }
  return res;
}

/** Helper: create a test outbound */
async function createTestOutbound() {
  const orderRes = await createTestOrder();
  const outRes = await request(app)
    .post(`/api/outbounds/order/${orderRes.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ vehicle_plate: 'NL-OPR-01' });
  return outRes.body.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('Outbound Parcel CRUD', () => {
  it('creates an outbound parcel with OPR- label', async () => {
    const res = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'OPEN_TOP',
        volume_m3: 40,
        tare_weight_kg: 8500,
        description: 'SDA lot Oweb/SDA batch A',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.parcel_label).toMatch(/^OPR-/);
    expect(res.body.data.status).toBe('AVAILABLE');
    expect(res.body.data.material).toBeDefined();
    createdParcelIds.push(res.body.data.id);
  });

  it('lists parcels with pagination', async () => {
    const res = await request(app)
      .get('/api/outbound-parcels?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(typeof res.body.total).toBe('number');
  });

  it('gets parcel by ID with material and outbound detail', async () => {
    const parcelId = createdParcelIds[0];
    const res = await request(app)
      .get(`/api/outbound-parcels/${parcelId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(parcelId);
    expect(res.body.data.material).toBeDefined();
  });

  it('updates an AVAILABLE parcel', async () => {
    const parcelId = createdParcelIds[0];
    const res = await request(app)
      .put(`/api/outbound-parcels/${parcelId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ volume_m3: 30, notes: 'Updated volume for OPEN_TOP 30m³ lot' });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.volume_m3)).toBe(30);
  });

  it('rejects changing material_id', async () => {
    const parcelId = createdParcelIds[0];
    const otherMaterial = await prisma.materialMaster.findFirst({
      where: { id: { not: materialId }, is_active: true },
    });

    const res = await request(app)
      .put(`/api/outbound-parcels/${parcelId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ material_id: otherMaterial.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('material_id');
  });

  it('deletes an AVAILABLE parcel', async () => {
    // Create a parcel specifically for deletion
    const createRes = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'GITTERBOX',
        volume_m3: 1.5,
        description: 'Gitterbox PCB lot for deletion test',
      });
    const deleteId = createRes.body.data.id;
    createdParcelIds.push(deleteId);

    const res = await request(app)
      .delete(`/api/outbound-parcels/${deleteId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTACH / DETACH
// ─────────────────────────────────────────────────────────────────────────────

describe('Outbound Parcel Attach/Detach', () => {
  let outbound;
  let parcelA;
  let parcelB;

  beforeAll(async () => {
    outbound = await createTestOutbound();

    // Create two parcels
    const resA = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'OPEN_TOP',
        volume_m3: 40,
        tare_weight_kg: 9200,
        description: 'OPEN_TOP parcel 40m³ lot A',
      });
    parcelA = resA.body.data;
    createdParcelIds.push(parcelA.id);

    const resB = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'OPEN_TOP',
        volume_m3: 40,
        tare_weight_kg: 8800,
        description: 'OPEN_TOP parcel 40m³ lot B',
      });
    parcelB = resB.body.data;
    createdParcelIds.push(parcelB.id);
  });

  it('attaches AVAILABLE parcels to a CREATED outbound', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/parcels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelIds: [parcelA.id, parcelB.id] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].status).toBe('ASSIGNED');
  });

  it('rejects attaching already ASSIGNED parcels', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/parcels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelIds: [parcelA.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('AVAILABLE');
  });

  it('lists parcels by outbound', async () => {
    const res = await request(app)
      .get(`/api/outbounds/${outbound.id}/parcels`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('detaches a parcel — status returns to AVAILABLE', async () => {
    const res = await request(app)
      .delete(`/api/outbounds/${outbound.id}/parcels/${parcelB.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify parcel is back to AVAILABLE
    const check = await request(app)
      .get(`/api/outbound-parcels/${parcelB.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(check.body.data.status).toBe('AVAILABLE');
    expect(check.body.data.outbound_id).toBeNull();
  });

  it('cannot update a SHIPPED parcel', async () => {
    // Ship parcelA by setting status directly (simulating departure)
    await prisma.outboundParcel.update({
      where: { id: parcelA.id },
      data: { status: 'SHIPPED' },
    });

    const res = await request(app)
      .put(`/api/outbound-parcels/${parcelA.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Should not work' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('SHIPPED');

    // Reset for cleanup
    await prisma.outboundParcel.update({
      where: { id: parcelA.id },
      data: { status: 'AVAILABLE', outbound_id: null },
    });
  });

  it('cannot delete a non-AVAILABLE parcel', async () => {
    await prisma.outboundParcel.update({
      where: { id: parcelA.id },
      data: { status: 'SHIPPED' },
    });

    const res = await request(app)
      .delete(`/api/outbound-parcels/${parcelA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('AVAILABLE');

    // Reset for cleanup
    await prisma.outboundParcel.update({
      where: { id: parcelA.id },
      data: { status: 'AVAILABLE' },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTACH VALIDATES OUTBOUND STATUS
// ─────────────────────────────────────────────────────────────────────────────

describe('Attach validates outbound status', () => {
  it('rejects attach when outbound is WEIGHED', async () => {
    const outbound = await createTestOutbound();

    // Force outbound to WEIGHED
    await prisma.outbound.update({
      where: { id: outbound.id },
      data: { status: 'WEIGHED' },
    });

    const parcelRes = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'PALLET',
        volume_m3: 2,
        description: 'Pallet for status validation test',
      });
    createdParcelIds.push(parcelRes.body.data.id);

    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/parcels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelIds: [parcelRes.body.data.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('WEIGHED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTURE AUTO-SHIPS PARCELS
// ─────────────────────────────────────────────────────────────────────────────

describe('confirmDeparture bulk-transitions parcels to SHIPPED', () => {
  it('transitions ASSIGNED parcels to SHIPPED on departure', async () => {
    const outbound = await createTestOutbound();

    // Create and attach a parcel
    const parcelRes = await request(app)
      .post('/api/outbound-parcels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: materialId,
        container_type: 'CLOSED_TOP',
        volume_m3: 30,
        tare_weight_kg: 7500,
        description: 'CLOSED_TOP 30m³ for departure test',
      });
    const parcelId = parcelRes.body.data.id;
    createdParcelIds.push(parcelId);

    await request(app)
      .post(`/api/outbounds/${outbound.id}/parcels`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parcelIds: [parcelId] });

    // Drive outbound through the flow: CREATED → LOADING → WEIGHED → DOCUMENTS_READY → DEPARTED
    // Record tare
    await request(app)
      .post(`/api/outbounds/${outbound.id}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'TARE', source: 'MANUAL', weightKg: 12000 });

    // Record gross
    await request(app)
      .post(`/api/outbounds/${outbound.id}/weighings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ weighingType: 'GROSS', source: 'MANUAL', weightKg: 22000 });

    // Generate BGL
    await request(app)
      .post(`/api/outbounds/${outbound.id}/generate-bgl`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Confirm departure
    const departRes = await request(app)
      .patch(`/api/outbounds/${outbound.id}/depart`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(departRes.status).toBe(200);
    expect(departRes.body.data.status).toBe('DEPARTED');

    // Verify parcel is SHIPPED
    const parcelCheck = await request(app)
      .get(`/api/outbound-parcels/${parcelId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(parcelCheck.body.data.status).toBe('SHIPPED');
  });
});
