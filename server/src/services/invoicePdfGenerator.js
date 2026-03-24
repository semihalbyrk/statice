const PDFDocument = require('pdfkit');
const prisma = require('../utils/prismaClient');

/* ───── A4 Page Constants ───── */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BOTTOM_LIMIT = PAGE_HEIGHT - 80;

/* ───── Colors (same as pdfReportGenerator.js) ───── */

const BRAND_GREEN = '#3ba935';
const HEADER_BG = '#F9FAFB';
const TEXT_PRIMARY = '#101828';
const TEXT_SECONDARY = '#475467';
const TEXT_TERTIARY = '#98A2B3';
const BORDER_COLOR = '#E4E7EC';
const ROW_ALT = '#F9FAFB';
const CONTAMINATION_BG = '#FEF3C7';

/* ───── Formatters ───── */

function formatDate(date) {
  if (!date) return '\u2014';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatEUR(amount) {
  return Number(amount).toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ───── Layout Helpers ───── */

function checkPageBreak(doc, neededHeight) {
  if (doc.y + neededHeight > BOTTOM_LIMIT) {
    doc.addPage();
    doc.y = MARGIN;
    return true;
  }
  return false;
}

function drawHorizontalLine(doc, y, width) {
  doc.moveTo(MARGIN, y)
    .lineTo(MARGIN + (width || CONTENT_WIDTH), y)
    .lineWidth(0.5)
    .strokeColor(BORDER_COLOR)
    .stroke();
}

/* ───── Async Data Fetch ───── */

async function fetchCompanyDetails() {
  let settings;
  try {
    settings = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
  } catch {
    settings = null;
  }

  return {
    facilityName: settings?.facility_name || 'Statice B.V.',
    facilityKvk: settings?.facility_kvk || '12040125',
    facilityAddress: settings?.facility_address || 'De Oude Kooien 15, 5986 PJ Beringe',
    footerText: settings?.report_footer_text || 'Statice B.V. \u2014 Confidential',
    btwId: settings?.config_json?.btw_id || 'NL808276426B01',
    iban: settings?.config_json?.iban || 'NL00ABNA0123456789',
    safe: settings?.config_json?.safe_nummer || 'NL00614708',
  };
}

/* ───── Section Renderers ───── */

function renderHeader(doc) {
  // Logo — green square with white "S"
  doc.save();
  doc.rect(MARGIN, MARGIN, 36, 36).fill(BRAND_GREEN);
  doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold')
    .text('S', MARGIN + 10, MARGIN + 9, { width: 16 });
  doc.restore();

  // Company name + subtitle
  doc.fontSize(10).fillColor(BRAND_GREEN).font('Helvetica-Bold')
    .text('STATICE B.V.', MARGIN + 44, MARGIN + 4);
  doc.fontSize(7).fillColor(TEXT_TERTIARY).font('Helvetica')
    .text('E-Waste Material Recovery Facility', MARGIN + 44, MARGIN + 18);

  // "INVOICE" title right-aligned
  doc.fontSize(20).fillColor(TEXT_PRIMARY).font('Helvetica-Bold')
    .text('INVOICE', MARGIN, MARGIN + 2, { width: CONTENT_WIDTH, align: 'right' });
}

function renderMetadata(doc, invoice) {
  const y = 110;
  doc.y = y;

  // Left column — invoice details
  const labelX = MARGIN;
  const valueX = MARGIN + 90;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_SECONDARY);
  doc.text('Invoice Number:', labelX, y);
  doc.font('Helvetica').fillColor(TEXT_PRIMARY);
  doc.text(invoice.invoice_number, valueX, y);

  doc.font('Helvetica-Bold').fillColor(TEXT_SECONDARY);
  doc.text('Invoice Date:', labelX, y + 16);
  doc.font('Helvetica').fillColor(TEXT_PRIMARY);
  doc.text(formatDate(invoice.invoice_date), valueX, y + 16);

  doc.font('Helvetica-Bold').fillColor(TEXT_SECONDARY);
  doc.text('Due Date:', labelX, y + 32);
  doc.font('Helvetica').fillColor(TEXT_PRIMARY);
  doc.text(formatDate(invoice.due_date), valueX, y + 32);

  doc.font('Helvetica-Bold').fillColor(TEXT_SECONDARY);
  doc.text('Currency:', labelX, y + 48);
  doc.font('Helvetica').fillColor(TEXT_PRIMARY);
  doc.text(invoice.currency || 'EUR', valueX, y + 48);

  // Right column — recipient
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 20;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_SECONDARY);
  doc.text('INVOICE TO:', rightX, y);

  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEXT_PRIMARY);
  doc.text(invoice.supplier?.name || invoice.recipient_name || '\u2014', rightX, y + 16);

  doc.fontSize(8).font('Helvetica').fillColor(TEXT_PRIMARY);
  const address = invoice.supplier?.address || invoice.recipient_address || '';
  if (address) {
    doc.text(address, rightX, y + 30, { width: CONTENT_WIDTH / 2 - 20 });
  }

  let recipientY = y + (address ? 44 : 30);
  const kvk = invoice.supplier?.kvk_number;
  if (kvk) {
    doc.text(`KvK: ${kvk}`, rightX, recipientY);
    recipientY += 14;
  }
  const btw = invoice.supplier?.btw_number;
  if (btw) {
    doc.text(`BTW-id: ${btw}`, rightX, recipientY);
  }
}

