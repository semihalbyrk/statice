const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken;
}

let adminToken;
let gateToken;

beforeAll(async () => {
  adminToken = await getToken('admin@statice.nl', 'Admin1234!');
  gateToken = await getToken('gate@statice.nl', 'Gate1234!');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SortingSession loss tracking', () => {
  it('persists fase1_loss fields on the session model', async () => {
    const session = await prisma.sortingSession.findFirst();
    expect(session).toBeTruthy();

    await prisma.sortingSession.update({
      where: { id: session.id },
      data: {
        fase1_loss_kg: 1.25,
        fase1_loss_reason: 'MOISTURE',
        fase1_loss_notes: 'expected drying',
      },
    });

    const updated = await prisma.sortingSession.findUnique({ where: { id: session.id } });
    expect(Number(updated.fase1_loss_kg)).toBe(1.25);
    expect(updated.fase1_loss_reason).toBe('MOISTURE');
    expect(updated.fase1_loss_notes).toBe('expected drying');

    // reset
    await prisma.sortingSession.update({
      where: { id: session.id },
      data: { fase1_loss_kg: null, fase1_loss_reason: null, fase1_loss_notes: null },
    });
  });

  it('persists fase2_loss fields on the session model', async () => {
    const session = await prisma.sortingSession.findFirst();
    await prisma.sortingSession.update({
      where: { id: session.id },
      data: {
        fase2_loss_kg: 0.5,
        fase2_loss_reason: 'MEASUREMENT_VARIANCE',
      },
    });
    const updated = await prisma.sortingSession.findUnique({ where: { id: session.id } });
    expect(Number(updated.fase2_loss_kg)).toBe(0.5);
    expect(updated.fase2_loss_reason).toBe('MEASUREMENT_VARIANCE');

    await prisma.sortingSession.update({
      where: { id: session.id },
      data: { fase2_loss_kg: null, fase2_loss_reason: null },
    });
  });
});

