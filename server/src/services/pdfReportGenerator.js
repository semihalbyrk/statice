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
  const headers = ['CBS Code', 'Category', 'Inbound (kg)', 'Recycled (kg)', 'Recycled %', 'Reused (kg)', 'Reused %', 'Disposed (kg)', 'Disposed %', 'Landfill (kg)', 'Landfill %'];
  const widths = [40, 65, 48, 45, 38, 40, 38, 42, 38, 42, 38];
  const rows = data.categories.map((c) => [
    c.codeCbs, c.descriptionEn,
    formatWeight(c.totalInboundKg),
    formatWeight(c.recycledKg), formatPct(c.recycledPct),
    formatWeight(c.reusedKg), formatPct(c.reusedPct),
    formatWeight(c.disposedKg), formatPct(c.disposedPct),
    formatWeight(c.landfillKg), formatPct(c.landfillPct),
  ]);
  const totals = [
    'TOTAL', '',
    formatWeight(data.totals.totalInboundKg),
    formatWeight(data.totals.recycledKg), formatPct(data.totals.recycledPct),
    formatWeight(data.totals.reusedKg), formatPct(data.totals.reusedPct),
    formatWeight(data.totals.disposedKg), formatPct(data.totals.disposedPct),
    formatWeight(data.totals.landfillKg), formatPct(data.totals.landfillPct),
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

          const sortHeaders = ['Category', 'Weight (kg)', 'Recycled %', 'Reused %', 'Disposed %', 'Landfill %', 'Processor'];
          const sortWidths = [100, 60, 50, 50, 50, 50, 130];
          const sortRows = asset.sortingLines.map((l) => [
            `${l.codeCbs} — ${l.descriptionEn}`,
            formatWeight(l.netWeightKg),
            formatPct(l.recycledPct), formatPct(l.reusedPct),
            formatPct(l.disposedPct), formatPct(l.landfillPct),
            l.downstreamProcessor || '—',
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
    addSubtitle(doc, `Total Inbound: ${formatWeight(ws.totals.totalInboundKg)} | Recycled: ${formatPct(ws.totals.recycledPct)} | Reused: ${formatPct(ws.totals.reusedPct)} | Disposed: ${formatPct(ws.totals.disposedPct)} | Landfill: ${formatPct(ws.totals.landfillPct)}`);
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
    const headers = ['CBS Code', 'Category', 'Inbound (kg)', 'Recycled %', 'Reused %', 'Disposed %', 'Landfill %'];
    const widths = [55, 120, 70, 60, 60, 60, 60];
    const rows = ws.categories.map((c) => [
      c.codeCbs, c.descriptionEn, formatWeight(c.totalInboundKg),
      formatPct(c.recycledPct), formatPct(c.reusedPct), formatPct(c.disposedPct), formatPct(c.landfillPct),
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
};
