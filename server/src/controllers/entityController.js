const entityService = require('../services/entityService');

async function list(req, res, next) {
  try {
    const result = await entityService.listEntities(req.query);
    res.json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await entityService.getEntityById(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await entityService.createEntity(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await entityService.updateEntity(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const data = await entityService.toggleEntityStatus(req.params.id, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function listSites(req, res, next) {
  try {
    const data = await entityService.listDisposerSites(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function createSite(req, res, next) {
  try {
    const data = await entityService.createDisposerSite(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateSite(req, res, next) {
  try {
    const data = await entityService.updateDisposerSite(req.params.id, req.params.siteId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function toggleSiteStatus(req, res, next) {
  try {
    const data = await entityService.toggleDisposerSiteStatus(req.params.id, req.params.siteId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function getProtected(req, res, next) {
  try {
    const { getStaticeEntity } = require('../utils/systemEntities');
    const data = await getStaticeEntity();
    if (!data) return res.status(404).json({ error: 'Protected entity not found' });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  toggleStatus,
  getProtected,
  listSites,
  createSite,
  updateSite,
  toggleSiteStatus,
};
