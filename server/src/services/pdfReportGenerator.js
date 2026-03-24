const PDFDocument = require('pdfkit');
const fs = require('fs');

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BOTTOM_LIMIT = PAGE_HEIGHT - 80;

const BRAND_GREEN = '#3ba935';
const HEADER_BG = '#F9FAFB';
const TEXT_PRIMARY = '#101828';
const TEXT_SECONDARY = '#475467';
const TEXT_TERTIARY = '#98A2B3';
const BORDER_COLOR = '#E4E7EC';
const ROW_ALT = '#F9FAFB';

function formatWeight(kg) {
  if (kg == null || isNaN(kg)) return '0 kg';
  return Number(kg).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' kg';
}

function formatPct(pct) {
  if (pct == null || isNaN(pct)) return '0.00%';
  return Number(pct).toFixed(2) + '%';
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ───── Shared Helpers ───── */

function addPageHeader(doc, { title, subtitle, generatedBy, generatedAt, period }) {
  // Logo placeholder
  doc.save();
  doc.rect(MARGIN, MARGIN, 36, 36).fill(BRAND_GREEN);
  doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold').text('S', MARGIN + 10, MARGIN + 9, { width: 16 });
  doc.restore();

  doc.fontSize(10).fillColor(BRAND_GREEN).font('Helvetica-Bold')
    .text('STATICE B.V.', MARGIN + 44, MARGIN + 4);
  doc.fontSize(7).fillColor(TEXT_TERTIARY).font('Helvetica')
    .text('E-Waste Material Recovery Facility', MARGIN + 44, MARGIN + 18);

  // Title right-aligned
  doc.fontSize(16).fillColor(TEXT_PRIMARY).font('Helvetica-Bold')
    .text(title, MARGIN, MARGIN + 2, { width: CONTENT_WIDTH, align: 'right' });
  if (subtitle) {
    doc.fontSize(9).fillColor(TEXT_SECONDARY).font('Helvetica')
      .text(subtitle, MARGIN, doc.y + 2, { width: CONTENT_WIDTH, align: 'right' });
  }

  doc.y = MARGIN + 44;
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();
  doc.y += 8;

  // Info row
  const infoY = doc.y;
  doc.fontSize(7).fillColor(TEXT_SECONDARY).font('Helvetica');
  doc.text('Facility: Statice B.V. | Permit: ST-2026-001', MARGIN, infoY);
  doc.text(`Generated: ${formatDateTime(generatedAt || new Date())} | By: ${generatedBy || 'System'}`, MARGIN, infoY, { width: CONTENT_WIDTH, align: 'right' });

  if (period) {
    doc.y = infoY + 12;
    doc.text(`Period: ${formatDate(period.from)} — ${formatDate(period.to)}`, MARGIN, doc.y);
  }

  doc.y += 16;
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).lineWidth(0.5).strokeColor(BORDER_COLOR).stroke();
  doc.y += 12;
}

function addPageFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    const y = PAGE_HEIGHT - 40;
    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.3).strokeColor(BORDER_COLOR).stroke();
    doc.fontSize(7).fillColor(TEXT_TERTIARY).font('Helvetica');
    doc.text('Statice B.V. — Confidential', MARGIN, y + 6);
    doc.text(`Page ${i + 1} of ${range.count}`, MARGIN, y + 6, { width: CONTENT_WIDTH, align: 'right' });

    // Simulation notice
    doc.fontSize(6).fillColor('#DC2626').font('Helvetica-Bold');
    doc.text('SIMULATED WEIGHING DATA — NOT FOR REGULATORY USE', MARGIN, y + 18, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
  }
}

function checkPageBreak(doc, neededHeight) {
  if (doc.y + neededHeight > BOTTOM_LIMIT) {
    doc.addPage();
    doc.y = MARGIN;
    return true;
  }
  return false;
}

function addTable(doc, { headers, rows, columnWidths, fontSize = 7 }) {
  const colWidths = columnWidths || headers.map(() => CONTENT_WIDTH / headers.length);
  const rowHeight = fontSize + 10;

  function drawRow(cells, y, opts = {}) {
    const { bold, bg, isHeader } = opts;
    if (bg) {
      doc.save();
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(bg);
      doc.restore();
    }
    doc.fontSize(fontSize).font(bold ? 'Helvetica-Bold' : 'Helvetica');

    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const align = i === 0 ? 'left' : 'right';
      doc.fillColor(isHeader ? TEXT_SECONDARY : TEXT_PRIMARY)
        .text(String(cells[i] ?? ''), x + 4, y + 4, { width: colWidths[i] - 8, align, lineBreak: false });
      x += colWidths[i];
    }
    return y + rowHeight;
  }

  // Header
  checkPageBreak(doc, rowHeight * 2);
  let y = doc.y;
  y = drawRow(headers, y, { bold: true, bg: HEADER_BG, isHeader: true });

  // Rows
  for (let r = 0; r < rows.length; r++) {
    checkPageBreak(doc, rowHeight);
    y = doc.y > y ? doc.y : y;
    const bg = r % 2 === 1 ? ROW_ALT : null;
    const bold = rows[r]._bold;
    y = drawRow(rows[r], y, { bg, bold });
  }

  doc.y = y + 4;
}

