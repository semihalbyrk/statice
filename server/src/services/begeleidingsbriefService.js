const prisma = require('../utils/prismaClient');

// ── helpers ──────────────────────────────────────────────────────────

/**
 * Groups OutboundLines (filtered to one material) by (volume_uom, volume).
 * Sorts M3 before L, then by ascending volume.
 * Returns e.g. "2 x 40m³, 3 x 200L"
 */
const UOM_SYMBOL = { M3: 'm³', L: 'L' };
const UOM_ORDER = { M3: 0, L: 1 };

function formatPackaging(lines) {
  if (!lines || lines.length === 0) return '';
  const groups = new Map();
  for (const l of lines) {
    const key = `${l.volume_uom}|${Number(l.volume)}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const entries = Array.from(groups.entries()).map(([key, count]) => {
    const [uom, volume] = key.split('|');
    return { uom, volume: Number(volume), count };
  });
  entries.sort((a, b) => (UOM_ORDER[a.uom] - UOM_ORDER[b.uom]) || (a.volume - b.volume));
  return entries
    .map((e) => `${e.count} x ${e.volume}${UOM_SYMBOL[e.uom]}`)
    .join(', ');
}

function formatDateNL(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// ── main mapper ──────────────────────────────────────────────────────

async function mapBegeleidingsbrief(outboundId) {
  const outbound = await prisma.outbound.findUnique({
    where: { id: outboundId },
    include: {
      outbound_order: {
        include: {
          contract: { include: { invoice_entity: true } },
          sender: true,
          disposer: true,
          disposer_site: true,
          transporter: true,
          outsourced_transporter: true,
          waste_streams: {
            include: {
              waste_stream: true,
              receiver: true,
            },
          },
        },
      },
      parcels: { include: { material: true } },
    },
  });

  if (!outbound) throw new Error(`Outbound ${outboundId} not found`);

  const order = outbound.outbound_order;
  const contract = order.contract;

  // Fetch MaterialMaster (name + eural_code) for all waste stream materials
  const materialIds = order.waste_streams.map((ws) => ws.material_id).filter(Boolean);
  let materialsMap = {};
  if (materialIds.length > 0) {
    const materials = await prisma.materialMaster.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true, eural_code: true },
    });
    materialsMap = Object.fromEntries(materials.map((m) => [m.id, m]));
  }

  // Section 1 — Afzender (Sender)
  const sender = {
    name: order.sender.company_name,
    address: order.sender.street_and_number,
    postalCity: `${order.sender.postal_code} ${order.sender.city}`,
    vihb: order.sender.vihb_number || '',
    isDisposer: Boolean(order.sender.is_disposer),
    isReceiver: Boolean(order.sender.is_receiver),
  };

  // Section 2 — Factuuradres
  const invoiceEntity = contract.invoice_entity
    ? {
        name: contract.invoice_entity.company_name,
        street: contract.invoice_entity.street_and_number,
        postalCity: `${contract.invoice_entity.postal_code} ${contract.invoice_entity.city}`,
      }
    : null;

  // Section 3A — Ontdoener (Disposer)
  const disposer = {
    name: order.disposer.company_name,
    address: order.disposer.street_and_number,
    postalCity: `${order.disposer.postal_code} ${order.disposer.city}`,
  };

  // Section 3B — Locatie van herkomst (DisposerSite with fallback to disposer)
  const site = order.disposer_site;
  const originSite = site
    ? {
        name: site.site_name,
        address: site.street_and_number,
        postalCity: `${site.postal_code} ${site.city}`,
      }
    : {
        name: order.disposer.company_name,
        address: order.disposer.street_and_number,
        postalCity: `${order.disposer.postal_code} ${order.disposer.city}`,
      };

  // Section 4A — Uitbesteed vervoerder (only when set)
  const outsourcedTransporter = order.outsourced_transporter
    ? {
        name: order.outsourced_transporter.company_name,
        address: order.outsourced_transporter.street_and_number,
        postalCity: `${order.outsourced_transporter.postal_code} ${order.outsourced_transporter.city}`,
        vihb: order.outsourced_transporter.vihb_number || '',
      }
    : null;

  // Section 4B — Locatie van bestemming (receiver from first waste stream)
  const firstReceiver = order.waste_streams[0]?.receiver;
  const destination = firstReceiver
    ? {
        name: firstReceiver.company_name,
        address: firstReceiver.street_and_number,
        postalCity: `${firstReceiver.postal_code} ${firstReceiver.city}`,
      }
    : { name: '', address: '', postalCity: '' };

  // Section 5 — Vervoerder
  const transporter = {
    name: order.transporter.company_name,
    address: order.transporter.street_and_number,
    postalCity: `${order.transporter.postal_code} ${order.transporter.city}`,
    vihb: order.transporter.vihb_number || '',
  };

  // Section 6 — Waste lines (max 11 AcroForm rows)
  const isSingleStream = order.waste_streams.length === 1;
  const streams = order.waste_streams.slice(0, 11);

  const wasteLines = streams.map((ws) => {
    const material = materialsMap[ws.material_id];
    // Parcels belonging to this material only
    const materialParcels = outbound.parcels.filter(
      (p) => p.material_id === ws.material_id,
    );
    return {
      asn: ws.asn || '',
      materialName: material?.name || ws.waste_stream?.name || '',
      packaging: formatPackaging(materialParcels),
      euralCode: material?.eural_code || '',
      processingMethod: ws.processing_method || '',
      estimatedWeight:
        ws.planned_amount_kg != null ? String(Number(ws.planned_amount_kg)) : '',
      // measuredWeight only populated for single-stream outbounds
      measuredWeight:
        isSingleStream && outbound.net_weight_kg != null
          ? String(Number(outbound.net_weight_kg))
          : '',
    };
  });

  // Overflow note when order has more than 11 waste streams
  if (order.waste_streams.length > 11) {
    const overflow = order.waste_streams.length - 10;
    wasteLines[10].materialName = `+ ${overflow} more — see order ${order.order_number}`;
    wasteLines[10].asn = '';
  }

  return {
    documentNumber: outbound.outbound_number,
    sender,
    invoiceEntity,
    disposer,
    originSite,
    transportStartDate: formatDateNL(order.planned_date),
    outsourcedTransporter,
    destination,
    hasOutsourcedTransporter: Boolean(order.outsourced_transporter),
    transporter,
    vehiclePlate: outbound.vehicle_plate || order.vehicle_plate || '',
    wasteLines,
  };
}

module.exports = { mapBegeleidingsbrief, formatDateNL, formatPackaging };
