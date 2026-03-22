const processingService = require('../services/processingService');

async function listRecords(req, res, next) {
  try {
    const data = await processingService.getSessionRecords(req.params.sessionId, req.query.asset_id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const data = await processingService.getRecordHistory(req.params.recordId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function createOutcome(req, res, next) {
  try {
    const data = await processingService.createOutcome(req.params.recordId, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateOutcome(req, res, next) {
  try {
    const data = await processingService.updateOutcome(req.params.outcomeId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function deleteOutcome(req, res, next) {
  try {
    const data = await processingService.deleteOutcome(req.params.outcomeId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function finalizeAsset(req, res, next) {
  try {
    const data = await processingService.finalizeAsset(req.params.sessionId, req.params.assetId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function confirmAsset(req, res, next) {
  try {
    const data = await processingService.confirmAsset(req.params.sessionId, req.params.assetId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function reopenAsset(req, res, next) {
  try {
    const data = await processingService.reopenAsset(req.params.sessionId, req.params.assetId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  listRecords,
  getHistory,
  createOutcome,
  updateOutcome,
  deleteOutcome,
  finalizeAsset,
  confirmAsset,
  reopenAsset,
};