function addSectionTitle(doc, text) {
  checkPageBreak(doc, 30);
  doc.fontSize(11).fillColor(TEXT_PRIMARY).font('Helvetica-Bold').text(text, MARGIN, doc.y);
  doc.y += 6;
}

function addSubtitle(doc, text) {
  doc.fontSize(8).fillColor(TEXT_SECONDARY).font('Helvetica').text(text, MARGIN, doc.y);
  doc.y += 4;
}

function createPdf(filePath) {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  return { doc, stream };
}

function finalizePdf(doc, stream) {
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    addPageFooter(doc);
    doc.end();
  });
}

/* ───── RPT-01: Supplier / Client Circularity Statement ───── */

async function generateSupplierStatementPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  addPageHeader(doc, {
    title: 'CIRCULARITY STATEMENT',
    subtitle: 'EU WEEE Directive — Material Recovery Declaration',
    generatedBy: user?.full_name,
    generatedAt: new Date(),
    period: data.period,
  });

  // Supplier details
  addSectionTitle(doc, 'Supplier Details');
  doc.fontSize(8).fillColor(TEXT_PRIMARY).font('Helvetica');
  doc.text(`Name: ${data.supplier.name}`, MARGIN, doc.y);
  if (data.supplier.kvk_number) doc.text(`KvK Number: ${data.supplier.kvk_number}`);
  if (data.supplier.contact_name) doc.text(`Contact: ${data.supplier.contact_name}`);
  doc.y += 8;

  addSectionTitle(doc, 'Facility Details');
  doc.fontSize(8).fillColor(TEXT_PRIMARY).font('Helvetica');
  doc.text('Statice B.V. — E-Waste Material Recovery Facility', MARGIN, doc.y);
  doc.text('Permit Number: ST-2026-001');
  doc.y += 12;

  // Orders summary table
  addSectionTitle(doc, 'Orders Summary');
  const orderHeaders = ['Order Ref', 'Delivery Date', 'Carrier', 'Vehicle', 'Net Weight (kg)'];
  const orderWidths = [90, 80, 100, 90, 100];
  const orderRows = data.orders.map((o) => [
    o.orderNumber,
    formatDate(o.plannedDate),
    o.carrierName,
    (o.vehiclePlates || []).join(', '),
    formatWeight(o.netWeightKg),
  ]);
  // Totals row
  const totalNet = data.orders.reduce((s, o) => s + (o.netWeightKg || 0), 0);
  const totalsRow = ['TOTAL', '', '', '', formatWeight(totalNet)];
  totalsRow._bold = true;
  orderRows.push(totalsRow);

  addTable(doc, { headers: orderHeaders, rows: orderRows, columnWidths: orderWidths });
  doc.y += 8;

  // Category detail table
  addSectionTitle(doc, 'Product Category Detail');
  const catHeaders = ['CBS Code', 'Category', 'Net (kg)', 'Recycled %', 'Reused %', 'Disposed %', 'Landfill %', 'Processor'];
  const catWidths = [55, 90, 60, 50, 50, 50, 50, 90];
  const catRows = data.categories.map((c) => [
    c.codeCbs,
    c.descriptionEn,
    formatWeight(c.totalNetWeightKg),
    formatPct(c.weightedAvgRecycledPct),
    formatPct(c.weightedAvgReusedPct),
    formatPct(c.weightedAvgDisposedPct),
    formatPct(c.weightedAvgLandfillPct),
    c.downstreamProcessors.join(', ') || '—',
  ]);
  const catTotals = [
    'TOTAL', '',
    formatWeight(data.totals.totalNetWeightKg),
    formatPct(data.totals.weightedAvgRecycledPct),
    formatPct(data.totals.weightedAvgReusedPct),
    formatPct(data.totals.weightedAvgDisposedPct),
    formatPct(data.totals.weightedAvgLandfillPct),
    '',
  ];
  catTotals._bold = true;
  catRows.push(catTotals);

  addTable(doc, { headers: catHeaders, rows: catRows, columnWidths: catWidths, fontSize: 6.5 });
  doc.y += 16;

  // Signature block
  checkPageBreak(doc, 100);
  addSectionTitle(doc, 'Authorisation');
  doc.fontSize(8).fillColor(TEXT_PRIMARY).font('Helvetica');
  const sigFields = ['Authorised by:', 'Name:', 'Title:', 'Date:'];
  for (const field of sigFields) {
    doc.text(`${field} ________________________`, MARGIN, doc.y);
    doc.y += 4;
  }
  doc.y += 4;
  doc.fontSize(7).fillColor(TEXT_SECONDARY).text('On behalf of Statice B.V.', MARGIN, doc.y);

  await finalizePdf(doc, stream);
}

