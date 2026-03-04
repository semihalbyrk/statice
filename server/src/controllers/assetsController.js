const assetService = require('../services/assetService');
const { previewNextLabel } = require('../utils/assetLabel');

async function list(req, res, next) {
  try {
    const { weighing_event_id } = req.query;
    if (!weighing_event_id) return res.status(400).json({ error: 'weighing_event_id query parameter is required' });
    const assets = await assetService.listAssets(weighing_event_id);
    res.json({ data: assets });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const asset = await assetService.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ data: asset });
  } catch (err) { next(err); }
}

async function getNextLabel(req, res, next) {
  try {
    const label = await previewNextLabel();
    res.json({ data: { label } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const asset = await assetService.createAsset(req.body, req.user.userId);
    res.status(201).json({ data: asset });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const asset = await assetService.updateAsset(req.params.id, req.body, req.user.userId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ data: asset });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const asset = await assetService.deleteAsset(req.params.id, req.user.userId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ data: { message: 'Asset deleted', id: req.params.id } });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    next(err);
  }
}

module.exports = { list, getById, getNextLabel, create, update, remove };
