const contractService = require('../services/contractService');

async function list(req, res, next) {
  try {
    const data = await contractService.listContracts(req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function dashboard(req, res, next) {
  try {
    const data = await contractService.getDashboardSummary();
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    const data = await contractService.getContract(req.params.id);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const data = await contractService.createContract(req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const data = await contractService.updateContract(req.params.id, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const data = await contractService.approveContract(req.params.id, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function terminate(req, res, next) {
  try {
    const data = await contractService.deactivateContract(req.params.id, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function addRateLine(req, res, next) {
  try {
    const data = await contractService.addRateLine(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function updateRateLine(req, res, next) {
  try {
    const data = await contractService.updateRateLine(req.params.lineId, req.body, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function deleteRateLine(req, res, next) {
  try {
    await contractService.deleteRateLine(req.params.lineId, req.user.userId);
    res.json({ message: 'Rate line superseded' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function syncPenalties(req, res, next) {
  try {
    const data = await contractService.syncPenalties(req.params.id, req.body.fee_ids, req.user.userId);
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function match(req, res, next) {
  try {
    const { supplier_id, material_id, date } = req.query;
    if (!supplier_id || !material_id) {
      return res.status(400).json({ error: 'supplier_id and material_id are required' });
    }
    const data = await contractService.matchContractForOrder(supplier_id, material_id, date || new Date());
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function matchForOrder(req, res, next) {
  try {
    const { supplier_id, carrier_id, date } = req.query;
    if (!supplier_id || !carrier_id) {
      return res.status(400).json({ error: 'supplier_id and carrier_id are required' });
    }
    const data = await contractService.findContractForSupplierCarrier(supplier_id, carrier_id, date || new Date());
    res.json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function addWasteStream(req, res, next) {
  try {
    const data = await contractService.addContractWasteStream(req.params.id, req.body, req.user.userId);
    res.status(201).json({ data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

async function deleteWasteStream(req, res, next) {
  try {
    await contractService.deleteContractWasteStream(req.params.cwsId, req.user.userId);
    res.json({ message: 'Waste stream removed from contract' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    next(error);
  }
}

module.exports = {
  list,
  dashboard,
  getById,
  create,
  update,
  approve,
  terminate,
  addRateLine,
  updateRateLine,
  deleteRateLine,
  syncPenalties,
  match,
  matchForOrder,
  addWasteStream,
  deleteWasteStream,
};
