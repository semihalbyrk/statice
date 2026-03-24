const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/contaminationController');

router.use(authenticateToken);

const SORTING_ROLES = ['ADMIN', 'SORTING_EMPLOYEE', 'GATE_OPERATOR', 'QC_INSPECTOR'];
const FINANCE_ROLES = ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'];

router.get('/', requireRole([...SORTING_ROLES, ...FINANCE_ROLES]), ctrl.list);
router.get('/config/:contractId', requireRole(SORTING_ROLES), ctrl.getContractConfig);
router.get('/:id', requireRole([...SORTING_ROLES, ...FINANCE_ROLES]), ctrl.getById);
router.post('/', requireRole(SORTING_ROLES), ctrl.record);
router.put('/:id', requireRole(SORTING_ROLES), ctrl.update);

module.exports = router;
