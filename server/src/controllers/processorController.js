const processorService = require('../services/processorService');

async function list(req, res, next) {
  try {
    const data = await processorService.listProcessors(req.query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await processorService.createProcessor(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await processorService.updateProcessor(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function createCertificate(req, res, next) {
  try {
    const data = await processorService.createCertificate(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateCertificate(req, res, next) {
  try {
    const data = await processorService.updateCertificate(req.params.certificateId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function validateCertificate(req, res, next) {
  try {
    const data = await processorService.validateCertificate(req.query);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  list,
  create,
  update,
  createCertificate,
  updateCertificate,
  validateCertificate,
};
