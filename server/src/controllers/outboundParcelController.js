const parcelService = require('../services/outboundParcelService');

async function create(req, res, next) {
  try {
    const parcel = await parcelService.createParcel(req.body, req.user.userId);
    res.status(201).json({ data: parcel });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { status, materialId, outboundId, search, page, limit } = req.query;
    const result = await parcelService.listParcels({
      status,
      materialId,
      outboundId,
      search,
      page,
      limit,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const parcel = await parcelService.getParcel(req.params.id);
    res.json({ data: parcel });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const parcel = await parcelService.updateParcel(req.params.id, req.body, req.user.userId);
    res.json({ data: parcel });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await parcelService.deleteParcel(req.params.id, req.user.userId);
    res.status(204).end();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function attach(req, res, next) {
  try {
    const parcels = await parcelService.attachToOutbound(
      req.params.id,
      req.body.parcelIds,
      req.user.userId
    );
    res.json({ data: parcels });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function detach(req, res, next) {
  try {
    await parcelService.detachFromOutbound(
      req.params.id,
      req.params.parcelId,
      req.user.userId
    );
    res.status(204).end();
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function listByOutbound(req, res, next) {
  try {
    const result = await parcelService.listByOutbound(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, remove, attach, detach, listByOutbound };
