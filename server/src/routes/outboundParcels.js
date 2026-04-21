const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/outboundParcelController');

const MUTATION_ROLES = ['ADMIN', 'LOGISTICS_PLANNER'];
const READ_ROLES = ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR'];

router.use(authenticateToken);

router.get('/', requireRole(READ_ROLES), ctrl.list);
router.get('/:id', requireRole(READ_ROLES), ctrl.getById);
router.post('/', requireRole(MUTATION_ROLES), ctrl.create);
router.put('/:id', requireRole(MUTATION_ROLES), ctrl.update);
router.delete('/:id', requireRole(MUTATION_ROLES), ctrl.remove);

module.exports = router;
