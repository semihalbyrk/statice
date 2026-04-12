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
const createdEntityIds = [];
const createdSiteIds = [];

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
});

afterAll(async () => {
  // Clean up created disposer sites first (child records)
  for (const siteId of createdSiteIds) {
    await prisma.disposerSite.delete({ where: { id: siteId } }).catch(() => {});
  }
  // Clean up created entities
  for (const id of createdEntityIds) {
    await prisma.entity.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ===============================================================
// List Entities
// ===============================================================

describe('GET /api/entities', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/entities');
    expect(res.status).toBe(401);
  });

  it('returns paginated results with data array and total', async () => {
    const res = await request(app)
      .get('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.limit).toBe('number');
  });

  it('filters by role=supplier', async () => {
    const res = await request(app)
      .get('/api/entities?role=supplier')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const entity of res.body.data) {
      expect(entity.is_supplier).toBe(true);
    }
  });

  it('filters by status=ACTIVE', async () => {
    const res = await request(app)
      .get('/api/entities?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const entity of res.body.data) {
      expect(entity.status).toBe('ACTIVE');
    }
  });

  it('searches by company_name', async () => {
    // First get any entity to know a name to search for
    const all = await request(app)
      .get('/api/entities?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(all.body.data.length).toBeGreaterThan(0);
    const searchTerm = all.body.data[0].company_name.slice(0, 5);

    const res = await request(app)
      .get(`/api/entities?search=${encodeURIComponent(searchTerm)}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const entity of res.body.data) {
      const matchesName = entity.company_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesVihb = entity.vihb_number && entity.vihb_number.toLowerCase().includes(searchTerm.toLowerCase());
      expect(matchesName || matchesVihb).toBe(true);
    }
  });

  it('paginates with page and limit', async () => {
    const page1 = await request(app)
      .get('/api/entities?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBeLessThanOrEqual(2);
    expect(page1.body.page).toBe(1);
    expect(page1.body.limit).toBe(2);

    if (page1.body.total > 2) {
      const page2 = await request(app)
        .get('/api/entities?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(page2.status).toBe(200);
      expect(page2.body.page).toBe(2);
      // Ensure different results
      if (page2.body.data.length > 0) {
        expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
      }
    }
  });
});

// ===============================================================
// Get Entity by ID
// ===============================================================

describe('GET /api/entities/:id', () => {
  it('returns full entity with disposer_sites', async () => {
    // Get an existing entity
    const list = await request(app)
      .get('/api/entities?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    const entityId = list.body.data[0].id;

    const res = await request(app)
      .get(`/api/entities/${entityId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(entityId);
    expect(res.body.data).toHaveProperty('disposer_sites');
    expect(res.body.data).toHaveProperty('company_name');
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await request(app)
      .get('/api/entities/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ===============================================================
// Create Entity
// ===============================================================

describe('POST /api/entities', () => {
  it('creates a supplier entity', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Groenrecycling Nederland B.V.',
        street_and_number: 'Industrieweg 42',
        postal_code: '3044 BC',
        city: 'Rotterdam',
        country: 'NL',
        kvk_number: '12345678',
        is_supplier: true,
        supplier_type: 'COMMERCIAL',
        supplier_roles: ['ONTDOENER'],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.is_supplier).toBe(true);
    expect(res.body.data.supplier_type).toBe('COMMERCIAL');
    expect(res.body.data.supplier_roles).toEqual(['ONTDOENER']);
    createdEntityIds.push(res.body.data.id);
  });

  it('rejects when no roles selected', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Lege Rollen B.V.',
        street_and_number: 'Kerkstraat 1',
        postal_code: '1011 AB',
        city: 'Amsterdam',
        is_supplier: false,
        is_transporter: false,
        is_disposer: false,
        is_receiver: false,
      });
    expect(res.status).toBe(400);
  });

  it('rejects supplier without supplier_type', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Ontbrekende Type B.V.',
        street_and_number: 'Hoofdweg 10',
        postal_code: '2511 AA',
        city: 'Den Haag',
        kvk_number: '87654321',
        is_supplier: true,
        supplier_roles: ['ONTDOENER'],
      });
    expect(res.status).toBe(400);
  });

  it('rejects transporter without vihb_number', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Sneltransport Zuid B.V.',
        street_and_number: 'Havenweg 5',
        postal_code: '4811 AA',
        city: 'Breda',
        is_transporter: true,
      });
    expect(res.status).toBe(400);
  });

  it('rejects PRO supplier without pro_registration_number', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Stichting Recycling Fonds',
        street_and_number: 'Prinsengracht 100',
        postal_code: '1015 DV',
        city: 'Amsterdam',
        kvk_number: '11223344',
        is_supplier: true,
        supplier_type: 'PRO',
        supplier_roles: ['BEMIDDELAAR'],
      });
    expect(res.status).toBe(400);
  });

  it('rejects supplier without kvk_number', async () => {
    const res = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Zonder KVK Leverancier B.V.',
        street_and_number: 'Marktplein 3',
        postal_code: '6811 CG',
        city: 'Arnhem',
        is_supplier: true,
        supplier_type: 'COMMERCIAL',
        supplier_roles: ['HANDELAAR'],
      });
    expect(res.status).toBe(400);
  });
});

