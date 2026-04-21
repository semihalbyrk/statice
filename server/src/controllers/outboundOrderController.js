const outboundOrderService = require('../services/outboundOrderService');

async function list(req, res, next) {
  try {
    const result = await outboundOrderService.listOutboundOrders(req.query);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const order = await outboundOrderService.getOutboundOrder(req.params.id);
    return res.json(order);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { contract_id, planned_date } = req.body;
    if (!contract_id || !planned_date) {
      return res.status(400).json({ error: 'contract_id and planned_date are required' });
    }

    const order = await outboundOrderService.createOutboundOrder(req.body, req.user.userId);
    return res.status(201).json(order);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const order = await outboundOrderService.updateOutboundOrder(req.params.id, req.body, req.user.userId);
    return res.json(order);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const order = await outboundOrderService.cancelOutboundOrder(req.params.id, req.user.userId);
    return res.json(order);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const order = await outboundOrderService.updateOutboundOrderStatus(req.params.id, status, req.user.userId);
    return res.json(order);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = { list, getById, create, update, cancel, updateStatus };
