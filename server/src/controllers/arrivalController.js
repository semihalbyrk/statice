const orderService = require('../services/orderService');

async function matchPlate(req, res, next) {
  try {
    const { plate } = req.query;
    if (!plate || plate.length < 2) {
      return res.status(400).json({ error: 'Plate query must be at least 2 characters' });
    }
    const result = await orderService.matchPlate(plate);
    return res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function adhocArrival(req, res, next) {
  try {
    const { carrier_id, supplier_id, waste_stream_id } = req.body;
    if (!carrier_id || !supplier_id || !waste_stream_id) {
      return res.status(400).json({ error: 'carrier_id, supplier_id, and waste_stream_id are required' });
    }
    const order = await orderService.createAdhocArrival(req.body, req.user.userId);
    return res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { matchPlate, adhocArrival };