describe('finalizeAsset — Fase 1 only path', () => {
  const SESSION = 'seed-session-005';
  const ASSET = 'seed-asset-005-a';

  async function reset() {
    const entries = await prisma.assetCatalogueEntry.findMany({
      where: { session_id: SESSION },
      select: { id: true },
    });
    const ids = entries.map((e) => e.id);
    if (ids.length > 0) {
      await prisma.reusableItem.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
      await prisma.processingOutcomeLine.deleteMany({
        where: { processing_record: { catalogue_entry_id: { in: ids } } },
      });
      await prisma.processingRecord.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
      await prisma.assetCatalogueEntry.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.sortingSession.update({
      where: { id: SESSION },
      data: { status: 'PLANNED', catalogue_status: 'NOT_STARTED', processing_status: 'NOT_STARTED' },
    });
  }

  beforeEach(async () => {
    await reset();
  });

  afterAll(async () => {
    await reset();
  });

  it('rejects finalize when no catalogue entries and no processing records exist', async () => {
    const res = await request(app)
      .post(`/api/processing/sessions/${SESSION}/assets/${ASSET}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/catalogue entry/i);
  });

  it('finalizes an asset with Fase 1 entries only (no processing records)', async () => {
    const entryRes = await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 100 });
    expect(entryRes.status).toBe(201);

    const res = await request(app)
      .post(`/api/processing/sessions/${SESSION}/assets/${ASSET}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('FASE1_ONLY');
  });
});

describe('markSessionSorted (manual Fase 1-only completion)', () => {
  const SESSION = 'seed-session-005';
  const ASSET = 'seed-asset-005-a';

  async function reset() {
    const entries = await prisma.assetCatalogueEntry.findMany({
      where: { session_id: SESSION },
      select: { id: true },
    });
    const ids = entries.map((e) => e.id);
    if (ids.length > 0) {
      await prisma.reusableItem.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
      await prisma.processingOutcomeLine.deleteMany({
        where: { processing_record: { catalogue_entry_id: { in: ids } } },
      });
      await prisma.processingRecord.deleteMany({ where: { catalogue_entry_id: { in: ids } } });
      await prisma.assetCatalogueEntry.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.sortingSession.update({
      where: { id: SESSION },
      data: {
        status: 'PLANNED',
        catalogue_status: 'NOT_STARTED',
        processing_status: 'NOT_STARTED',
        fase1_loss_kg: null,
        fase1_loss_reason: null,
        fase1_loss_notes: null,
      },
    });
    const session = await prisma.sortingSession.findUnique({ where: { id: SESSION } });
    await prisma.inbound.update({
      where: { id: session.inbound_id },
      data: { status: 'READY_FOR_SORTING' },
    });
  }

  beforeEach(async () => {
    await reset();
  });

  afterAll(async () => {
    await reset();
  });

  it('rejects mark-sorted when Fase 1 incomplete (asset has no entry)', async () => {
    const res = await request(app)
      .patch(`/api/sorting/${SESSION}/mark-sorted`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Fase 1/i);
  });

  it('marks session SORTED when Fase 1 complete and no processing records', async () => {
    await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 450 });

    const res = await request(app)
      .patch(`/api/sorting/${SESSION}/mark-sorted`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fase1_loss_kg: 0, fase1_loss_reason: 'MEASUREMENT_VARIANCE', fase1_loss_notes: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SORTED');
    expect(res.body.data.fase1_loss_reason).toBe('MEASUREMENT_VARIANCE');

    const session = await prisma.sortingSession.findUnique({ where: { id: SESSION } });
    expect(session.status).toBe('SORTED');
    const inbound = await prisma.inbound.findUnique({ where: { id: session.inbound_id } });
    expect(inbound.status).toBe('SORTED');
  });

  it('rejects reopen on INVOICED order without force flag', async () => {
    await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 100 });

    await request(app)
      .patch(`/api/sorting/${SESSION}/mark-sorted`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const session = await prisma.sortingSession.findUnique({ where: { id: SESSION } });
    const inbound = await prisma.inbound.findUnique({ where: { id: session.inbound_id } });
    const originalOrderStatus = (await prisma.inboundOrder.findUnique({ where: { id: inbound.order_id } })).status;
    await prisma.inboundOrder.update({
      where: { id: inbound.order_id },
      data: { status: 'INVOICED' },
    });

    try {
      const res = await request(app)
        .patch(`/api/sorting/${SESSION}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'test' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/INVOICED/i);

      const resForce = await request(app)
        .patch(`/api/sorting/${SESSION}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'test', force: true });
      expect(resForce.status).toBe(200);
    } finally {
      await prisma.inboundOrder.update({
        where: { id: inbound.order_id },
        data: { status: originalOrderStatus },
      });
    }
  });

  it('creates a processing record from a catalogue entry on demand', async () => {
    const entryRes = await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 50 });

    const res = await request(app)
      .post(`/api/processing/sessions/${SESSION}/records`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ catalogue_entry_id: entryRes.body.data.id });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.catalogue_entry_id).toBe(entryRes.body.data.id);
  });

  it('rejects duplicate processing record creation for the same entry', async () => {
    const entryRes = await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 50 });

    await request(app)
      .post(`/api/processing/sessions/${SESSION}/records`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ catalogue_entry_id: entryRes.body.data.id });

    const duplicate = await request(app)
      .post(`/api/processing/sessions/${SESSION}/records`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ catalogue_entry_id: entryRes.body.data.id });
    expect(duplicate.status).toBe(409);
  });

  it('rejects mark-sorted if non-confirmed processing records exist', async () => {
    const entryRes = await request(app)
      .post(`/api/catalogue/sessions/${SESSION}/assets/${ASSET}/entries`)
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ material_id: 'mat-hdd', weight_kg: 450 });

    await prisma.processingRecord.create({
      data: {
        session_id: SESSION,
        asset_id: ASSET,
        catalogue_entry_id: entryRes.body.data.id,
        material_id: 'mat-hdd',
        material_code_snapshot: 'MAT-HDD',
        material_name_snapshot: 'Hard Disk Drives',
        weee_category_snapshot: 'Cat. 3',
        status: 'DRAFT',
      },
    });

    const res = await request(app)
      .patch(`/api/sorting/${SESSION}/mark-sorted`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Fase 2/i);
  });
});
