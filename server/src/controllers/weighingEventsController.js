const inboundService = require('../services/inboundService');

async function listAll(req, res, next) {
  try {
    const { status, search, order_id, page, limit } = req.query;
    const result = await inboundService.listInbounds({ status, search, order_id, page, limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: 'order_id query parameter is required' });
    const inbounds = await inboundService.listInboundsByOrder(order_id);
    res.json({ data: inbounds });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const inbound = await inboundService.getInbound(req.params.id);
    if (!inbound) return res.status(404).json({ error: 'Inbound not found' });
    res.json({ data: inbound });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const inbound = await inboundService.createInbound(req.body, req.user.userId);
    res.status(201).json({ data: inbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const inbound = await inboundService.updateInboundStatus(req.params.id, status, req.user.userId);
    res.json({ data: inbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function setWasteStream(req, res, next) {
  try {
    const { waste_stream_id } = req.body;
    if (!waste_stream_id) return res.status(400).json({ error: 'waste_stream_id is required' });
    const inbound = await inboundService.setInboundWasteStream(req.params.id, waste_stream_id, req.user.userId);
    res.json({ data: inbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function triggerNextWeighing(req, res, next) {
  try {
    const inbound = await inboundService.triggerNextWeighing(req.params.id, req.body, req.user.userId);
    res.json({ data: inbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function registerParcel(req, res, next) {
  try {
    const asset = await inboundService.registerParcel(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data: asset });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function overrideWeight(req, res, next) {
  try {
    const inbound = await inboundService.overrideWeight(req.params.id, req.body, req.user.userId);
    res.json({ data: inbound });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function downloadTicket(req, res, next) {
  try {
    const { generateWeightTicket } = require('../services/ticketGenerator');
    const buffer = await generateWeightTicket(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weight-ticket-${req.params.id}.pdf"`);
    res.send(buffer);
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function lookupAsset(req, res, next) {
  try {
    const { label } = req.query;
    if (!label) return res.status(400).json({ error: 'label query param required' });
    const asset = await inboundService.lookupAsset(label);
    res.json({ data: asset });
  } catch (err) { next(err); }
}

async function setIncident(req, res) {
  try {
    const { incident_category, notes } = req.body;
    if (!incident_category) {
      return res.status(400).json({ error: 'incident_category is required' });
    }
    const result = await inboundService.setIncidentCategory(req.params.id, incident_category, notes, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

async function confirmWeighing(req, res) {
  try {
    const result = await inboundService.confirmWeighingTicket(req.params.id, req.params.sequence, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

async function getAmendments(req, res) {
  try {
    const result = await inboundService.getWeighingAmendments(req.params.id, req.params.sequence);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

module.exports = {
  listAll, list, getById, create, updateStatus, setWasteStream,
  triggerNextWeighing, registerParcel, overrideWeight,
  downloadTicket, lookupAsset,
  setIncident, confirmWeighing, getAmendments,
};
