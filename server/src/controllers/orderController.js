const orderService = require('../services/orderService');

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
    const { carrier_id, supplier_id, waste_stream_id, planned_date } = req.body;
    if (!carrier_id || !supplier_id || !waste_stream_id || !planned_date) {
      return res.status(400).json({ error: 'carrier_id, supplier_id, waste_stream_id, and planned_date are required' });
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

module.exports = { list, getById, create, update, cancel };
