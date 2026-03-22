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
let createdProcessorId;
let createdCertificateId;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
  plannerToken = await getToken('planner@statice.nl', 'Planner123!');
});

afterAll(async () => {
  // Clean up test data in reverse order
  if (createdCertificateId) {
    await prisma.processorCertificateMaterialScope.deleteMany({
      where: { certificate_id: createdCertificateId },
    }).catch(() => {});
    await prisma.processorCertificate.delete({
      where: { id: createdCertificateId },
    }).catch(() => {});
  }
  if (createdProcessorId) {
    await prisma.processor.delete({ where: { id: createdProcessorId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// --------------- List Processors ---------------

describe('GET /api/processors', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/processors');
    expect(res.status).toBe(401);
  });

  it('returns processors list for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/processors')
      .set('Authorization', `Bearer ${gateToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('supports search query parameter', async () => {
    const res = await request(app)
      .get('/api/processors?search=NONEXISTENT_PROCESSOR_999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// --------------- Create Processor ---------------

describe('POST /api/processors', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processors')
      .send({ name: 'Test Processor' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role (GATE_OPERATOR)', async () => {
    const res = await request(app)
      .post('/api/processors')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ name: 'Test Processor' });
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-ADMIN role (LOGISTICS_PLANNER)', async () => {
    const res = await request(app)
      .post('/api/processors')
      .set('Authorization', `Bearer ${plannerToken}`)
      .send({ name: 'Test Processor' });
    expect(res.status).toBe(403);
  });

  it('creates a processor as ADMIN', async () => {
    const res = await request(app)
      .post('/api/processors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Processor ' + Date.now(),
        address: '123 Test Street, Amsterdam',
        country: 'NL',
        environmental_permit_number: 'ENV-TEST-' + Date.now(),
        is_weeelabex_listed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data.country).toBe('NL');
    expect(res.body.data.is_weeelabex_listed).toBe(true);
    expect(res.body.data).toHaveProperty('certificates');
    expect(Array.isArray(res.body.data.certificates)).toBe(true);
    createdProcessorId = res.body.data.id;
  });
});

// --------------- Update Processor ---------------

describe('PUT /api/processors/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .put('/api/processors/some-id')
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .put('/api/processors/some-id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent processor', async () => {
    const res = await request(app)
      .put('/api/processors/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates a processor as ADMIN', async () => {
    expect(createdProcessorId).toBeDefined();

    const res = await request(app)
      .put(`/api/processors/${createdProcessorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Processor Name', country: 'BE' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Processor Name');
    expect(res.body.data.country).toBe('BE');
  });
});

// --------------- Create Certificate ---------------

describe('POST /api/processors/:id/certificates', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/processors/some-id/certificates')
      .send({ certificate_number: 'CERT-1' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN role', async () => {
    const res = await request(app)
      .post('/api/processors/some-id/certificates')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ certificate_number: 'CERT-1' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent processor', async () => {
    const res = await request(app)
      .post('/api/processors/00000000-0000-0000-0000-000000000000/certificates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        certificate_number: 'CERT-1',
        certification_body: 'Test Body',
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        material_ids: ['00000000-0000-0000-0000-000000000001'],
      });
    expect(res.status).toBe(404);
  });

  it('returns 400 when material_ids is empty', async () => {
    expect(createdProcessorId).toBeDefined();

    const res = await request(app)
      .post(`/api/processors/${createdProcessorId}/certificates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        certificate_number: 'CERT-TEST-1',
        certification_body: 'Test Body',
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        material_ids: [],
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a certificate with material scope as ADMIN', async () => {
    expect(createdProcessorId).toBeDefined();

    // Get an existing material to link
    const material = await prisma.materialMaster.findFirst({ where: { is_active: true } });
    expect(material).not.toBeNull();

    const res = await request(app)
      .post(`/api/processors/${createdProcessorId}/certificates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        certificate_number: 'CERT-TEST-' + Date.now(),
        certification_body: 'WEEElabex',
        valid_from: '2025-01-01',
        valid_to: '2027-12-31',
        material_ids: [material.id],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('certificate_number');
    expect(res.body.data).toHaveProperty('materials');
    expect(res.body.data.materials.length).toBe(1);
    createdCertificateId = res.body.data.id;
  });
});

// --------------- Validate Certificate ---------------

describe('GET /api/processors/validate', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/processors/validate');
    expect(res.status).toBe(401);
  });

  it('returns 400 when required params are missing', async () => {
    const res = await request(app)
      .get('/api/processors/validate')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('validates a certificate for a valid processor/material/date combo', async () => {
    expect(createdProcessorId).toBeDefined();
    expect(createdCertificateId).toBeDefined();

    const material = await prisma.materialMaster.findFirst({ where: { is_active: true } });

    const res = await request(app)
      .get('/api/processors/validate')
      .query({
        processor_id: createdProcessorId,
        material_id: material.id,
        transfer_date: '2026-06-15',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('valid', true);
    expect(res.body.data).toHaveProperty('valid_certificate_id', createdCertificateId);
  });
});