/* ───── RPT-02: Material Recovery Summary ───── */

async function generateMaterialRecoveryPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  addPageHeader(doc, {
    title: 'Material Recovery Summary',
    generatedBy: user?.full_name,
    generatedAt: new Date(),
    period: data.period,
  });

  addSectionTitle(doc, 'Recovery by Product Category');
  const headers = ['CBS Code', 'Category', 'Inbound (kg)', 'Recycled (kg)', 'Recycled %', 'Reused (kg)', 'Reused %', 'Disposed (kg)', 'Disposed %'];
  const widths = [45, 80, 55, 50, 45, 50, 45, 50, 45];
  const rows = data.categories.map((c) => [
    c.codeCbs, c.descriptionEn,
    formatWeight(c.totalInboundKg),
    formatWeight(c.recycledKg), formatPct(c.recycledPct),
    formatWeight(c.reusedKg), formatPct(c.reusedPct),
    formatWeight(c.disposedKg), formatPct(c.disposedPct),
  ]);
  const totals = [
    'TOTAL', '',
    formatWeight(data.totals.totalInboundKg),
    formatWeight(data.totals.recycledKg), formatPct(data.totals.recycledPct),
    formatWeight(data.totals.reusedKg), formatPct(data.totals.reusedPct),
    formatWeight(data.totals.disposedKg), formatPct(data.totals.disposedPct),
  ];
  totals._bold = true;
  rows.push(totals);
  addTable(doc, { headers, rows, columnWidths: widths, fontSize: 6 });

  // Comparison with prior period
  if (data.priorCategories && data.priorTotals) {
    doc.y += 12;
    addSectionTitle(doc, 'Comparison with Prior Period');
    addSubtitle(doc, `Prior: ${formatDate(data.priorPeriod?.from)} — ${formatDate(data.priorPeriod?.to)}`);

    const compHeaders = ['Category', 'Current (kg)', 'Prior (kg)', 'Change (kg)', 'Change %'];
    const compWidths = [120, 90, 90, 90, 90];
    const compRows = data.categories.map((c) => {
      const prior = data.priorCategories.find((p) => p.categoryId === c.categoryId);
      const priorKg = prior ? prior.totalInboundKg : 0;
      const change = c.totalInboundKg - priorKg;
      const changePct = priorKg > 0 ? ((change / priorKg) * 100).toFixed(1) + '%' : '—';
      return [c.descriptionEn, formatWeight(c.totalInboundKg), formatWeight(priorKg), formatWeight(change), changePct];
    });
    addTable(doc, { headers: compHeaders, rows: compRows, columnWidths: compWidths });
  }

  await finalizePdf(doc, stream);
}

/* ───── RPT-07: Downstream Material Statement ───── */

