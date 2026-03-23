const feeService = require('../services/feeService');

async function list(req, res, next) {
  try {
    const data = await feeService.listFees(req.query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await feeService.getFee(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await feeService.createFee(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await feeService.updateFee(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await feeService.deactivateFee(req.params.id, req.user.userId);
    res.json({ message: 'Fee deactivated' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = { list, getById, create, update, remove };
