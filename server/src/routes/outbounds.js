const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/outboundController');
const parcelCtrl = require('../controllers/outboundParcelController');
const lineCtrl = require('../controllers/outboundLineController');

const ALLOWED_ROLES = ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR'];
const PARCEL_MUTATION_ROLES = ['ADMIN', 'LOGISTICS_PLANNER'];
const LINE_MUTATION_ROLES = ['ADMIN', 'LOGISTICS_PLANNER'];

router.use(authenticateToken);

router.get('/', requireRole(ALLOWED_ROLES), ctrl.list);
router.get('/:id', requireRole(ALLOWED_ROLES), ctrl.getById);
router.post('/order/:orderId', requireRole(ALLOWED_ROLES), ctrl.create);
router.post('/:id/weighings', requireRole(ALLOWED_ROLES), ctrl.recordWeighing);
router.post('/:id/generate-bgl', requireRole(ALLOWED_ROLES), ctrl.generateBgl);
router.patch('/:id/depart', requireRole(ALLOWED_ROLES), ctrl.depart);
router.patch('/:id/deliver', requireRole(ALLOWED_ROLES), ctrl.deliver);
router.get('/:id/documents/:docId/download', requireRole(ALLOWED_ROLES), ctrl.downloadDocument);

// Outbound Parcel attach/detach/list
router.get('/:id/parcels', requireRole(ALLOWED_ROLES), parcelCtrl.listByOutbound);
router.post('/:id/parcels', requireRole(PARCEL_MUTATION_ROLES), parcelCtrl.attach);
router.delete('/:id/parcels/:parcelId', requireRole(PARCEL_MUTATION_ROLES), parcelCtrl.detach);

// Outbound Line CRUD (nested)
router.get('/:id/lines', requireRole(ALLOWED_ROLES), lineCtrl.list);
router.post('/:id/lines', requireRole(LINE_MUTATION_ROLES), lineCtrl.create);
router.put('/:id/lines/:lineId', requireRole(LINE_MUTATION_ROLES), lineCtrl.update);
router.delete('/:id/lines/:lineId', requireRole(LINE_MUTATION_ROLES), lineCtrl.remove);

module.exports = router;