async function generateDownstreamStatementPDF(data, filePath) {
  // Landscape A4 to fit all 11 fraction columns
  const LW = PAGE_HEIGHT; // 841.89 landscape width
  const LH = PAGE_WIDTH;  // 595.28 landscape height
  const LM = 40; // margin
  const LCW = LW - 2 * LM; // content width ~762
  const LBL = LH - 60; // bottom limit

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: LM });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const LIGHT_BLUE = '#D9E7F5';
  const DARK_BLUE = '#5E99D0';
  const CB = '#000000'; // cell border
  const ROWS_PER_PAGE = 8;

  function nlPct(v) { return (Number(v) || 0).toFixed(2).replace('.', ',') + '%'; }
  function nlPct1(v) { return (Number(v) || 0).toFixed(1).replace('.', ',') + '%'; }
  function nlNum(v) { return Number(v || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 }); }
  function formatDownstreamDate(date) {
    if (!date) return '—';
    const d = new Date(date);
    return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
  }

  function cell(x, y, w, h, text, opts = {}) {
    if (opts.fill) { doc.save(); doc.rect(x, y, w, h).fill(opts.fill); doc.restore(); }
    if (opts.stroke !== false) {
      doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(CB).stroke();
    }
    const fontSize = opts.fontSize || 9;
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const paddingX = opts.paddingX ?? 3;
    const paddingY = opts.paddingY ?? 3;
    const width = w - (paddingX * 2);
    const align = opts.align || 'left';

    doc.font(font).fontSize(fontSize).fillColor(opts.color || TEXT_PRIMARY);
    const textOptions = { width, align };
    const textHeight = opts.valign === 'center'
      ? doc.heightOfString(String(text || ''), textOptions)
      : fontSize;
    const textY = opts.valign === 'center'
      ? y + Math.max(paddingY, (h - textHeight) / 2)
      : y + paddingY;

    doc.save();
    doc.rect(x + 1, y + 1, w - 2, h - 2).clip();
    doc.font(font).fontSize(fontSize).fillColor(opts.color || TEXT_PRIMARY)
      .text(String(text || ''), x + paddingX, textY, {
        width,
        height: h - (paddingY * 2),
        align,
        underline: opts.underline,
        link: opts.link,
      });
    doc.restore();
  }

  function drawTextHighlight(x, y, w, h, text, opts = {}) {
    const fontSize = opts.fontSize || 9;
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const paddingX = 6;
    const highlightPadX = 3;
    const highlightPadY = 1;

    doc.font(font).fontSize(fontSize);
    const textWidth = Math.min(doc.widthOfString(String(text || '')), w - (paddingX * 2) - (highlightPadX * 2));
    const lineHeight = doc.currentLineHeight();
    const highlightWidth = Math.min(w - (paddingX * 2), textWidth + (highlightPadX * 2));
    let highlightX = x + paddingX;
    if ((opts.align || 'center') === 'center') {
      highlightX = x + (w - highlightWidth) / 2;
    } else if ((opts.align || 'center') === 'right') {
      highlightX = x + w - paddingX - highlightWidth;
    }
    const highlightY = y + (h - lineHeight) / 2 - highlightPadY + 1;

    doc.save();
    doc.rect(highlightX, highlightY, highlightWidth, lineHeight + (highlightPadY * 2)).fill(opts.fill || LIGHT_BLUE);
    doc.restore();
    doc.font(font).fontSize(fontSize).fillColor(opts.color || TEXT_PRIMARY)
      .text(String(text || ''), x + paddingX, y + (h - lineHeight) / 2 + 1, {
        width: w - (paddingX * 2),
        align: opts.align || 'center',
        lineBreak: false,
      });
  }

  doc.save();
  doc.rect(0, 0, LW, LH).fill('#FFFFFF');
  doc.restore();

  // === TITLE BOX ===
  const titleH = 30;
  doc.rect(LM, LM, LCW, titleH).lineWidth(0.5).strokeColor(CB).stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TEXT_PRIMARY)
    .text('FORM DOWNSTREAM MONITORING PROCESSING RECEIVED WASTE OF ELECTRIC AND ELECTRONIC EQUIPMENT AND COMPONENTS',
      LM + 6, LM + 9, { width: LCW - 12, align: 'center' });

  let cy = LM + titleH + 6;

  // === CONTACT + LOGO BLOCK ===
  const contactBlockH = 74;
  const contactBlockW = 292;
  const contactHeaderH = 22;
  const contactLabelW = 60;
  const contactRowH = 14;
  const contactValueW = contactBlockW - contactLabelW;
  const logoX = LM + contactBlockW;
  const logoW = LCW - contactBlockW;

  doc.rect(LM, cy, LCW, contactBlockH).lineWidth(0.5).strokeColor(CB).stroke();
  doc.moveTo(logoX, cy).lineTo(logoX, cy + contactBlockH).lineWidth(0.5).strokeColor(CB).stroke();
  cell(LM, cy, contactBlockW, contactHeaderH, 'For further questions please contact:', {
    fill: LIGHT_BLUE,
    fontSize: 7.5,
    align: 'center',
    valign: 'center',
  });

  const contactStartY = cy + contactHeaderH;
  cell(LM, contactStartY, contactLabelW, contactRowH, 'email', {
    fontSize: 7.5,
    align: 'right',
    valign: 'center',
  });
  cell(LM + contactLabelW, contactStartY, contactValueW, contactRowH, 'office@statice.eu', {
    fontSize: 7.5,
    color: '#0000EE',
    align: 'right',
    valign: 'center',
    underline: true,
    link: 'mailto:office@statice.eu',
  });
  cell(LM, contactStartY + contactRowH, contactLabelW, contactRowH, 'name', {
    fontSize: 7.5,
    align: 'right',
    valign: 'center',
  });
  cell(LM + contactLabelW, contactStartY + contactRowH, contactValueW, contactRowH, 'Rob den Mulder', {
    fontSize: 7.5,
    align: 'right',
    valign: 'center',
  });
  cell(LM, contactStartY + (contactRowH * 2), contactLabelW, contactRowH, 'Tel:', {
    fontSize: 7.5,
    align: 'right',
    valign: 'center',
  });
  cell(LM + contactLabelW, contactStartY + (contactRowH * 2), contactValueW, contactRowH, '+31-77-306 06 88', {
    fontSize: 7.5,
    align: 'right',
    valign: 'center',
  });

  // Logo (right side, vertically centered inside the shared block)
  try {
    const dsLogoPath = require('path').resolve(__dirname, '../../../docs/Statice_Downstream_Report_Logo.png');
    const fallbackLogoPath = require('path').resolve(__dirname, '../../../docs/logo-statice-elektronica-recycling.png');
    const logoFile = require('fs').existsSync(dsLogoPath) ? dsLogoPath : require('fs').existsSync(fallbackLogoPath) ? fallbackLogoPath : null;
    if (logoFile) {
      const logoFitW = 260;
      const logoFitH = 58;
      doc.image(logoFile, logoX + ((logoW - logoFitW) / 2), cy + ((contactBlockH - logoFitH) / 2), { fit: [logoFitW, logoFitH] });
    }
  } catch { /* no logo */ }

  cy += contactBlockH;

  // === MATERIAL HEADER TABLE ===
  const mCols = [
    { l: 'Period', w: 60 },
    { l: 'Sender', w: 120 },
    { l: 'Eural\nCode', w: 55 },
    { l: 'WEEE\nCategory', w: 60 },
    { l: 'Material', w: 100 },
    { l: 'Quantity\nin kg', w: 65 },
    { l: 'Process Description', w: LCW - 60 - 120 - 55 - 60 - 100 - 65 },
  ];
  const mhH = 28;
  let mx = LM;
  for (const c of mCols) {
    cell(mx, cy, c.w, mhH, c.l, { fill: LIGHT_BLUE, fontSize: 8.8, align: 'center', valign: 'center', paddingX: 4 });
    mx += c.w;
  }
  cy += mhH;
  const periodYear = data.period?.from ? new Date(data.period.from).getFullYear() : '—';
  const mVals = [
    String(periodYear),
    data.supplier?.name || '—',
    data.material?.eural_code || '—',
    data.material?.weee_category || '—',
    data.material?.name || '—',
    nlNum(data.totalMaterialKg),
    data.processDescription || '—',
  ];
  mx = LM;
  const mdH = 24;
  for (let i = 0; i < mCols.length; i++) {
    cell(mx, cy, mCols[i].w, mdH, '', { fontSize: 10 });
    if (i === mCols.length - 1) {
      drawTextHighlight(mx, cy, mCols[i].w, mdH, mVals[i], { fontSize: 9.5, align: 'center' });
    } else {
      cell(mx, cy, mCols[i].w, mdH, mVals[i], { fontSize: 9.5, align: 'center', valign: 'center', stroke: false });
    }
    mx += mCols[i].w;
  }
  cy += mdH + 12;

  // === FRACTIONS TABLE ===
  // Column widths tuned to match reference proportions
  const fCols = [
    { l: 'Fractions', w: 110 },
    { l: 'Eural\nCode', w: 52 },
    { l: '%', w: 40 },
    { l: 'First\nacceptant\n/\nFollowing', w: 58 },
    { l: 'Process Description', w: 100 },
    { l: '%\nPrepared\nfor re-use', w: 58 },
    { l: '%\nRecycling', w: 56 },
    { l: '% Other\nmaterial\nrecovery', w: 56 },
    { l: '% Energy\nRecovery', w: 56 },
    { l: '% Thermal\nDisposal', w: LCW - 110 - 52 - 40 - 58 - 100 - 58 - 56 - 56 - 56 },
  ];
  const groupWidths = [fCols[0].w, fCols[1].w, fCols[2].w, fCols[3].w, fCols[4].w, fCols.slice(5).reduce((sum, col) => sum + col.w, 0)];
  const dataAlign = ['left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center'];
  const nH = 16;
  const lhH = 52;
  const rH = 18;

  function drawFractionHeader(startY) {
    let fx = LM;
    const groupLabels = ['1', '2', '3', '4', '5', '6'];
    for (let i = 0; i < groupLabels.length; i++) {
      cell(fx, startY, groupWidths[i], nH, groupLabels[i], {
        fill: DARK_BLUE,
        fontSize: 9.5,
        align: 'center',
        valign: 'center',
      });
      fx += groupWidths[i];
    }

    fx = LM;
    for (const c of fCols) {
      cell(fx, startY + nH, c.w, lhH, c.l, {
        fill: LIGHT_BLUE,
        fontSize: 8,
        align: 'center',
        valign: 'center',
        paddingX: 4,
      });
      fx += c.w;
    }

    return startY + nH + lhH;
  }

  function drawFractionRows(startY, rows) {
    let rowY = startY;
    for (const row of rows) {
      const vals = [
        row.fractionName,
        row.euralCode || '',
        nlPct1(row.sharePct),
        row.acceptantDisplay || '',
        row.processDescription || '',
        nlPct(row.preparedForReusePct),
        nlPct(row.recyclingPct),
        nlPct(row.otherMaterialRecoveryPct),
        nlPct(row.energyRecoveryPct),
        nlPct(row.thermalDisposalPct),
      ];
      let fx = LM;
      for (let i = 0; i < fCols.length; i++) {
        cell(fx, rowY, fCols[i].w, rH, vals[i], {
          fontSize: 8.5,
          align: dataAlign[i],
          valign: 'center',
          paddingX: i === 0 ? 3 : 2,
        });
        fx += fCols[i].w;
      }
      rowY += rH;
    }

    for (let e = rows.length; e < ROWS_PER_PAGE; e++) {
      let fx = LM;
      for (const c of fCols) {
        cell(fx, rowY, c.w, rH, '', { fontSize: 8 });
        fx += c.w;
      }
      rowY += rH;
    }

    return rowY;
  }

  const pages = [];
  for (let i = 0; i < data.rows.length; i += ROWS_PER_PAGE) {
    pages.push(data.rows.slice(i, i + ROWS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) {
      doc.addPage();
      cy = LM;
    }
    cy = drawFractionHeader(cy);
    cy = drawFractionRows(cy, pages[pageIndex]);
  }

  // Totals row
  cy += 8;
  if (cy + rH > LBL) { doc.addPage(); cy = LM; }
  const tsp = data.rows.reduce((s, r) => s + (Number(r.sharePct) || 0), 0);
  function wavg(field) { return tsp > 0 ? data.rows.reduce((s, r) => s + (Number(r[field]) || 0) * (Number(r.sharePct) || 0), 0) / tsp : 0; }

  const totals = [
    'Total', '', nlPct1(tsp), '', '',
    nlPct1(wavg('preparedForReusePct')), nlPct1(wavg('recyclingPct')), nlPct1(wavg('otherMaterialRecoveryPct')),
    nlPct1(wavg('energyRecoveryPct')), nlPct1(wavg('thermalDisposalPct')),
  ];
  let fx = LM;
  for (let i = 0; i < fCols.length; i++) {
    cell(fx, cy, fCols[i].w, rH, totals[i], { fontSize: 8.5, align: dataAlign[i], valign: 'center' });
    fx += fCols[i].w;
  }
  cy += rH + 18;

  // === FOOTER ===
  if (cy + 40 > LBL) { doc.addPage(); cy = LM; }
  doc.font('Helvetica').fontSize(10).fillColor(TEXT_PRIMARY);
  doc.text('Completed by:', LM, cy);
  doc.font('Helvetica').fontSize(10).text(data.confirmedBy || 'System', LM + 100, cy);
  doc.moveTo(LM + 100, cy + 14).lineTo(LM + 280, cy + 14).lineWidth(0.5).strokeColor(CB).stroke();
  cy += 24;
  doc.font('Helvetica').fontSize(10).text('Date:', LM, cy);
  doc.font('Helvetica').fontSize(10).text(formatDownstreamDate(data.confirmedAt || new Date()), LM + 100, cy);
  doc.moveTo(LM + 100, cy + 14).lineTo(LM + 280, cy + 14).lineWidth(0.5).strokeColor(CB).stroke();
  doc.font('Helvetica').fontSize(10).text('Signature:', LM + LCW / 2, cy);
  doc.moveTo(LM + LCW / 2 + 70, cy + 14).lineTo(LM + LCW - 20, cy + 14).lineWidth(0.5).strokeColor(CB).stroke();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.end();
  });
}

