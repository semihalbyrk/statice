const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/weighingEventsController');

router.use(authenticateToken);

// Static routes before /:id
router.get('/asset-lookup', ctrl.lookupAsset);

// Paginated list (no order_id required)
router.get('/', ctrl.listAll);

// By order (legacy compat)
router.get('/by-order', ctrl.list);

router.get('/:id', ctrl.getById);
router.post('/', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.create);
router.patch('/:id/status', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.updateStatus);
router.patch('/:id/waste-stream', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.setWasteStream);
router.post('/:id/gross-weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.triggerGross);
router.post('/:id/tare-weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.triggerTare);
router.post('/:id/manual-weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.manualWeighing);
router.post('/:id/weight-override', requireRole(['ADMIN']), ctrl.overrideWeight);
router.get('/:id/ticket/pdf', ctrl.downloadTicket);

module.exports = router;