function renderCompanyBar(doc, company) {
  const { facilityName, facilityKvk, facilityAddress, btwId, iban, safe } = company;

  const y = 210;
  doc.y = y;

  // Gray background bar
  doc.save();
  doc.rect(MARGIN, y, CONTENT_WIDTH, 24).fill(HEADER_BG);
  doc.restore();

  doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_SECONDARY);
  const parts = [
    facilityName,
    `Adres: ${facilityAddress}`,
    `KvK: ${facilityKvk}`,
    `BTW-id: ${btwId}`,
    `IBAN: ${iban}`,
    `SAFE: ${safe}`,
  ];
  doc.text(parts.join('  |  '), MARGIN + 6, y + 7, {
    width: CONTENT_WIDTH - 12,
    align: 'center',
  });

  doc.y = y + 32;
}

function renderLineItemsTable(doc, lines) {
  const colWidths = [25, 180, 55, 35, 65, 45, 90]; // total 495
  const rowHeight = 17;
  const headerLabels = ['#', 'Description', 'Qty', 'Unit', 'Rate (\u20AC)', 'BTW%', 'Subtotal (\u20AC)'];
  const tableWidth = colWidths.reduce((s, w) => s + w, 0);
  const tableLeft = MARGIN;

  function drawRow(cells, y, opts = {}) {
    const { bold, bg, isHeader } = opts;

    if (bg) {
      doc.save();
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill(bg);
      doc.restore();
    }

    doc.fontSize(7).font(bold ? 'Helvetica-Bold' : 'Helvetica');

    let x = tableLeft;
    for (let i = 0; i < cells.length; i++) {
      // # and Description left-aligned, rest right-aligned
      const align = i <= 1 ? 'left' : 'right';
      doc.fillColor(isHeader ? TEXT_SECONDARY : TEXT_PRIMARY)
        .text(String(cells[i] ?? ''), x + 4, y + 4, {
          width: colWidths[i] - 8,
          align,
          lineBreak: false,
        });
      x += colWidths[i];
    }

    return y + rowHeight;
  }

  // Header row
  checkPageBreak(doc, rowHeight * 2);
  let y = doc.y;
  y = drawRow(headerLabels, y, { bold: true, bg: HEADER_BG, isHeader: true });

  // Header bottom border
  doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
    .lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();

  // Data rows
  for (let r = 0; r < lines.length; r++) {
    checkPageBreak(doc, rowHeight);
    y = doc.y > y ? doc.y : y;

    const line = lines[r];
    const isContamination = line.line_type === 'contamination_fee';

    let bg;
    if (isContamination) {
      bg = CONTAMINATION_BG;
    } else if (r % 2 === 1) {
      bg = ROW_ALT;
    }

    const cells = [
      r + 1,
      line.description || '\u2014',
      formatEUR(Number(line.quantity)),
      line.unit || 'kg',
      formatEUR(Number(line.unit_rate)),
      Number(line.btw_rate).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + '%',
      formatEUR(Number(line.line_subtotal)),
    ];

    y = drawRow(cells, y, { bg });
  }

  // Table bottom border
  doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y)
    .lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();

  doc.y = y + 6;
}

function renderBtwSummary(doc, lines) {
  // Group lines by btw_rate
  const groups = {};
  for (const line of lines) {
    const rate = Number(line.btw_rate);
    if (!groups[rate]) {
      groups[rate] = { subtotal: 0, btwAmount: 0 };
    }
    groups[rate].subtotal += Number(line.line_subtotal);
    groups[rate].btwAmount += Number(line.btw_amount);
  }

  const rates = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
  if (rates.length === 0) return;

  checkPageBreak(doc, 14 * rates.length + 20);

  doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_PRIMARY);
  doc.text('BTW Summary', MARGIN, doc.y);
  doc.y += 4;

  doc.fontSize(7).font('Helvetica').fillColor(TEXT_SECONDARY);
  for (const rate of rates) {
    const g = groups[rate];
    const rateStr = Number(rate).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    doc.text(`BTW ${rateStr}%: \u20AC${formatEUR(g.subtotal)} \u2192 \u20AC${formatEUR(g.btwAmount)}`, MARGIN, doc.y);
    doc.y += 12;
  }

  doc.y += 4;
}

