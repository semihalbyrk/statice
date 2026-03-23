const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/contractController');

router.use(authenticateToken);

const FINANCE_ROLES = ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'];
const FINANCE_WRITE = ['ADMIN', 'FINANCE_MANAGER'];

const ORDER_ROLES = ['ADMIN', 'LOGISTICS_PLANNER', 'FINANCE_MANAGER', 'FINANCE_USER'];

router.get('/', requireRole(FINANCE_ROLES), ctrl.list);
router.get('/dashboard', requireRole(FINANCE_ROLES), ctrl.dashboard);
router.get('/match', requireRole(FINANCE_ROLES), ctrl.match);
router.get('/match-for-order', requireRole(ORDER_ROLES), ctrl.matchForOrder);
router.get('/:id', requireRole(FINANCE_ROLES), ctrl.getById);
router.post('/', requireRole(FINANCE_WRITE), ctrl.create);
router.put('/:id', requireRole(FINANCE_WRITE), ctrl.update);
router.post('/:id/approve', requireRole(FINANCE_WRITE), ctrl.approve);
router.post('/:id/terminate', requireRole(FINANCE_WRITE), ctrl.terminate);
router.post('/:id/waste-streams', requireRole(FINANCE_WRITE), ctrl.addWasteStream);
router.delete('/:id/waste-streams/:cwsId', requireRole(FINANCE_WRITE), ctrl.deleteWasteStream);
router.post('/:id/rate-lines', requireRole(FINANCE_WRITE), ctrl.addRateLine);
router.put('/rate-lines/:lineId', requireRole(FINANCE_WRITE), ctrl.updateRateLine);
router.delete('/rate-lines/:lineId', requireRole(FINANCE_WRITE), ctrl.deleteRateLine);
router.put('/:id/penalties', requireRole(FINANCE_WRITE), ctrl.syncPenalties);

module.exports = router;