/* ───── RPT-03: Chain of Custody ───── */

async function generateChainOfCustodyPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  for (let ci = 0; ci < data.consignments.length; ci++) {
    if (ci > 0) doc.addPage();
    const c = data.consignments[ci];

    addPageHeader(doc, {
      title: 'Chain of Custody Report',
      subtitle: `Consignment: ${c.orderNumber}`,
      generatedBy: user?.full_name,
      generatedAt: new Date(),
    });

    // Delivery details
    addSectionTitle(doc, 'Delivery Details');
    doc.fontSize(8).fillColor(TEXT_PRIMARY).font('Helvetica');
    doc.text(`Order: ${c.orderNumber}`, MARGIN, doc.y);
    doc.text(`Date: ${formatDate(c.plannedDate)}`);
    doc.text(`Carrier: ${c.carrier.name}${c.carrier.kvkNumber ? ` (KvK: ${c.carrier.kvkNumber})` : ''}`);
    doc.text(`Supplier: ${c.supplier.name}${c.supplier.kvkNumber ? ` (KvK: ${c.supplier.kvkNumber})` : ''}`);
    if (c.afvalstroomnummer) doc.text(`Afvalstroomnummer: ${c.afvalstroomnummer}`);
    doc.y += 8;

    for (const event of c.inboundsData) {
      addSectionTitle(doc, `Vehicle: ${event.vehiclePlate || 'N/A'}`);
      doc.fontSize(7).fillColor(TEXT_SECONDARY).font('Helvetica');
      doc.text(`Arrived: ${formatDateTime(event.arrivedAt)} | Gross: ${formatWeight(event.grossWeightKg)} | Tare: ${formatWeight(event.tareWeightKg)} | Net: ${formatWeight(event.netWeightKg)}`, MARGIN, doc.y);
      doc.y += 6;

      // Skip detail table
      if (event.assets.length > 0) {
        const skipHeaders = ['Asset Label', 'Category', 'Gross (kg)', 'Tare (kg)', 'Net (kg)'];
        const skipWidths = [80, 140, 90, 90, 90];
        const skipRows = event.assets.map((a) => [
          a.assetLabel, `${a.category || ''} — ${a.categoryDescription || ''}`,
          formatWeight(a.grossWeightKg), formatWeight(a.tareWeightKg), formatWeight(a.netWeightKg),
        ]);
        addTable(doc, { headers: skipHeaders, rows: skipRows, columnWidths: skipWidths });

        // Sorting breakdown
        for (const asset of event.assets) {
          if (asset.sortingLines.length === 0) continue;
          doc.y += 4;
          doc.fontSize(7).fillColor(TEXT_PRIMARY).font('Helvetica-Bold')
            .text(`Sorting — ${asset.assetLabel}`, MARGIN, doc.y);
          doc.y += 4;

          const sortHeaders = ['Category', 'Weight (kg)', 'Recycled %', 'Reused %', 'Disposed %'];
          const sortWidths = [160, 80, 80, 80, 80];
          const sortRows = asset.sortingLines.map((l) => [
            `${l.codeCbs} — ${l.descriptionEn}`,
            formatWeight(l.netWeightKg),
            formatPct(l.recycledPct), formatPct(l.reusedPct),
            formatPct(l.disposedPct),
          ]);
          addTable(doc, { headers: sortHeaders, rows: sortRows, columnWidths: sortWidths, fontSize: 6.5 });
        }
      }
    }
  }

  await finalizePdf(doc, stream);
}

