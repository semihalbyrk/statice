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
let gateToken;
let plannerToken;
let createdMaterialId;
let createdFractionId;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
  plannerToken = await getToken('planner@statice.nl', 'Planner123!');
});

afterAll(async () => {
  // Clean up test data
  if (createdFractionId) {
    await prisma.fractionMaster.delete({ where: { id: createdFractionId } }).catch(() => {});
  }
  if (createdMaterialId) {
    await prisma.materialMaster.delete({ where: { id: createdMaterialId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// --------------- Catalogue Entries (Fase 1) ---------------

const FASE1_SESSION = 'seed-session-005';
const FASE1_ASSET = 'seed-asset-005-a';

async function cleanupFase1Entries() {
  const entries = await prisma.assetCatalogueEntry.findMany({
    where: { session_id: FASE1_SESSION },
    select: { id: true },
  });
  const ids = entries.map((e) => e.id);
  if (ids.length > 0) {
    await prisma.reusableItem.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
    await prisma.processingOutcomeLine.deleteMany({ where: { processing_record: { catalogue_entry_id: { in: ids } } } });
    await prisma.processingRecord.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
    await prisma.assetCatalogueEntry.deleteMany({ where: { id: { in: ids } } });
  }
}

describe('POST /api/catalogue/sessions/:sessionId/assets/:assetId/entries', () => {
  beforeEach(async () => {
    await cleanupFase1Entries();
    // ensure mat-hdd has an avg weight configured (default seed may not set it)
    await prisma.materialMaster.update({ where: { id: 'mat-hdd' }, data: { average_weight_kg: 2.0 } });
    // ensure mat-pcb has no avg weight
    await prisma.materialMaster.update({ where: { id: 'mat-pcb' }, data: { average_weight_kg: null } });
  });

  afterAll(async () => {
    await cleanupFase1Entries();
  });

  it('does NOT auto-create a ProcessingRecord when a catalogue entry is created', async () => {
    const res = await request(app)
      .post(`/api/catalogue/sessions/${FASE1_SESSION}/assets/${FASE1_ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 10 });
    expect(res.status).toBe(201);

    const records = await prisma.processingRecord.findMany({
      where: { catalogue_entry_id: res.body.data.id },
    });
    expect(records).toHaveLength(0);
  });

  it('computes weight_kg from quantity × average_weight_kg for reusable entries', async () => {
    const res = await request(app)
      .post(`/api/catalogue/sessions/${FASE1_SESSION}/assets/${FASE1_ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({
        material_id: 'mat-hdd',
        reuse_eligible_quantity: 3,
        is_reusable: true,
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.weight_kg)).toBe(6.0);
    expect(res.body.data.reuse_eligible_quantity).toBe(3);
  });

  it('rejects reusable entry when material has no average_weight_kg', async () => {
    const res = await request(app)
      .post(`/api/catalogue/sessions/${FASE1_SESSION}/assets/${FASE1_ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({
        material_id: 'mat-pcb',
        reuse_eligible_quantity: 2,
        is_reusable: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/average_weight_kg/i);
  });

  it('accepts a manual weight_kg for non-reusable entries', async () => {
    const res = await request(app)
      .post(`/api/catalogue/sessions/${FASE1_SESSION}/assets/${FASE1_ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 12.5 });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.weight_kg)).toBe(12.5);
    expect(res.body.data.reuse_eligible_quantity).toBe(0);
  });
});

// --------------- Materials ---------------

describe('GET /api/catalogue/materials', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/catalogue/materials');
    expect(res.status).toBe(401);
  });

  it('returns materials list for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/catalogue/materials')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports search query parameter', async () => {
    const res = await request(app)
      .get('/api/catalogue/materials?search=NONEXISTENT_XYZ_999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('POST /api/catalogue/materials', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/catalogue/materials')
      .send({ code: 'TEST' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .post('/api/catalogue/materials')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code: 'TEST', name: 'Test Material' });
    expect(res.status).toBe(403);
  });

  it('creates a material as ADMIN', async () => {
    // Get a waste stream to link to
    const wsRes = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });

    const res = await request(app)
      .post('/api/catalogue/materials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'TEST-MAT-' + Date.now(),
        name: 'Test Material Integration',
        waste_stream_id: wsRes.id,
        cbs_code: 'TST-CBS',
        weeelabex_group: 'TST-WLX',
        eural_code: 'TST-EUR',
        weee_category: 'Cat 1',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Test Material Integration');
    createdMaterialId = res.body.data.id;
  });

  it('creates a material with average_weight_kg', async () => {
    const wsRes = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
    const res = await request(app)
      .post('/api/catalogue/materials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'MAT-AVG-' + Date.now(),
        name: 'Test Avg Material',
        waste_stream_id: wsRes.id,
        cbs_code: 'TST-CBS',
        weeelabex_group: 'TST-WLX',
        eural_code: 'TST-EUR',
        weee_category: 'Cat 1',
        average_weight_kg: 3.5,
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.average_weight_kg)).toBe(3.5);
  });

  it('rejects non-positive average_weight_kg', async () => {
    const wsRes = await prisma.wasteStream.findFirst({ where: { code: 'WEEE' } });
    const res = await request(app)
      .post('/api/catalogue/materials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'MAT-BAD-' + Date.now(),
        name: 'Bad Avg Material',
        waste_stream_id: wsRes.id,
        cbs_code: 'TST-CBS',
        weeelabex_group: 'TST-WLX',
        eural_code: 'TST-EUR',
        weee_category: 'Cat 1',
        average_weight_kg: -1,
      });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/catalogue/materials/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/some-id')
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/some-id')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent material', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates a material as ADMIN', async () => {
    // Ensure we have a material from the POST test
    expect(createdMaterialId).toBeDefined();

    const res = await request(app)
      .put(`/api/catalogue/materials/${createdMaterialId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Material Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Material Name');
  });
});

// --------------- Fractions ---------------

describe('GET /api/catalogue/fractions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/catalogue/fractions');
    expect(res.status).toBe(401);
  });

  it('returns fractions list for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/catalogue/fractions')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/catalogue/fractions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/catalogue/fractions')
      .send({ code: 'TEST-FRAC' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .post('/api/catalogue/fractions')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ code: 'TEST-FRAC', name: 'Test Fraction' });
    expect(res.status).toBe(403);
  });

  it('creates a fraction as ADMIN', async () => {
    const res = await request(app)
      .post('/api/catalogue/fractions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'FRAC-TEST-' + Date.now(),
        name: 'Test Fraction Integration',
        eural_code: '20 01 36',
        recycling_pct_default: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Test Fraction Integration');
    createdFractionId = res.body.data.id;
  });
});

describe('PUT /api/catalogue/fractions/:id', () => {
  it('returns 404 for non-existent fraction', async () => {
    const res = await request(app)
      .put('/api/catalogue/fractions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates a fraction as ADMIN', async () => {
    expect(createdFractionId).toBeDefined();

    const res = await request(app)
      .put(`/api/catalogue/fractions/${createdFractionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Fraction Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Fraction Name');
  });
});

// --------------- Material-Fraction linking ---------------

describe('PUT /api/catalogue/materials/:id/fractions', () => {
  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/some-id/fractions')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ fraction_ids: [] });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent material', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/00000000-0000-0000-0000-000000000000/fractions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fraction_ids: [] });
    expect(res.status).toBe(404);
  });

  it('links fractions to a material as ADMIN', async () => {
    expect(createdMaterialId).toBeDefined();
    expect(createdFractionId).toBeDefined();

    const res = await request(app)
      .put(`/api/catalogue/materials/${createdMaterialId}/fractions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fraction_ids: [createdFractionId] });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('fractions');
    expect(res.body.data.fractions.length).toBe(1);
  });
});

// --------------- Product Types (alias) ---------------

describe('GET /api/catalogue/product-types', () => {
  it('returns product types (alias for materials)', async () => {
    const res = await request(app)
      .get('/api/catalogue/product-types')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
