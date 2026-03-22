const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const prisma = require('../utils/prismaClient');

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const LOGO_PATH = path.resolve(__dirname, '../../../docs/logo-statice-elektronica-recycling.png');

async function generateWeightTicket(inboundId) {
  const inbound = await prisma.inbound.findUnique({
    where: { id: inboundId },
    include: {
      order: {
        include: {
          carrier: true,
          supplier: true,
          waste_stream: true,
        },
      },
      vehicle: true,
      waste_stream: true,
      gross_ticket: true,
      tare_ticket: true,
      assets: {
        include: {
          waste_stream: { select: { id: true, name_en: true, code: true } },
          material_category: { select: { id: true, code_cbs: true, description_en: true } },
        },
        orderBy: { sequence: 'asc' },
      },
      weighings: {
        include: { pfister_ticket: true },
        orderBy: { sequence: 'asc' },
      },
      confirmed_by_user: {
        select: { full_name: true },
      },
    },
  });

  if (!inbound) {
    const err = new Error('Inbound not found');
    err.statusCode = 404;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, inbound);
    drawOrderDetails(doc, inbound);
    drawPfisterSection(doc, inbound);
    drawWeighingSequence(doc, inbound.weighings || []);
    drawAssetsTable(doc, inbound.assets || []);
    drawFooter(doc, inbound);

    doc.end();
  });
}