/* ───── RPT-04: Inbound Weight Register ───── */

async function generateInboundWeightRegisterPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  addPageHeader(doc, {
    title: 'Inbound Weight Register',
    generatedBy: user?.full_name,
    generatedAt: new Date(),
    period: data.period,
  });

  // Main events table
  addSectionTitle(doc, 'All Inbounds');
  const headers = ['Date/Time', 'Order #', 'Supplier', 'Carrier', 'Vehicle', 'Skips', 'Gross (kg)', 'Tare (kg)', 'Net (kg)'];
  const widths = [58, 52, 58, 58, 52, 30, 52, 52, 52];
  const rows = data.events.map((e) => [
    formatDateTime(e.arrivedAt), e.orderNumber, e.supplierName, e.carrierName,
    e.vehiclePlate, String(e.skipCount),
    formatWeight(e.grossWeightKg), formatWeight(e.tareWeightKg), formatWeight(e.netWeightKg),
  ]);
  const grandRow = [
    'GRAND TOTAL', '', '', '', '', String(data.grandTotals.skipCount),
    formatWeight(data.grandTotals.grossKg), formatWeight(data.grandTotals.tareKg), formatWeight(data.grandTotals.netKg),
  ];
  grandRow._bold = true;
  rows.push(grandRow);
  addTable(doc, { headers, rows, columnWidths: widths, fontSize: 6 });

  // Subtotals by carrier
  if (data.subtotalsByCarrier.length > 0) {
    doc.y += 10;
    addSectionTitle(doc, 'Subtotals by Carrier');
    const cHeaders = ['Carrier', 'Events', 'Skips', 'Gross (kg)', 'Tare (kg)', 'Net (kg)'];
    const cWidths = [140, 60, 60, 80, 80, 80];
    const cRows = data.subtotalsByCarrier.map((c) => [
      c.name, String(c.eventCount), String(c.skipCount),
      formatWeight(c.grossKg), formatWeight(c.tareKg), formatWeight(c.netKg),
    ]);
    addTable(doc, { headers: cHeaders, rows: cRows, columnWidths: cWidths });
  }

  // Subtotals by waste stream
  if (data.subtotalsByWasteStream.length > 0) {
    doc.y += 10;
    addSectionTitle(doc, 'Subtotals by Waste Stream');
    const wsHeaders = ['Waste Stream', 'Code', 'Events', 'Skips', 'Net (kg)'];
    const wsWidths = [140, 80, 60, 60, 140];
    const wsRows = data.subtotalsByWasteStream.map((ws) => [
      ws.name, ws.code, String(ws.eventCount), String(ws.skipCount), formatWeight(ws.netKg),
    ]);
    addTable(doc, { headers: wsHeaders, rows: wsRows, columnWidths: wsWidths });
  }

  await finalizePdf(doc, stream);
}

