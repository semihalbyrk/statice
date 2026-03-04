const weighingEventService = require('../services/weighingEventService');

async function list(req, res, next) {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: 'order_id query parameter is required' });
    const events = await weighingEventService.listWeighingEvents(order_id);
    res.json({ data: events });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const event = await weighingEventService.getWeighingEvent(req.params.id);
    if (!event) return res.status(404).json({ error: 'Weighing event not found' });
    res.json({ data: event });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const event = await weighingEventService.createWeighingEvent(req.body, req.user.userId);
    res.status(201).json({ data: event });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function triggerGross(req, res, next) {
  try {
    const event = await weighingEventService.triggerGrossWeighing(req.params.id, req.user.userId);
    res.json({ data: event });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function triggerTare(req, res, next) {
  try {
    const event = await weighingEventService.triggerTareWeighing(req.params.id, req.user.userId);
    res.json({ data: event });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function advanceToTare(req, res, next) {
  try {
    const event = await weighingEventService.advanceToTare(req.params.id, req.user.userId);
    res.json({ data: event });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function confirm(req, res, next) {
  try {
    const event = await weighingEventService.confirmWeighingEvent(req.params.id, req.user.userId);
    res.json({ data: event });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function overrideWeight(req, res, next) {
  try {
    const event = await weighingEventService.overrideWeight(req.params.id, req.body, req.user.userId);
    res.json({ data: event });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
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

module.exports = { list, getById, create, triggerGross, triggerTare, advanceToTare, confirm, overrideWeight, downloadTicket };
