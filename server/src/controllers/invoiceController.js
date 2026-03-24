const invoiceService = require('../services/invoiceService');
const { generateInvoicePDFBuffer } = require('../services/invoicePdfGenerator');

async function list(req, res, next) {
  try {
    const data = await invoiceService.listInvoices(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await invoiceService.getInvoice(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function getCompletedOrders(req, res, next) {
  try {
    const data = await invoiceService.getCompletedOrdersForInvoicing(req.params.supplierId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function generateSupplierInvoice(req, res, next) {
  try {
    const data = await invoiceService.generateSupplierInvoice(req.body.order_ids, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const data = await invoiceService.updateInvoiceStatus(req.params.id, req.body.status, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function addLine(req, res, next) {
  try {
    const data = await invoiceService.addInvoiceLine(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateLine(req, res, next) {
  try {
    const data = await invoiceService.updateInvoiceLine(req.params.lineId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function deleteLine(req, res, next) {
  try {
    const data = await invoiceService.deleteInvoiceLine(req.params.lineId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function previewPdf(req, res, next) {
  try {
    const invoice = await invoiceService.getInvoice(req.params.id);
    const buffer = await generateInvoicePDFBuffer(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  list,
  getById,
  getCompletedOrders,
  generateSupplierInvoice,
  updateStatus,
  addLine,
  updateLine,
  deleteLine,
  previewPdf,
};