/* ───── RPT-05: Waste Stream Analysis ───── */

async function generateWasteStreamAnalysisPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  addPageHeader(doc, {
    title: 'Waste Stream Analysis',
    generatedBy: user?.full_name,
    generatedAt: new Date(),
    period: data.period,
  });

  for (const ws of data.wasteStreams) {
    checkPageBreak(doc, 60);
    addSectionTitle(doc, `${ws.streamName} (${ws.streamCode})`);
    addSubtitle(doc, `Total Inbound: ${formatWeight(ws.totals.totalInboundKg)} | Recycled: ${formatPct(ws.totals.recycledPct)} | Reused: ${formatPct(ws.totals.reusedPct)} | Disposed: ${formatPct(ws.totals.disposedPct)}`);
    doc.y += 4;

    // Simple horizontal bar chart using rect primitives
    const maxKg = Math.max(...ws.categories.map((c) => c.totalInboundKg), 1);
    const barMaxWidth = CONTENT_WIDTH - 120;
    for (const cat of ws.categories) {
      checkPageBreak(doc, 16);
      const barWidth = (cat.totalInboundKg / maxKg) * barMaxWidth;
      doc.fontSize(6).fillColor(TEXT_PRIMARY).font('Helvetica')
        .text(cat.codeCbs, MARGIN, doc.y + 1, { width: 50 });
      doc.save();
      doc.rect(MARGIN + 55, doc.y - 1, Math.max(barWidth, 2), 10).fill(BRAND_GREEN);
      doc.restore();
      doc.fontSize(6).fillColor(TEXT_PRIMARY).font('Helvetica')
        .text(formatWeight(cat.totalInboundKg), MARGIN + 60 + barMaxWidth, doc.y - 1, { width: 55, align: 'right' });
      doc.y += 6;
    }
    doc.y += 6;

    // Detail table
    const headers = ['CBS Code', 'Category', 'Inbound (kg)', 'Recycled %', 'Reused %', 'Disposed %'];
    const widths = [60, 150, 80, 70, 70, 70];
    const rows = ws.categories.map((c) => [
      c.codeCbs, c.descriptionEn, formatWeight(c.totalInboundKg),
      formatPct(c.recycledPct), formatPct(c.reusedPct), formatPct(c.disposedPct),
    ]);
    addTable(doc, { headers, rows, columnWidths: widths });
    doc.y += 8;
  }

  await finalizePdf(doc, stream);
}

