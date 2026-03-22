const assetService = require('../services/assetService');
const { previewNextLabel, previewNextContainerLabel } = require('../utils/assetLabel');

async function list(req, res, next) {
  try {
    const inboundId = req.query.inbound_id || req.query.weighing_event_id;
    if (!inboundId) return res.status(400).json({ error: 'inbound_id query parameter is required' });
    const assets = await assetService.listAssets(inboundId);
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
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const asset = await assetService.updateAsset(req.params.id, req.body, req.user.userId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ data: asset });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const asset = await assetService.deleteAsset(req.params.id, req.user.userId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ data: { message: 'Asset deleted', id: req.params.id } });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function lookupByLabel(req, res, next) {
  try {
    const { label } = req.query;
    if (!label) return res.status(400).json({ error: 'label query param required' });
    const asset = await assetService.lookupByLabel(label);
    res.json({ data: asset });
  } catch (err) { next(err); }
}

async function getNextContainerLabel(req, res, next) {
  try {
    const label = await previewNextContainerLabel();
    res.json({ data: { label } });
  } catch (err) { next(err); }
}

async function lookupByContainerLabel(req, res, next) {
  try {
    const { label } = req.query;
    if (!label) return res.status(400).json({ error: 'label query param required' });
    const asset = await assetService.lookupByContainerLabel(label);
    res.json({ data: asset });
  } catch (err) { next(err); }
}

module.exports = { list, getById, getNextLabel, getNextContainerLabel, create, update, remove, lookupByLabel, lookupByContainerLabel };
