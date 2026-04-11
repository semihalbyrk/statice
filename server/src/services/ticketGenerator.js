const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const prisma = require('../utils/prismaClient');

// Receipt dimensions: ~80mm wide thermal printer style
const RECEIPT_WIDTH = 226;
const MARGIN_H = 15;
const CONTENT_W = RECEIPT_WIDTH - MARGIN_H * 2;

const LOGO_PATH = path.resolve(
  __dirname,
  '../../../docs/Statice_General_Logo.png',
);

// ─── Dutch number formatting ──────────────────────────────────────────────────

function formatWeightDutch(kg) {
  if (kg == null) return '—';
  const n = Number(kg);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 0 }) + ' kg';
}

// DD/MM/YYYY HH:MM:SS  (Dutch date format used on Pfister tickets)
function formatTimestampDutch(value, withSeconds = true) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timePart = withSeconds
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${datePart}  ${timePart}`;
}

// DD-MM-YYYY HH:MM:SS  (footer "Gegenereerd" style)
function formatDateTimeFooter(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// ─── Low-level drawing helpers ────────────────────────────────────────────────

/**
 * Draw a full-width horizontal rule at the current y position.
 * Advances doc.y by the rule thickness + 4 px padding below.
 */
function drawRule(doc) {
  const y = doc.y;
  doc
    .moveTo(MARGIN_H, y)
    .lineTo(MARGIN_H + CONTENT_W, y)
    .lineWidth(0.5)
    .strokeColor('#888888')
    .stroke();
  doc.y = y + 5;
}

/**
 * Draw a key-value row:
 *   "label:  <spaces>  value" (label left, value right-aligned)
 *
 * @param {PDFDocument} doc
 * @param {string} label  - left side text
 * @param {string} value  - right side text
 * @param {object} [opts]
 * @param {string} [opts.labelFont]   - defaults to 'Helvetica'
 * @param {string} [opts.valueFont]   - defaults to 'Helvetica'
 * @param {number} [opts.fontSize]    - defaults to 7
 * @param {string} [opts.color]       - defaults to '#111111'
 */
function drawRow(doc, label, value, opts = {}) {
  const {
    labelFont = 'Helvetica',
    valueFont = 'Helvetica',
    fontSize = 7,
    color = '#111111',
  } = opts;

  const y = doc.y;
  const safeValue = value ?? '—';

  doc
    .font(labelFont)
    .fontSize(fontSize)
    .fillColor(color)
    .text(String(label), MARGIN_H, y, { width: CONTENT_W * 0.55, lineBreak: false });

  doc
    .font(valueFont)
    .fontSize(fontSize)
    .fillColor(color)
    .text(String(safeValue), MARGIN_H + CONTENT_W * 0.55, y, {
      width: CONTENT_W * 0.45,
      align: 'right',
      lineBreak: false,
    });

  doc.y = y + fontSize + 3;
}

/**
 * Print a single line of centered text and advance y.
 */
function drawCentered(doc, text, { font = 'Helvetica', fontSize = 7, color = '#111111' } = {}) {
  doc
    .font(font)
    .fontSize(fontSize)
    .fillColor(color)
    .text(text, MARGIN_H, doc.y, { width: CONTENT_W, align: 'center' });
}

// ─── Section builders ─────────────────────────────────────────────────────────

function drawHeader(doc, logoExists) {
  const logoH = 28;

  if (logoExists) {
    doc.image(LOGO_PATH, MARGIN_H, doc.y, { fit: [CONTENT_W, logoH], align: 'center' });
    doc.y += logoH + 4;
  }

  drawCentered(doc, 'Statice Elektronica Recycling', {
    font: 'Helvetica-Bold',
    fontSize: 7,
  });
  doc.y += 1;
  drawCentered(doc, 'De Oude Kooien 15', { fontSize: 6.5, color: '#444444' });
  drawCentered(doc, '5986 PJ Beringe NL', { fontSize: 6.5, color: '#444444' });
  drawCentered(doc, 'T +31 (0)77 306 0688', { fontSize: 6.5, color: '#444444' });
  doc.y += 4;
}

function drawMetaSection(doc, inbound) {
  const order = inbound.order || {};
  const vehicle = inbound.vehicle || {};

  // Supplier name
  const supplierName = order.supplier?.name || '—';
  // Client reference (Referentie)
  const referentie = order.client_reference || '—';
  // Order number
  const orderNumber = order.order_number || '—';
  // Inbound number
  const inboundNumber = inbound.inbound_number || '—';
  // Vehicle registration plate
  const kenteken = vehicle.registration_plate || order.vehicle_plate || '—';

  drawRow(doc, 'Leverancier:', supplierName);
  drawRow(doc, 'Referentie:', referentie);
  drawRow(doc, 'Order:', orderNumber);
  drawRow(doc, 'Inbound:', inboundNumber);
  drawRow(doc, 'Kenteken:', kenteken);

  // Assets: one row per asset showing label + container_type / waste stream
  const assets = inbound.assets || [];
  if (assets.length > 0) {
    for (const asset of assets) {
      const assetLabel = asset.asset_label || '—';
      drawRow(doc, 'Asset:', assetLabel);

      const containerType = asset.container_type || '';
      const wsName =
        asset.waste_stream?.name ||
        order.waste_stream?.name ||
        '';
      const assetDetail = [containerType, wsName].filter(Boolean).join(' / ') || '—';
      // Indent the detail line slightly
      doc.y -= 1;
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor('#444444')
        .text(assetDetail, MARGIN_H + 8, doc.y, { width: CONTENT_W - 8, align: 'left' });
      doc.y += 2;
    }
  } else {
    // Legacy: no assets, show waste stream from order
    const wsName = order.waste_stream?.name || '—';
    drawRow(doc, 'Afvalstroom:', wsName);
  }

  doc.y += 2;
}

/**
 * Render one weighing block:
 *
 *   DD/MM/YYYY          HH:MM:SS
 *   Volgnummer              9141
 *   Weg                     1411
 *   N. Gewicht         18.020 kg
 */
function drawWeighingBlock(doc, weighing, sequenceLabel) {
  const ticket = weighing.pfister_ticket || {};
  const timestamp = ticket.timestamp || weighing.created_at;
  const volgnummer = ticket.ticket_number || '—';
  const weg = ticket.device_id || '—';
  const weightFormatted = formatWeightDutch(weighing.weight_kg);

  // Timestamp row: date left, time right
  const ts = formatTimestampDutch(timestamp, true);
  const [datePart = '—', timePart = ''] = ts.split('  ');

  const y = doc.y;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#111111')
    .text(datePart, MARGIN_H, y, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#111111')
    .text(timePart, MARGIN_H, y, { width: CONTENT_W, align: 'right', lineBreak: false });
  doc.y = y + 10;

  drawRow(doc, 'Volgnummer', volgnummer);
  drawRow(doc, 'Weg', weg);
  drawRow(doc, `${sequenceLabel}. Gewicht`, weightFormatted, { valueFont: 'Helvetica-Bold' });
  doc.y += 3;
}

function drawWeighingsSection(doc, inbound) {
  const weighings = inbound.weighings || [];
  const mode = inbound.weighing_mode || null;

  if (!weighings.length) {
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#888888')
      .text('Geen weegdata beschikbaar.', MARGIN_H, doc.y, { width: CONTENT_W, align: 'center' });
    doc.y += 6;
    return;
  }

  weighings.forEach((w, i) => {
    drawWeighingBlock(doc, w, String(i + 1));
  });

  // ── Net weight section ──────────────────────────────────────────────────────

  const assets = inbound.assets || [];

  if (mode === 'DIRECT' && assets.length > 0) {
    // DIRECT: known container tare — show per-asset breakdown
    for (const asset of assets) {
      const grossKg = asset.gross_weight_kg;
      const tareKg = asset.tare_weight_kg;
      const netKg = asset.net_weight_kg;

      if (grossKg != null || tareKg != null || netKg != null) {
        if (assets.length > 1) {
          doc
            .font('Helvetica-Bold')
            .fontSize(6.5)
            .fillColor('#444444')
            .text(asset.asset_label || '—', MARGIN_H, doc.y, { width: CONTENT_W });
          doc.y += 1;
        }
        drawRow(doc, 'Bruto Container', formatWeightDutch(grossKg));
        drawRow(doc, 'Container Tarra', formatWeightDutch(tareKg));
        drawRow(doc, 'Netto Lading', formatWeightDutch(netKg), {
          labelFont: 'Helvetica-Bold',
          valueFont: 'Helvetica-Bold',
        });
      }
    }
  } else {
    // SWAP, BULK, legacy: single net weight line
    // Net weight: prefer asset-level, fall back to inbound-level
    let netKg = null;

    if (assets.length === 1 && assets[0].net_weight_kg != null) {
      netKg = assets[0].net_weight_kg;
    } else if (assets.length > 1) {
      // Sum all assets
      const sum = assets.reduce((acc, a) => acc + (Number(a.net_weight_kg) || 0), 0);
      netKg = sum > 0 ? sum : null;
    }

    // Fall back to inbound-level
    if (netKg == null) {
      netKg = inbound.net_weight_kg;
    }

    drawRow(doc, 'Netto Gewicht', formatWeightDutch(netKg), {
      labelFont: 'Helvetica-Bold',
      valueFont: 'Helvetica-Bold',
    });
  }

  doc.y += 2;
}

function drawConfirmationSection(doc, inbound) {
  const confirmedBy = inbound.confirmed_by_user?.full_name || '—';
  const generatedAt = formatDateTimeFooter(new Date());

  drawRow(doc, 'Bevestigd door:', confirmedBy);
  drawRow(doc, 'Gegenereerd:', generatedAt);
  doc.y += 2;
}

function drawCertFooter(doc) {
  drawCentered(doc, 'WEEELABEX certified facility', {
    font: 'Helvetica',
    fontSize: 6.5,
    color: '#444444',
  });
  doc.y += 4;
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function generateWeightTicket(inboundId) {
  const inbound = await prisma.inbound.findUnique({
    where: { id: inboundId },
    include: {
      order: { include: { supplier: true, carrier: true, waste_stream: true } },
      vehicle: true,
      assets: { include: { waste_stream: true, material_category: true } },
      weighings: { include: { pfister_ticket: true }, orderBy: { sequence: 'asc' } },
      confirmed_by_user: { select: { full_name: true } },
    },
  });

  if (!inbound) {
    const err = new Error('Inbound not found');
    err.statusCode = 404;
    throw err;
  }

  const logoExists = fs.existsSync(LOGO_PATH);

  // Estimate page height: base + per-weighing rows + asset rows
  const weighingCount = (inbound.weighings || []).length;
  const assetCount = (inbound.assets || []).length;
  const estimatedHeight =
    180 + // header + meta
    weighingCount * 55 + // ~55 px per weighing block
    assetCount * 14 + // asset rows
    80; // footer + net weight + padding

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [RECEIPT_WIDTH, Math.max(estimatedHeight, 400)],
      margins: { top: 16, bottom: 16, left: MARGIN_H, right: MARGIN_H },
      autoFirstPage: true,
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──
    drawHeader(doc, logoExists);
    drawRule(doc);

    // ── Meta (supplier, order, vehicle, assets) ──
    drawMetaSection(doc, inbound);
    drawRule(doc);

    // ── Weighings + net weight ──
    doc.y += 3;
    drawWeighingsSection(doc, inbound);
    drawRule(doc);

    // ── Confirmation ──
    drawConfirmationSection(doc, inbound);
    drawRule(doc);

    // ── Cert footer ──
    drawCertFooter(doc);

    doc.end();
  });
}

module.exports = { generateWeightTicket };
