const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const outboundOrderController = require('../controllers/outboundOrderController');

const WRITE_ROLES = ['ADMIN', 'LOGISTICS_PLANNER'];

router.use(authenticateToken);

router.get('/', requireRole([...WRITE_ROLES, 'GATE_OPERATOR', 'WEIGHBRIDGE_OPERATOR']), outboundOrderController.list);
router.get('/:id', requireRole([...WRITE_ROLES, 'GATE_OPERATOR', 'WEIGHBRIDGE_OPERATOR']), outboundOrderController.getById);
router.post('/', requireRole(WRITE_ROLES), outboundOrderController.create);
router.put('/:id', requireRole(WRITE_ROLES), outboundOrderController.update);
router.patch('/:id/status', requireRole(WRITE_ROLES), outboundOrderController.updateStatus);
router.delete('/:id', requireRole(WRITE_ROLES), outboundOrderController.cancel);

module.exports = router;
