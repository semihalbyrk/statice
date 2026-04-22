const request = require('supertest');
const app = require('../index.js');
const prisma = require('../utils/prismaClient');

async function getToken(email, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.accessToken;
}

describe('POST /api/outbounds/:id/lines', () => {
  let adminToken;
  let outbound;
  let plannedMaterialId;

  const cleanupIds = {
    line_ids: [],
    outbound_ids: [],
    outbound_order_ids: [],
  };

  beforeAll(async () => {
    adminToken = await getToken('admin@statice.nl', 'Admin1234!');

    // Build the fixture directly via Prisma, mirroring outboundLines.test.js
    const admin = await prisma.user.findFirstOrThrow({ where: { email: 'admin@statice.nl' } });

    const contract = await prisma.supplierContract.findFirstOrThrow({
      where: { contract_number: 'O-Contract #1' },
      include: { contract_waste_streams: true },
    });
    const cws = contract.contract_waste_streams[0];
    const disposer = await prisma.entity.findFirstOrThrow({ where: { is_disposer: true } });
    const transporter = await prisma.entity.findFirstOrThrow({ where: { is_transporter: true } });
    const material = await prisma.materialMaster.findFirstOrThrow({ where: { is_active: true } });
    plannedMaterialId = material.id;

    const order = await prisma.outboundOrder.create({
      data: {
        order_number: `OO-LINE-API-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        contract_id: contract.id,
        buyer_id: contract.buyer_id,
        sender_id: contract.sender_id,
        disposer_id: disposer.id,
        transporter_id: transporter.id,
        planned_date: new Date('2026-05-01'),
        shipment_type: 'DOMESTIC_NL',
        expected_outbounds: 1,
        created_by: admin.id,
        waste_streams: {
          create: [
            {
              waste_stream_id: cws.waste_stream_id,
              receiver_id: contract.buyer_id,
              asn: cws.afvalstroomnummer,
              material_id: material.id,
            },
          ],
        },
      },
    });
    cleanupIds.outbound_order_ids.push(order.id);

    outbound = await prisma.outbound.create({
      data: {
        outbound_number: `OUT-LINE-API-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        outbound_order_id: order.id,
        status: 'CREATED',
        created_by: admin.id,
      },
    });
    cleanupIds.outbound_ids.push(outbound.id);
  });

  afterAll(async () => {
    if (cleanupIds.outbound_ids.length) {
      await prisma.outboundLine.deleteMany({
        where: { outbound_id: { in: cleanupIds.outbound_ids } },
      });
      await prisma.outbound.deleteMany({ where: { id: { in: cleanupIds.outbound_ids } } });
    }
    if (cleanupIds.outbound_order_ids.length) {
      await prisma.outboundOrderWasteStream.deleteMany({
        where: { outbound_order_id: { in: cleanupIds.outbound_order_ids } },
      });
      await prisma.outboundOrder.deleteMany({
        where: { id: { in: cleanupIds.outbound_order_ids } },
      });
    }
    await prisma.$disconnect();
  });

  it('creates a line via POST and returns 201', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: plannedMaterialId,
        container_type: 'OPEN_TOP',
        volume: 40,
        volume_uom: 'M3',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.volume).toBeDefined();
    expect(res.body.data.container_type).toBe('OPEN_TOP');
    cleanupIds.line_ids.push(res.body.data.id);
  });

  it('rejects volume <= 0 with 400', async () => {
    const res = await request(app)
      .post(`/api/outbounds/${outbound.id}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        material_id: plannedMaterialId,
        container_type: 'OPEN_TOP',
        volume: 0,
        volume_uom: 'M3',
      });
    expect(res.status).toBe(400);
  });
});
