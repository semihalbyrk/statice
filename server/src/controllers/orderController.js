const fs = require('fs');
const orderService = require('../services/orderService');
const prisma = require('../utils/prismaClient');

async function list(req, res, next) {
  try {
    const result = await orderService.listOrders(req.query);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(order);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { carrier_id, supplier_id, waste_stream_id, waste_stream_ids, planned_date } = req.body;
    if (!carrier_id || !supplier_id || (!waste_stream_id && (!Array.isArray(waste_stream_ids) || waste_stream_ids.length === 0)) || !planned_date) {
      return res.status(400).json({ error: 'carrier_id, supplier_id, planned_date, and at least one waste stream are required' });
    }

    const order = await orderService.createOrder(req.body, req.user.userId);
    return res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const order = await orderService.updateOrder(req.params.id, req.body, req.user.userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(order);
  } catch (err) {
    if (err.message.startsWith('Cannot transition')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user.userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json(order);
  } catch (err) {
    if (err.message.startsWith('Cannot cancel')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { document_type } = req.body;
    if (!document_type) return res.status(400).json({ error: 'Document type is required' });

    const doc = await prisma.orderDocument.create({
      data: {
        order_id: req.params.id,
        document_type,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        storage_path: req.file.path,
        uploaded_by: req.user.userId,
      },
    });
    res.status(201).json({ data: doc });
  } catch (error) { next(error); }
}

async function listDocuments(req, res, next) {
  try {
    const docs = await prisma.orderDocument.findMany({
      where: { order_id: req.params.id },
      orderBy: { uploaded_at: 'desc' },
    });
    res.json({ data: docs });
  } catch (error) { next(error); }
}

async function downloadDocument(req, res, next) {
  try {
    const doc = await prisma.orderDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.order_id !== req.params.id) return res.status(404).json({ error: 'Document not found' });
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.setHeader('Content-Type', doc.mime_type);
    fs.createReadStream(doc.storage_path).pipe(res);
  } catch (error) { next(error); }
}

async function deleteDocument(req, res, next) {
  try {
    const doc = await prisma.orderDocument.findUnique({ where: { id: req.params.docId } });
    if (!doc || doc.order_id !== req.params.id) return res.status(404).json({ error: 'Document not found' });

    await prisma.orderDocument.delete({ where: { id: req.params.docId } });

    // Remove file from disk (non-blocking, best-effort)
    fs.unlink(doc.storage_path, (err) => {
      if (err) console.error('Failed to delete file from disk:', err.message);
    });

    res.json({ message: 'Document deleted' });
  } catch (error) { next(error); }
}

module.exports = { list, getById, create, update, cancel, uploadDocument, listDocuments, downloadDocument, deleteDocument };
