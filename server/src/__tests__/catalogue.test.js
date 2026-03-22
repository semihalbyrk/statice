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
      .send({ code: 'TEST', name_en: 'Test Material' });
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
        name_en: 'Test Material Integration',
        name_nl: 'Test Materiaal',
        waste_stream_id: wsRes.id,
        cbs_code: 'TST-CBS',
        weeelabex_group: 'TST-WLX',
        eural_code: 'TST-EUR',
        weee_category: 'Cat 1',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name_en).toBe('Test Material Integration');
    createdMaterialId = res.body.data.id;
  });
});

describe('PUT /api/catalogue/materials/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/some-id')
      .send({ name_en: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/some-id')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ name_en: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent material', async () => {
    const res = await request(app)
      .put('/api/catalogue/materials/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates a material as ADMIN', async () => {
    // Ensure we have a material from the POST test
    expect(createdMaterialId).toBeDefined();

    const res = await request(app)
      .put(`/api/catalogue/materials/${createdMaterialId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Material Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name_en).toBe('Updated Material Name');
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
      .send({ code: 'TEST-FRAC', name_en: 'Test Fraction' });
    expect(res.status).toBe(403);
  });

  it('creates a fraction as ADMIN', async () => {
    const res = await request(app)
      .post('/api/catalogue/fractions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'FRAC-TEST-' + Date.now(),
        name_en: 'Test Fraction Integration',
        name_nl: 'Test Fractie',
        eural_code: '20 01 36',
        recycling_pct_default: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name_en).toBe('Test Fraction Integration');
    createdFractionId = res.body.data.id;
  });
});

describe('PUT /api/catalogue/fractions/:id', () => {
  it('returns 404 for non-existent fraction', async () => {
    const res = await request(app)
      .put('/api/catalogue/fractions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates a fraction as ADMIN', async () => {
    expect(createdFractionId).toBeDefined();

    const res = await request(app)
      .put(`/api/catalogue/fractions/${createdFractionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Fraction Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name_en).toBe('Updated Fraction Name');
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