/* ───── RPT-06: Skip Asset Utilisation ───── */

async function generateAssetUtilisationPDF(data, filePath, user) {
  const { doc, stream } = createPdf(filePath);

  addPageHeader(doc, {
    title: 'Skip Asset Utilisation',
    generatedBy: user?.full_name,
    generatedAt: new Date(),
    period: data.period,
  });

  // Summary stats
  addSectionTitle(doc, 'Summary');
  doc.fontSize(9).fillColor(TEXT_PRIMARY).font('Helvetica');
  doc.text(`Total Skips: ${data.totalSkips}`, MARGIN, doc.y);
  doc.text(`Average Skips per Event: ${data.avgPerEvent}`);
  doc.y += 12;

  // By type
  addSectionTitle(doc, 'Breakdown by Skip Type');
  const typeHeaders = ['Skip Type', 'Count'];
  const typeWidths = [200, 200];
  const typeRows = data.byType.map((t) => [t.type, String(t.count)]);
  addTable(doc, { headers: typeHeaders, rows: typeRows, columnWidths: typeWidths });

  // Top assets
  if (data.topAssets.length > 0) {
    doc.y += 10;
    addSectionTitle(doc, 'Top 20 Most-Used Asset Labels');
    const assetHeaders = ['Asset Label', 'Usage Count'];
    const assetWidths = [200, 200];
    const assetRows = data.topAssets.map((a) => [a.label, String(a.count)]);
    addTable(doc, { headers: assetHeaders, rows: assetRows, columnWidths: assetWidths });
  }

  await finalizePdf(doc, stream);
}

module.exports = {
  generateSupplierStatementPDF,
  generateMaterialRecoveryPDF,
  generateChainOfCustodyPDF,
  generateInboundWeightRegisterPDF,
  generateWasteStreamAnalysisPDF,
  generateAssetUtilisationPDF,
  generateDownstreamStatementPDF,
};
