const catalogueService = require('../services/catalogueService');

async function listMaterials(req, res, next) {
  try {
    const data = await catalogueService.listMaterials(req.query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createMaterial(req, res, next) {
  try {
    const data = await catalogueService.createMaterial(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateMaterial(req, res, next) {
  try {
    const data = await catalogueService.updateMaterial(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function listFractions(req, res, next) {
  try {
    const data = await catalogueService.listFractions(req.query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createFraction(req, res, next) {
  try {
    const data = await catalogueService.createFraction(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateFraction(req, res, next) {
  try {
    const data = await catalogueService.updateFraction(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function replaceMaterialFractions(req, res, next) {
  try {
    const data = await catalogueService.upsertMaterialFractions(req.params.id, req.body.fraction_ids || [], req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function listEntries(req, res, next) {
  try {
    const data = await catalogueService.listSessionEntries(req.params.sessionId, req.query.asset_id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function createEntry(req, res, next) {
  try {
    const data = await catalogueService.createEntry(req.params.sessionId, req.params.assetId, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateEntry(req, res, next) {
  try {
    const data = await catalogueService.updateEntry(req.params.entryId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function deleteEntry(req, res, next) {
  try {
    const data = await catalogueService.deleteEntry(req.params.entryId, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function listReusableItems(req, res, next) {
  try {
    const data = await catalogueService.listReusableItems(req.params.sessionId, req.query.asset_id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function updateReusableItem(req, res, next) {
  try {
    const data = await catalogueService.updateReusableItem(req.params.id, req.body);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  listMaterials,
  createMaterial,
  updateMaterial,
  listFractions,
  createFraction,
  updateFraction,
  replaceMaterialFractions,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  listReusableItems,
  updateReusableItem,
  listProductTypes: listMaterials,
  createProductType: createMaterial,
  updateProductType: updateMaterial,
};