function renderTotals(doc, invoice) {
  checkPageBreak(doc, 70);

  const rightEdge = MARGIN + CONTENT_WIDTH;
  const labelX = rightEdge - 200;
  const valueX = rightEdge - 95;
  const valueWidth = 95;

  drawHorizontalLine(doc, doc.y);
  doc.y += 8;

  // Subtotal excl. BTW
  doc.fontSize(8).font('Helvetica').fillColor(TEXT_SECONDARY);
  doc.text('Subtotaal excl. BTW:', labelX, doc.y, { width: 100, align: 'right' });
  doc.fillColor(TEXT_PRIMARY);
  doc.text(`\u20AC${formatEUR(Number(invoice.subtotal))}`, valueX, doc.y, { width: valueWidth, align: 'right' });
  doc.y += 16;

  // BTW Total
  doc.fontSize(8).font('Helvetica').fillColor(TEXT_SECONDARY);
  doc.text('BTW Totaal:', labelX, doc.y, { width: 100, align: 'right' });
  doc.fillColor(TEXT_PRIMARY);
  doc.text(`\u20AC${formatEUR(Number(invoice.btw_total))}`, valueX, doc.y, { width: valueWidth, align: 'right' });
  doc.y += 16;

  // Green separator line
  doc.moveTo(labelX, doc.y).lineTo(rightEdge, doc.y)
    .lineWidth(1).strokeColor(BRAND_GREEN).stroke();
  doc.y += 8;

  // Total incl. BTW (bold, larger)
  doc.fontSize(11).font('Helvetica-Bold').fillColor(TEXT_PRIMARY);
  doc.text('Totaal incl. BTW:', labelX, doc.y, { width: 100, align: 'right' });
  doc.text(`\u20AC${formatEUR(Number(invoice.total_amount))}`, valueX, doc.y, { width: valueWidth, align: 'right' });

  doc.y += 24;
}

function renderPaymentInfo(doc, invoice, iban) {
  checkPageBreak(doc, 50);

  drawHorizontalLine(doc, doc.y);
  doc.y += 10;

  doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_PRIMARY);
  doc.text('Betalingsinformatie', MARGIN, doc.y);
  doc.y += 14;

  doc.fontSize(8).font('Helvetica').fillColor(TEXT_SECONDARY);
  const totalStr = formatEUR(Number(invoice.total_amount));
  const dueStr = formatDate(invoice.due_date);
  doc.text(
    `Gelieve \u20AC${totalStr} over te maken naar IBAN ${iban} v\u00F3\u00F3r ${dueStr}.`,
    MARGIN, doc.y, { width: CONTENT_WIDTH }
  );
  doc.y += 14;
  doc.text(`Referentie: ${invoice.invoice_number}`, MARGIN, doc.y);
}

function renderFooter(doc, footerText) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);
    doc.save();

    const y = PAGE_HEIGHT - 40;
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y)
      .lineWidth(0.3).strokeColor(BORDER_COLOR).stroke();

    doc.fontSize(7).fillColor(TEXT_TERTIARY).font('Helvetica');
    doc.text(footerText, MARGIN, y + 6);
    doc.text(`Pagina ${i + 1} / ${totalPages}`, MARGIN, y + 6, {
      width: CONTENT_WIDTH,
      align: 'right',
    });

    doc.restore();
  }
}

/* ───── Main Export ───── */

async function generateInvoicePDFBuffer(invoice) {
  // Pre-fetch async data before starting the synchronous PDF stream
  const company = await fetchCompanyDetails();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    try {
      // 1. Header
      renderHeader(doc);

      // 2. Invoice metadata (number, dates, recipient)
      renderMetadata(doc, invoice);

      // 3. Company details bar (KvK, BTW-id, IBAN, SAFE)
      renderCompanyBar(doc, company);

      // 4. Line items table
      const lines = invoice.lines || [];
      renderLineItemsTable(doc, lines);

      // 5. BTW summary by rate
      renderBtwSummary(doc, lines);

      // 6. Totals block (subtotal, BTW, total)
      renderTotals(doc, invoice);

      // 7. Payment information
      renderPaymentInfo(doc, invoice, company.iban);

      // 8. Footer (page numbers + confidential text)
      renderFooter(doc, company.footerText);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDFBuffer };
