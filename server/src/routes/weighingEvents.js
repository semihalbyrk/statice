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

// Sequential weighing flow
router.post('/:id/weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.triggerNextWeighing);
router.post('/:id/parcels', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.registerParcel);
router.post('/:id/weight-override', requireRole(['ADMIN']), ctrl.overrideWeight);

// Incident on inbound
router.patch('/:id/incident', authenticateToken, requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.setIncident);

// Confirm a weighing ticket (supervisor)
router.post('/:id/weighing/:sequence/confirm', authenticateToken, requireRole(['ADMIN']), ctrl.confirmWeighing);

// List amendments for a weighing
router.get('/:id/weighing/:sequence/amendments', authenticateToken, ctrl.getAmendments);

router.get('/:id/ticket/pdf', ctrl.downloadTicket);

module.exports = router;