function drawHeader(doc, inbound) {
  const topY = PAGE_MARGIN - 6;
  const logoExists = fs.existsSync(LOGO_PATH);

  if (logoExists) {
    doc.image(LOGO_PATH, PAGE_MARGIN, topY, { fit: [190, 56], align: 'left' });
  }

  const titleX = PAGE_MARGIN + (logoExists ? 204 : 0);
  const titleWidth = CONTENT_WIDTH - (logoExists ? 204 : 0);

  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .fillColor('#111827')
    .text('DIGITAL WEIGHT TICKET', titleX, topY + 4, {
      width: titleWidth,
      align: logoExists ? 'right' : 'left',
    });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#4B5563')
    .text('Statice Elektronica Recycling', titleX, topY + 28, {
      width: titleWidth,
      align: logoExists ? 'right' : 'left',
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Inbound Name: ${inbound.inbound_number || '—'}`, PAGE_MARGIN, PAGE_MARGIN + 60);

  doc
    .moveTo(PAGE_MARGIN, PAGE_MARGIN + 84)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, PAGE_MARGIN + 84)
    .lineWidth(1)
    .strokeColor('#D1D5DB')
    .stroke();

  doc.y = PAGE_MARGIN + 96;
}

function drawOrderDetails(doc, inbound) {
  const order = inbound.order;
  const details = [
    { label: 'Linked Order', value: order?.order_number || '—' },
    { label: 'Vehicle Plate', value: inbound.vehicle?.registration_plate || order?.vehicle_plate || '—' },
    { label: 'Carrier', value: order?.carrier?.name || '—' },
    { label: 'Supplier', value: (() => {
      const supplierName = order?.supplier?.name || '—';
      const supplierType = order?.supplier?.supplier_type ? ` (${order.supplier.supplier_type})` : '';
      return supplierName + supplierType;
    })() },
    {
      label: 'Waste Stream',
      value: inbound.waste_stream
        ? `${inbound.waste_stream.name_en} (${inbound.waste_stream.code})`
        : order?.waste_stream
          ? `${order.waste_stream.name_en} (${order.waste_stream.code})`
          : '—',
    },
    { label: 'Planned Date', value: formatDateTime(order?.planned_date, false) },
    { label: 'Arrived At', value: formatDateTime(inbound.arrived_at, true) },
    { label: 'Confirmed By', value: inbound.confirmed_by_user?.full_name || 'System' },
  ];

  const boxTop = doc.y;
  const boxWidth = CONTENT_WIDTH;
  const leftX = PAGE_MARGIN + 18;
  const rightX = PAGE_MARGIN + boxWidth / 2 + 10;
  const columnWidth = boxWidth / 2 - 28;
  let cursorY = boxTop + 22;

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('Order Details', PAGE_MARGIN, boxTop);

  doc
    .roundedRect(PAGE_MARGIN, boxTop + 18, boxWidth, 1, 6)
    .fill('#E5E7EB');

  for (let index = 0; index < details.length; index += 2) {
    const left = details[index];
    const right = details[index + 1];
    const leftHeight = detailBlockHeight(doc, left.value, columnWidth);
    const rightHeight = right ? detailBlockHeight(doc, right.value, columnWidth) : 0;
    const rowHeight = Math.max(leftHeight, rightHeight, 36);

    drawDetailBlock(doc, leftX, cursorY, columnWidth, left.label, left.value);
    if (right) {
      drawDetailBlock(doc, rightX, cursorY, columnWidth, right.label, right.value);
    }

    cursorY += rowHeight + 16;
  }

  doc
    .roundedRect(PAGE_MARGIN, boxTop + 12, boxWidth, cursorY - boxTop - 6, 10)
    .lineWidth(1)
    .strokeColor('#D1D5DB')
    .stroke();

  doc.y = cursorY + 8;
}

function detailBlockHeight(doc, value, width) {
  return 16 + doc.heightOfString(String(value || '—'), {
    width,
    align: 'left',
  });
}

function drawDetailBlock(doc, x, y, width, label, value) {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#6B7280')
    .text(label.toUpperCase(), x, y, { width });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#111827')
    .text(String(value || '—'), x, y + 12, { width });
}

function drawPfisterSection(doc, inbound) {
  doc.y += 12;
  ensurePageSpace(doc, 152);

  const sectionTop = doc.y;
  const cardGap = 10;
  const cardWidth = (CONTENT_WIDTH - cardGap * 2) / 3;
  const weights = [
    {
      label: 'Gross Weight',
      value: inbound.gross_weight_kg,
      timestamp: inbound.gross_ticket?.timestamp,
      overridden: inbound.gross_ticket?.is_manual_override,
    },
    {
      label: 'Tare Weight',
      value: inbound.tare_weight_kg,
      timestamp: inbound.tare_ticket?.timestamp,
      overridden: inbound.tare_ticket?.is_manual_override,
    },
    {
      label: 'Net Weight',
      value: inbound.net_weight_kg != null
        ? inbound.net_weight_kg
        : inbound.gross_weight_kg != null && inbound.tare_weight_kg != null
          ? Number(inbound.gross_weight_kg) - Number(inbound.tare_weight_kg)
          : null,
      timestamp: inbound.confirmed_at,
      helper: inbound.gross_ticket || inbound.tare_ticket ? 'Calculated from weighbridge values' : null,
    },
  ];

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('Pfister Weighbridge', PAGE_MARGIN, sectionTop);

  weights.forEach((item, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + cardGap);
    drawWeightCard(doc, x, sectionTop + 20, cardWidth, item);
  });

  doc.y = sectionTop + 132;
}

function drawWeightCard(doc, x, y, width, item) {
  doc
    .roundedRect(x, y, width, 100, 10)
    .lineWidth(1)
    .fillAndStroke(item.label === 'Net Weight' ? '#ECFDF5' : '#F9FAFB', item.label === 'Net Weight' ? '#86EFAC' : '#D1D5DB');

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(item.label === 'Net Weight' ? '#047857' : '#4B5563')
    .text(item.label, x + 14, y + 14, { width: width - 28 });

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text(formatWeight(item.value), x + 14, y + 34, { width: width - 28 });

  const timestamp = item.timestamp ? formatDateTime(item.timestamp, true) : 'Not available yet';
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#374151')
    .text(timestamp, x + 14, y + 66, { width: width - 28 });

  const subText = item.overridden ? 'Manual override applied' : item.helper || 'Pfister reference';
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#6B7280')
    .text(subText, x + 14, y + 80, { width: width - 28 });
}

function drawWeighingSequence(doc, weighings) {
  doc.y += 10;
  ensurePageSpace(doc, 120);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('Weighing Sequence', PAGE_MARGIN, doc.y);

  const top = doc.y + 14;
  const columns = [
    { key: 'seq', label: 'Seq #', width: 52 },
    { key: 'weight', label: 'Weight (kg)', width: 100 },
    { key: 'type', label: 'Type', width: 110 },
    { key: 'ticket', label: 'Ticket #', width: 130 },
    { key: 'timestamp', label: 'Timestamp', width: CONTENT_WIDTH - 52 - 100 - 110 - 130 },
  ];

  drawTableHeader(doc, top, columns);

  let y = top + 28;

  if (!weighings.length) {
    doc
      .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 40, 8)
      .fill('#F9FAFB');
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6B7280')
      .text('No weighings recorded yet.', PAGE_MARGIN + 14, y + 14, {
        width: CONTENT_WIDTH - 28,
        align: 'center',
      });
    doc.y = y + 52;
    return;
  }

  weighings.forEach((weighing, index) => {
    const weighingType = weighing.sequence === 1
      ? 'Gross'
      : weighing.is_tare
        ? 'Tare'
        : 'Intermediate';

    const row = {
      seq: String(weighing.sequence),
      weight: formatWeightValue(weighing.weight_kg),
      type: weighingType,
      ticket: weighing.pfister_ticket?.ticket_number || '—',
      timestamp: formatDateTime(weighing.created_at, true),
    };

    const rowHeight = getTableRowHeight(doc, row, columns);
    if (y + rowHeight > doc.page.height - PAGE_MARGIN - 40) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawTableHeader(doc, y, columns);
      y += 28;
    }

    doc
      .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, rowHeight, 8)
      .fill(index % 2 === 0 ? '#FFFFFF' : '#F9FAFB');

    let x = PAGE_MARGIN;
    columns.forEach((column) => {
      doc
        .font(column.key === 'seq' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(String(row[column.key] || '—'), x + 10, y + 10, {
          width: column.width - 20,
        });
      x += column.width;
    });

    y += rowHeight + 6;
  });

  doc.y = y + 8;
}

function drawAssetsTable(doc, assets) {
  doc.y += 10;
  ensurePageSpace(doc, 120);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('Parcels', PAGE_MARGIN, doc.y);

  const top = doc.y + 14;
  const columns = [
    { key: 'asset_label', label: 'Parcel ID', width: 100 },
    { key: 'container_label', label: 'Container ID', width: 110 },
    { key: 'waste_stream', label: 'Waste Stream', width: CONTENT_WIDTH - 100 - 110 - 110 },
    { key: 'net', label: 'Net Weight (kg)', width: 110 },
  ];

  drawTableHeader(doc, top, columns);

  let y = top + 28;
  let totalNet = 0;

  if (!assets.length) {
    doc
      .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 40, 8)
      .fill('#F9FAFB');
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#6B7280')
      .text('No parcels recorded yet.', PAGE_MARGIN + 14, y + 14, {
        width: CONTENT_WIDTH - 28,
        align: 'center',
      });
    doc.y = y + 52;
    return;
  }

  assets.forEach((asset, index) => {
    const row = {
      asset_label: asset.asset_label || '—',
      container_label: asset.container_label || '—',
      waste_stream: asset.waste_stream ? `${asset.waste_stream.name_en} (${asset.waste_stream.code})` : '—',
      net: formatWeightValue(asset.net_weight_kg),
    };

    const rowHeight = getTableRowHeight(doc, row, columns);
    if (y + rowHeight > doc.page.height - PAGE_MARGIN - 40) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawTableHeader(doc, y, columns);
      y += 28;
    }

    doc
      .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, rowHeight, 8)
      .fill(index % 2 === 0 ? '#FFFFFF' : '#F9FAFB');

    let x = PAGE_MARGIN;
    columns.forEach((column) => {
      doc
        .font(column.key === 'asset_label' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(String(row[column.key] || '—'), x + 10, y + 10, {
          width: column.width - 20,
        });
      x += column.width;
    });

    totalNet += Number(asset.net_weight_kg) || 0;
    y += rowHeight + 6;
  });

  ensurePageSpace(doc, 42);

  doc
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 34, 8)
    .fill('#E5E7EB');

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#111827')
    .text('TOTALS', PAGE_MARGIN + 10, y + 12, { width: 120 });

  let totalColumnX = PAGE_MARGIN;
  columns.forEach((column) => {
    if (column.key === 'net') {
      doc.text(formatWeightValue(totalNet), totalColumnX + 10, y + 12, {
        width: column.width - 20,
        align: 'right',
      });
    }
    totalColumnX += column.width;
  });

  doc.y = y + 48;
}

function drawTableHeader(doc, y, columns) {
  doc
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 22, 8)
    .fill('#E5E7EB');

  let x = PAGE_MARGIN;
  columns.forEach((column) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#4B5563')
      .text(column.label.toUpperCase(), x + 10, y + 7, {
        width: column.width - 20,
      });
    x += column.width;
  });
}

function getTableRowHeight(doc, row, columns) {
  const heights = columns.map((column) => (
    doc.heightOfString(String(row[column.key] || '—'), {
      width: column.width - 20,
    })
  ));

  return Math.max(34, Math.ceil(Math.max(...heights)) + 18);
}

function drawFooter(doc, inbound) {
  ensurePageSpace(doc, 50);

  const confirmedBy = inbound.confirmed_by_user?.full_name || 'System';
  const confirmedAt = formatDateTime(inbound.confirmed_at || new Date(), true);
  const lineY = doc.y;
  const textY = lineY + 12;

  doc
    .moveTo(PAGE_MARGIN, lineY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, lineY)
    .lineWidth(1)
    .strokeColor('#E5E7EB')
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#6B7280')
    .text(`Confirmed by ${confirmedBy}`, PAGE_MARGIN, textY, {
      width: CONTENT_WIDTH / 2,
    });

  doc.text(`Generated ${confirmedAt}`, PAGE_MARGIN + CONTENT_WIDTH / 2, textY, {
    width: CONTENT_WIDTH / 2,
    align: 'right',
  });
}

function ensurePageSpace(doc, neededHeight) {
  if (doc.y + neededHeight <= doc.page.height - PAGE_MARGIN) {
    return;
  }

  doc.addPage();
  doc.y = PAGE_MARGIN;
}

function formatWeight(value) {
  if (value == null) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return `${numeric.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
}

function formatWeightValue(value) {
  if (value == null) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return numeric.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatDateTime(value, withSeconds = false) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const pad = (unit) => String(unit).padStart(2, '0');
  const datePart = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  const timePart = withSeconds
    ? `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return `${datePart} - ${timePart}`;
}

function formatEnumLabel(value) {
  if (!value) return '—';
  return String(value)
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

module.exports = { generateWeightTicket };