// ===============================================================
// Update Entity
// ===============================================================

describe('PUT /api/entities/:id', () => {
  it('nullifies supplier fields when is_supplier set to false', async () => {
    // First create a supplier entity to update
    const createRes = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Circulaire Materialen B.V.',
        street_and_number: 'Fabriekslaan 20',
        postal_code: '5611 AA',
        city: 'Eindhoven',
        kvk_number: '99887766',
        is_supplier: true,
        is_transporter: true,
        vihb_number: 'VIHB-98765',
        supplier_type: 'COMMERCIAL',
        supplier_roles: ['ONTDOENER'],
      });
    expect(createRes.status).toBe(201);
    const entityId = createRes.body.data.id;
    createdEntityIds.push(entityId);

    // Now remove the supplier role
    const updateRes = await request(app)
      .put(`/api/entities/${entityId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        is_supplier: false,
        is_transporter: true,
        vihb_number: 'VIHB-98765',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.is_supplier).toBe(false);
    expect(updateRes.body.data.supplier_type).toBeNull();
    expect(updateRes.body.data.supplier_roles).toEqual([]);
  });
});

// ===============================================================
// Toggle Status
// ===============================================================

describe('PATCH /api/entities/:id/status', () => {
  it('toggles status from ACTIVE to INACTIVE and back', async () => {
    // Create an entity to toggle
    const createRes = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Duurzaam Verwerken B.V.',
        street_and_number: 'Stationsweg 8',
        postal_code: '3511 ED',
        city: 'Utrecht',
        kvk_number: '55443322',
        is_supplier: true,
        supplier_type: 'AD_HOC',
        supplier_roles: ['ONTVANGER'],
      });
    expect(createRes.status).toBe(201);
    const entityId = createRes.body.data.id;
    createdEntityIds.push(entityId);
    expect(createRes.body.data.status).toBe('ACTIVE');

    // Toggle to INACTIVE
    const toggle1 = await request(app)
      .patch(`/api/entities/${entityId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(toggle1.status).toBe(200);
    expect(toggle1.body.data.status).toBe('INACTIVE');

    // Toggle back to ACTIVE
    const toggle2 = await request(app)
      .patch(`/api/entities/${entityId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(toggle2.status).toBe(200);
    expect(toggle2.body.data.status).toBe('ACTIVE');
  });
});

// ===============================================================
// Disposer Sites
// ===============================================================

describe('POST /api/entities/:id/disposer-sites', () => {
  it('creates a disposer site for a disposer entity', async () => {
    // Create a disposer entity first
    const createRes = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Verwerking Limburg B.V.',
        street_and_number: 'Maastrichterlaan 15',
        postal_code: '6211 JA',
        city: 'Maastricht',
        kvk_number: '33221100',
        environmental_permit_number: 'ENV-2026-001',
        is_disposer: true,
      });
    expect(createRes.status).toBe(201);
    const disposerId = createRes.body.data.id;
    createdEntityIds.push(disposerId);

    // Create a disposer site
    const siteRes = await request(app)
      .post(`/api/entities/${disposerId}/disposer-sites`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        site_name: 'Locatie Meerssen',
        street_and_number: 'Industrieterrein 5',
        postal_code: '6231 AB',
        city: 'Meerssen',
      });
    expect(siteRes.status).toBe(201);
    expect(siteRes.body.data).toBeDefined();
    expect(siteRes.body.data.site_name).toBe('Locatie Meerssen');
    createdSiteIds.push(siteRes.body.data.id);
  });

  it('rejects disposer site for non-disposer entity', async () => {
    // Create a non-disposer entity
    const createRes = await request(app)
      .post('/api/entities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company_name: 'Alleen Transport B.V.',
        street_and_number: 'Rijksweg 100',
        postal_code: '7411 AA',
        city: 'Deventer',
        is_transporter: true,
        vihb_number: 'VIHB-55555',
      });
    expect(createRes.status).toBe(201);
    const nonDisposerId = createRes.body.data.id;
    createdEntityIds.push(nonDisposerId);

    const siteRes = await request(app)
      .post(`/api/entities/${nonDisposerId}/disposer-sites`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        site_name: 'Mag Niet Locatie',
        street_and_number: 'Verboden Straat 1',
        postal_code: '7500 AA',
        city: 'Enschede',
      });
    expect(siteRes.status).toBe(400);
  });
});
