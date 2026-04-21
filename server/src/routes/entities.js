const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/entityController');

router.use(authenticateToken);

const WRITE_ROLES = ['ADMIN', 'FINANCE_MANAGER'];
const READ_ROLES = ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER', 'LOGISTICS_PLANNER'];

router.get('/protected', requireRole(READ_ROLES), ctrl.getProtected);
router.get('/', requireRole(READ_ROLES), ctrl.list);
router.get('/:id', requireRole(READ_ROLES), ctrl.getById);
router.post('/', requireRole(WRITE_ROLES), ctrl.create);
router.put('/:id', requireRole(WRITE_ROLES), ctrl.update);
router.patch('/:id/status', requireRole(['ADMIN']), ctrl.toggleStatus);

router.get('/:id/disposer-sites', requireRole(READ_ROLES), ctrl.listSites);
router.post('/:id/disposer-sites', requireRole(WRITE_ROLES), ctrl.createSite);
router.put('/:id/disposer-sites/:siteId', requireRole(WRITE_ROLES), ctrl.updateSite);
router.patch('/:id/disposer-sites/:siteId/status', requireRole(['ADMIN']), ctrl.toggleSiteStatus);

module.exports = router;
