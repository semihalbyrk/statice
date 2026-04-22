const service = require('../services/outboundLineService');

async function list(req, res, next) {
  try {
    const lines = await service.listByOutbound(req.params.id);
    res.json({ data: lines });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const line = await service.createLine(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data: line });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const line = await service.updateLine(
      req.params.id,
      req.params.lineId,
      req.body,
      req.user.userId,
    );
    res.json({ data: line });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteLine(req.params.id, req.params.lineId, req.user.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
