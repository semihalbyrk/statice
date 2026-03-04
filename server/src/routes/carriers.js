const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const carrierController = require('../controllers/carrierController');

router.use(authenticateToken);

router.get('/', carrierController.list);
router.get('/:id', carrierController.getById);
router.post('/', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), carrierController.create);
router.put('/:id', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), carrierController.update);
router.delete('/:id', requireRole(['ADMIN']), carrierController.remove);

module.exports = router;
