const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prismaClient');
const { writeAuditLog } = require('../utils/auditLog');
const dataService = require('../services/reportDataService');
const pdfGen = require('../services/pdfReportGenerator');
const xlsxGen = require('../services/xlsxReportGenerator');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage', 'reports');

const REPORT_TYPES = {
  'RPT-01': {
    name: 'Supplier Circularity Statement',
    fetcher: 'fetchSupplierStatementData',
    pdfGen: 'generateSupplierStatementPDF',
    xlsxGen: 'generateSupplierStatementXLSX',
    required: ['supplierId', 'dateFrom', 'dateTo'],
  },
  'RPT-02': {
    name: 'Material Recovery Summary',
    fetcher: 'fetchMaterialRecoveryData',
    pdfGen: 'generateMaterialRecoveryPDF',
    xlsxGen: 'generateMaterialRecoveryXLSX',
    required: ['dateFrom', 'dateTo'],
  },
  'RPT-03': {
    name: 'Chain of Custody',
    fetcher: 'fetchChainOfCustodyData',
    pdfGen: 'generateChainOfCustodyPDF',
    xlsxGen: 'generateChainOfCustodyXLSX',
    required: [],
  },
  'RPT-04': {
    name: 'Inbound Weight Register',
    fetcher: 'fetchInboundWeightRegisterData',
    pdfGen: 'generateInboundWeightRegisterPDF',
    xlsxGen: 'generateInboundWeightRegisterXLSX',
    required: ['dateFrom', 'dateTo'],
  },
  'RPT-05': {
    name: 'Waste Stream Analysis',
    fetcher: 'fetchWasteStreamAnalysisData',
    pdfGen: 'generateWasteStreamAnalysisPDF',
    xlsxGen: 'generateWasteStreamAnalysisXLSX',
    required: ['dateFrom', 'dateTo'],
  },
  'RPT-06': {
    name: 'Skip Asset Utilisation',
    fetcher: 'fetchAssetUtilisationData',
    pdfGen: 'generateAssetUtilisationPDF',
    xlsxGen: 'generateAssetUtilisationXLSX',
    required: ['dateFrom', 'dateTo'],
  },
  'RPT-07': {
    name: 'Downstream Material Statement',
    fetcher: 'fetchDownstreamStatementData',
    pdfGen: 'generateDownstreamStatementPDF',
    xlsxGen: 'generateDownstreamStatementXLSX',
    required: ['supplierId', 'materialId', 'dateFrom', 'dateTo'],
  },
  'RPT-DS': {
    name: 'Downstream Entry Statement',
    fetcher: 'fetchDownstreamEntryStatement',
    pdfGen: 'generateDownstreamStatementPDF',
    xlsxGen: null,
    required: ['sessionId', 'catalogueEntryId'],
  },
};

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

async function generate(req, res, next) {
  try {
    const { type, format, parameters } = req.body;

    // Validate report type
    const config = REPORT_TYPES[type];
    if (!config) {
      return res.status(400).json({ error: `Invalid report type: ${type}. Valid types: ${Object.keys(REPORT_TYPES).join(', ')}` });
    }

    // Validate format
    const fmt = (format || 'pdf').toLowerCase();
    if (!['pdf', 'xlsx', 'both'].includes(fmt)) {
      return res.status(400).json({ error: 'Format must be pdf, xlsx, or both' });
    }

    // Validate required parameters
    const params = parameters || {};
    // RPT-03 special case: needs orderId OR (dateFrom + dateTo)
    if (type === 'RPT-03' && !params.orderId && (!params.dateFrom || !params.dateTo)) {
      return res.status(422).json({ error: 'RPT-03 requires either orderId or dateFrom + dateTo' });
    }
    for (const field of config.required) {
      if (!params[field]) {
        return res.status(422).json({ error: `Missing required parameter: ${field}` });
      }
    }

    // Fetch data
    const data = await dataService[config.fetcher](params);

    const shortId = uuidv4().slice(0, 8);
    const ts = timestamp();
    let filePathPdf = null;
    let filePathXlsx = null;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { full_name: true } });

    // Generate PDF
    if (fmt === 'pdf' || fmt === 'both') {
      const filename = `${type}_${ts}_${shortId}.pdf`;
      filePathPdf = path.join(STORAGE_DIR, filename);
      await pdfGen[config.pdfGen](data, filePathPdf, user);
    }

    // Generate XLSX
    if ((fmt === 'xlsx' || fmt === 'both') && config.xlsxGen) {
      const filename = `${type}_${ts}_${shortId}.xlsx`;
      filePathXlsx = path.join(STORAGE_DIR, filename);
      await xlsxGen[config.xlsxGen](data, filePathXlsx, user);
    }

    // Create report record
    const report = await prisma.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          type,
          generated_by: req.user.userId,
          parameters_json: params,
          file_path_pdf: filePathPdf,
          file_path_xlsx: filePathXlsx,
        },
        include: { generated_by_user: { select: { full_name: true } } },
      });

      await writeAuditLog({
        userId: req.user.userId,
        action: 'CREATE',
        entityType: 'Report',
        entityId: r.id,
        after: { type, format: fmt, parameters: params },
      }, tx);

      return r;
    });

    res.status(201).json({
      data: {
        id: report.id,
        type: report.type,
        typeName: config.name,
        generatedAt: report.generated_at,
        generatedBy: report.generated_by_user?.full_name,
        hasPdf: !!filePathPdf,
        hasXlsx: !!filePathXlsx,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const { id } = req.params;
    const format = (req.query.format || 'pdf').toLowerCase();

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const filePath = format === 'xlsx' ? report.file_path_xlsx : report.file_path_pdf;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: `${format.toUpperCase()} file not found for this report` });
    }

    const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
    const contentType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';
    const filename = `${report.type}_${report.id.slice(0, 8)}.${ext}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.session_id) where.parameters_json = { path: ['sessionId'], equals: req.query.session_id };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: { generated_by_user: { select: { full_name: true } } },
        orderBy: { generated_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    res.json({
      data: reports.map((r) => ({
        id: r.id,
        type: r.type,
        typeName: REPORT_TYPES[r.type]?.name || r.type,
        generatedAt: r.generated_at,
        generatedBy: r.generated_by_user?.full_name,
        parametersJson: r.parameters_json,
        hasPdf: !!r.file_path_pdf,
        hasXlsx: !!r.file_path_xlsx,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteReport(req, res, next) {
  try {
    const { id } = req.params;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Delete files from disk
    if (report.file_path_pdf && fs.existsSync(report.file_path_pdf)) {
      fs.unlinkSync(report.file_path_pdf);
    }
    if (report.file_path_xlsx && fs.existsSync(report.file_path_xlsx)) {
      fs.unlinkSync(report.file_path_xlsx);
    }

    await prisma.$transaction(async (tx) => {
      await tx.report.delete({ where: { id } });
      await writeAuditLog({
        userId: req.user.userId,
        action: 'DELETE',
        entityType: 'Report',
        entityId: id,
        before: { type: report.type },
      }, tx);
    });

    res.json({ message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { generate, download, list, deleteReport, REPORT_TYPES };
