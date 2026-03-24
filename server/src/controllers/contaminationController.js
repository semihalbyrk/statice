const contaminationService = require('../services/contaminationService');

async function list(req, res, next) {
  try {
    const data = await contaminationService.listContaminationIncidents(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await contaminationService.getContaminationIncident(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function getContractConfig(req, res, next) {
  try {
    const data = await contaminationService.getContractContaminationConfig(req.params.contractId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function record(req, res, next) {
  try {
    const data = await contaminationService.recordContaminationIncident(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await contaminationService.updateContaminationIncident(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  list,
  getById,
  getContractConfig,
  record,
  update,
};
