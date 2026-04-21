const sortingService = require('../services/sortingService');

async function getSession(req, res, next) {
  try {
    const session = await sortingService.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Sorting session not found' });
    res.json({ data: session });
  } catch (err) { next(err); }
}

async function listSessions(req, res, next) {
  try {
    const { order_id, status, search, page, limit } = req.query;
    // If order_id is provided, return sessions for that order (no pagination)
    if (order_id) {
      const sessions = await sortingService.listSessionsByOrder(order_id);
      return res.json({ data: sessions });
    }
    // Otherwise, return paginated list of all sessions
    const result = await sortingService.listAllSessions({ status, search, page, limit });
    res.json(result);
  } catch (err) { next(err); }
}

async function submitSession(req, res, next) {
  try {
    const session = await sortingService.submitSession(req.params.sessionId, req.user.userId);
    res.json({ data: session, orderId: session.order_id });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 422) return res.status(422).json({ error: err.message, invalidLines: err.invalidLines });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function markSessionSorted(req, res, next) {
  try {
    const session = await sortingService.markSessionSorted(
      req.params.sessionId,
      req.body || {},
      req.user.userId,
    );
    res.json({ data: session });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function reopenSession(req, res, next) {
  try {
    const { reason, force } = req.body;
    const session = await sortingService.reopenSession(
      req.params.sessionId,
      reason,
      req.user.userId,
      { force: Boolean(force) },
    );
    res.json({ data: session });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function createLine(req, res, next) {
  try {
    const result = await sortingService.createLine(req.params.sessionId, req.body, req.user.userId);
    const response = { data: result.data };
    if (result.warning) response.warning = result.warning;
    res.status(201).json(response);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function updateLine(req, res, next) {
  try {
    const result = await sortingService.updateLine(req.params.sessionId, req.params.lineId, req.body, req.user.userId);
    const response = { data: result.data };
    if (result.warning) response.warning = result.warning;
    res.json(response);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function deleteLine(req, res, next) {
  try {
    await sortingService.deleteLine(req.params.sessionId, req.params.lineId, req.user.userId);
    res.json({ data: { message: 'Line deleted' } });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

async function listLines(req, res, next) {
  try {
    const { asset_id } = req.query;
    const lines = await sortingService.listLines(req.params.sessionId, asset_id);
    res.json({ data: lines });
  } catch (err) { next(err); }
}

async function getCategoryDefaults(req, res, next) {
  try {
    const defaults = await sortingService.getCategoryDefaults(req.params.categoryId);
    res.json({ data: defaults });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  getSession, listSessions, submitSession, markSessionSorted, reopenSession,
  createLine, updateLine, deleteLine, listLines, getCategoryDefaults,
};
