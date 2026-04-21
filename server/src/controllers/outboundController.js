const path = require('path');
const fs = require('fs');
const outboundService = require('../services/outboundService');

async function list(req, res, next) {
  try {
    const { outbound_order_id, status, search, page, limit } = req.query;
    const result = await outboundService.listOutbounds({
      outbound_order_id,
      status,
      search,
      page,
      limit,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const outbound = await outboundService.getOutbound(req.params.id);
    res.json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const outbound = await outboundService.createOutbound(
      req.params.orderId,
      req.body,
      req.user.userId
    );
    res.status(201).json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function recordWeighing(req, res, next) {
  try {
    const outbound = await outboundService.recordWeighing(
      req.params.id,
      req.body,
      req.user.userId
    );
    res.json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function generateBgl(req, res, next) {
  try {
    const outbound = await outboundService.generateBgl(
      req.params.id,
      req.user.userId
    );
    res.json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function depart(req, res, next) {
  try {
    const outbound = await outboundService.confirmDeparture(
      req.params.id,
      req.user.userId
    );
    res.json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function deliver(req, res, next) {
  try {
    const outbound = await outboundService.confirmDelivery(
      req.params.id,
      req.user.userId
    );
    res.json({ data: outbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function downloadDocument(req, res, next) {
  try {
    const document = await outboundService.getDocument(
      req.params.id,
      req.params.docId
    );

    const filePath = path.resolve(__dirname, '..', '..', document.storage_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  recordWeighing,
  generateBgl,
  depart,
  deliver,
  downloadDocument,
};
