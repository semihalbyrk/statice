const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const orderController = require('../controllers/orderController');
const arrivalController = require('../controllers/arrivalController');

router.use(authenticateToken);

// Arrival endpoints (must come before /:id routes)
router.get('/match-plate', requireRole(['GATE_OPERATOR', 'ADMIN']), arrivalController.matchPlate);
router.post('/adhoc-arrival', requireRole(['GATE_OPERATOR', 'ADMIN']), arrivalController.adhocArrival);

// Order CRUD
router.get('/', orderController.list);
router.get('/:id', orderController.getById);
router.post('/', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), orderController.create);
router.put('/:id', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), orderController.update);
router.delete('/:id', requireRole(['ADMIN']), orderController.cancel);

module.exports = router;
