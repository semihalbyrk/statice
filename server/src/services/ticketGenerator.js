const PDFDocument = require('pdfkit');
const prisma = require('../utils/prismaClient');

/**
 * Generate a digital weight ticket PDF for a confirmed weighing event.
 *
 * @param {string} weighingEventId
 * @returns {Promise<Buffer>} PDF as a Buffer
 */
async function generateWeightTicket(weighingEventId) {
  const event = await prisma.weighingEvent.findUnique({
    where: { id: weighingEventId },
    include: {
      order: {
        include: {
          carrier: true,
          supplier: true,
          waste_stream: true,
        },
      },
      vehicle: true,
      gross_ticket: true,
      tare_ticket: true,
      assets: {
        include: { material_category: true },
        orderBy: { created_at: 'asc' },
      },
      confirmed_by_user: { select: { full_name: true } },
    },
  });

  if (!event) {
    const err = new Error('Weighing event not found');
    err.statusCode = 404;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // margin * 2

    // ── Header ──
    doc.fontSize(18).font('Helvetica-Bold').text('STATICE B.V.', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('Industrieweg 12, 5683 CC Best, Netherlands', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('DIGITAL WEIGHT TICKET', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Ticket #: WE-${event.id.slice(0, 8).toUpperCase()}`, { align: 'center' });
    doc.moveDown(0.8);

    // ── Warning Banner ──
    const bannerY = doc.y;
    doc.rect(50, bannerY, pageWidth, 28).fill('#FF8C00');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('SIMULATED WEIGHING DATA — NOT FOR REGULATORY USE', 50, bannerY + 8, { align: 'center', width: pageWidth });
    doc.fillColor('#000000');
    doc.y = bannerY + 38;

    // ── Order Details Grid ──
    doc.fontSize(11).font('Helvetica-Bold').text('Order Details');
    doc.moveDown(0.3);

    const details = [
      ['Order Number', event.order.order_number],
      ['Vehicle Plate', event.vehicle.registration_plate],
      ['Carrier', event.order.carrier.name],
      ['Supplier', event.order.supplier.name],
      ['Waste Stream', `${event.order.waste_stream.name_en} (${event.order.waste_stream.code})`],
      ['Planned Date', formatDate(event.order.planned_date)],
      ['Arrived At', formatDate(event.arrived_at)],
    ];

    doc.fontSize(9).font('Helvetica');
    const col1X = 50;
    const col2X = 170;
    const col3X = 310;
    const col4X = 430;

    for (let i = 0; i < details.length; i += 2) {
      const y = doc.y;
      doc.font('Helvetica-Bold').text(details[i][0] + ':', col1X, y, { width: 120 });
      doc.font('Helvetica').text(details[i][1], col2X, y, { width: 130 });
      if (details[i + 1]) {
        doc.font('Helvetica-Bold').text(details[i + 1][0] + ':', col3X, y, { width: 120 });
        doc.font('Helvetica').text(details[i + 1][1], col4X, y, { width: 120 });
      }
      doc.y = y + 16;
    }
    doc.moveDown(0.8);

    // ── Weight Summary Box ──
    const boxY = doc.y;
    doc.rect(50, boxY, pageWidth, 70).lineWidth(1.5).stroke('#333333');

    const grossKg = Number(event.gross_weight_kg) || 0;
    const tareKg = Number(event.tare_weight_kg) || 0;
    const netKg = Number(event.net_weight_kg) || 0;

    const thirdW = pageWidth / 3;
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text('Gross Weight', 50, boxY + 10, { width: thirdW, align: 'center' });
    doc.text('Tare Weight', 50 + thirdW, boxY + 10, { width: thirdW, align: 'center' });
    doc.text('Net Weight', 50 + thirdW * 2, boxY + 10, { width: thirdW, align: 'center' });

    doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold');
    doc.text(`${grossKg.toLocaleString()} kg`, 50, boxY + 28, { width: thirdW, align: 'center' });
    doc.text(`${tareKg.toLocaleString()} kg`, 50 + thirdW, boxY + 28, { width: thirdW, align: 'center' });
    doc.fontSize(18).text(`${netKg.toLocaleString()} kg`, 50 + thirdW * 2, boxY + 26, { width: thirdW, align: 'center' });

    doc.y = boxY + 80;

    // ── Skip/Asset Table ──
    if (event.assets.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Skips / Assets');
      doc.moveDown(0.3);

      const tableHeaders = ['Asset Label', 'Type', 'Category', 'Gross (kg)', 'Tare (kg)', 'Net (kg)'];
      const colWidths = [100, 70, 120, 70, 70, 70];
      const startX = 50;

      // Header row
      let x = startX;
      const headerY = doc.y;
      doc.rect(startX, headerY, pageWidth, 18).fill('#EEEEEE');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
      tableHeaders.forEach((h, i) => {
        doc.text(h, x + 4, headerY + 5, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      doc.y = headerY + 20;

      // Data rows
      doc.font('Helvetica').fontSize(8).fillColor('#000000');
      let totalGross = 0, totalTare = 0, totalNet = 0;

      event.assets.forEach((asset) => {
        x = startX;
        const rowY = doc.y;
        const aGross = Number(asset.gross_weight_kg) || 0;
        const aTare = Number(asset.tare_weight_kg) || 0;
        const aNet = Number(asset.net_weight_kg) || 0;
        totalGross += aGross;
        totalTare += aTare;
        totalNet += aNet;

        const rowData = [
          asset.asset_label,
          asset.skip_type.replace(/_/g, ' '),
          asset.material_category?.code_cbs || '—',
          aGross.toFixed(1),
          aTare.toFixed(1),
          aNet.toFixed(1),
        ];

        rowData.forEach((val, i) => {
          doc.text(val, x + 4, rowY, { width: colWidths[i] - 8 });
          x += colWidths[i];
        });
        doc.y = rowY + 14;
      });

      // Totals row
      x = startX;
      const totY = doc.y;
      doc.rect(startX, totY, pageWidth, 16).fill('#F5F5F5');
      doc.font('Helvetica-Bold').fillColor('#000000');
      doc.text('TOTALS', x + 4, totY + 4, { width: colWidths[0] - 8 });
      x += colWidths[0] + colWidths[1] + colWidths[2];
      doc.text(totalGross.toFixed(1), x + 4, totY + 4, { width: colWidths[3] - 8 });
      x += colWidths[3];
      doc.text(totalTare.toFixed(1), x + 4, totY + 4, { width: colWidths[4] - 8 });
      x += colWidths[4];
      doc.text(totalNet.toFixed(1), x + 4, totY + 4, { width: colWidths[5] - 8 });
      doc.y = totY + 24;
    }

    // ── Pfister References ──
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('Pfister Weighbridge References');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(8);
    if (event.gross_ticket) {
      doc.text(`Gross: ${event.gross_ticket.ticket_number}  |  ${formatDate(event.gross_ticket.timestamp)}  |  ${Number(event.gross_ticket.weight_kg)} kg${event.gross_ticket.is_manual_override ? ' (OVERRIDDEN)' : ''}`);
    }
    if (event.tare_ticket) {
      doc.text(`Tare:  ${event.tare_ticket.ticket_number}  |  ${formatDate(event.tare_ticket.timestamp)}  |  ${Number(event.tare_ticket.weight_kg)} kg${event.tare_ticket.is_manual_override ? ' (OVERRIDDEN)' : ''}`);
    }

    // ── Footer ──
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#999999').font('Helvetica');
    const confirmedBy = event.confirmed_by_user?.full_name || 'System';
    const confirmedAt = event.confirmed_at ? formatDate(event.confirmed_at) : 'N/A';
    doc.text(`Confirmed by: ${confirmedBy} on ${confirmedAt}`, { align: 'center' });
    doc.text(`Generated: ${formatDate(new Date())}`, { align: 'center' });

    doc.end();
  });
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

module.exports = { generateWeightTicket };
