const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const supplierController = require('../controllers/supplierController');

router.use(authenticateToken);

router.get('/', supplierController.list);
router.get('/:id', supplierController.getById);
router.post('/', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), supplierController.create);
router.put('/:id', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), supplierController.update);
router.delete('/:id', requireRole(['ADMIN']), supplierController.remove);

module.exports = router;
