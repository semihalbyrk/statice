const prisma = require('../utils/prismaClient');
const service = require('../services/outboundLineService');
const { createLine } = service;

describe('outboundLineService', () => {
  it('exports the expected public API', () => {
    expect(typeof service.listByOutbound).toBe('function');
    expect(typeof service.createLine).toBe('function');
    expect(typeof service.updateLine).toBe('function');
    expect(typeof service.deleteLine).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const fixtureIds = {
  outbound_ids: [],
  outbound_order_ids: [],
  user_ids: [],
};

async function buildFixture({ userEmail }) {
  const user = await prisma.user.create({
    data: {
      email: userEmail,
      password_hash: 'x',
      role: 'ADMIN',
      full_name: 'Outbound Line Test',
    },
  });
  fixtureIds.user_ids.push(user.id);

  // Reuse seeded contract + entities
  const contract = await prisma.supplierContract.findFirstOrThrow({
    where: { contract_number: 'O-Contract #1' },
    include: { contract_waste_streams: true },
  });
  const cws = contract.contract_waste_streams[0];
  const disposer = await prisma.entity.findFirstOrThrow({ where: { is_disposer: true } });
  const transporter = await prisma.entity.findFirstOrThrow({ where: { is_transporter: true } });
  const material = await prisma.materialMaster.findFirstOrThrow({ where: { is_active: true } });

  const order = await prisma.outboundOrder.create({
    data: {
      order_number: `OO-LINE-TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      contract_id: contract.id,
      buyer_id: contract.buyer_id,
      sender_id: contract.sender_id,
      disposer_id: disposer.id,
      transporter_id: transporter.id,
      planned_date: new Date('2026-05-01'),
      shipment_type: 'DOMESTIC_NL',
      expected_outbounds: 1,
      created_by: user.id,
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
    include: { waste_streams: true },
  });
  fixtureIds.outbound_order_ids.push(order.id);

  const outbound = await prisma.outbound.create({
    data: {
      outbound_number: `OUT-LINE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      outbound_order_id: order.id,
      status: 'CREATED',
      created_by: user.id,
    },
    include: { outbound_order: { include: { waste_streams: true } } },
  });
  fixtureIds.outbound_ids.push(outbound.id);

  return { user, outbound, material };
}

afterAll(async () => {
  if (fixtureIds.outbound_ids.length) {
    await prisma.outboundLine.deleteMany({
      where: { outbound_id: { in: fixtureIds.outbound_ids } },
    });
    await prisma.outbound.deleteMany({ where: { id: { in: fixtureIds.outbound_ids } } });
  }
  if (fixtureIds.outbound_order_ids.length) {
    await prisma.outboundOrderWasteStream.deleteMany({
      where: { outbound_order_id: { in: fixtureIds.outbound_order_ids } },
    });
    await prisma.outboundOrder.deleteMany({
      where: { id: { in: fixtureIds.outbound_order_ids } },
    });
  }
  if (fixtureIds.user_ids.length) {
    await prisma.auditLog.deleteMany({ where: { user_id: { in: fixtureIds.user_ids } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureIds.user_ids } } });
  }
  await prisma.$disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// createLine
// ─────────────────────────────────────────────────────────────────────────────

describe('createLine', () => {
  let user;
  let outbound;

  beforeAll(async () => {
    const fx = await buildFixture({ userEmail: 'linetest@statice.test' });
    user = fx.user;
    outbound = fx.outbound;
  });

  it('creates a line with valid payload', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    const line = await createLine(
      outbound.id,
      {
        material_id: planned.material_id,
        container_type: 'OPEN_TOP',
        volume: 40,
        volume_uom: 'M3',
      },
      user.id,
    );
    expect(line.id).toBeDefined();
    expect(line.volume.toString()).toBe('40');
    expect(line.volume_uom).toBe('M3');
    expect(line.material).toBeDefined();
  });

  it('rejects material not in waste_streams', async () => {
    const plannedIds = outbound.outbound_order.waste_streams
      .map((w) => w.material_id)
      .filter(Boolean);
    const otherMaterial = await prisma.materialMaster.findFirst({
      where: { is_active: true, id: { notIn: plannedIds } },
    });
    if (!otherMaterial) return;
    await expect(
      createLine(
        outbound.id,
        {
          material_id: otherMaterial.id,
          container_type: 'OPEN_TOP',
          volume: 20,
          volume_uom: 'M3',
        },
        user.id,
      ),
    ).rejects.toThrow(/not planned/);
  });

  it('rejects volume <= 0', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    await expect(
      createLine(
        outbound.id,
        {
          material_id: planned.material_id,
          container_type: 'OPEN_TOP',
          volume: 0,
          volume_uom: 'M3',
        },
        user.id,
      ),
    ).rejects.toThrow(/> 0/);
  });

  it('rejects volume above cap', async () => {
    const planned = outbound.outbound_order.waste_streams[0];
    await expect(
      createLine(
        outbound.id,
        {
          material_id: planned.material_id,
          container_type: 'OPEN_TOP',
          volume: 1500,
          volume_uom: 'M3',
        },
        user.id,
      ),
    ).rejects.toThrow(/cap/);
  });
});
