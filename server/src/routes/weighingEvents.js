const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/weighingEventsController');

router.use(authenticateToken);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.create);
router.post('/:id/gross-weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.triggerGross);
router.post('/:id/tare-weighing', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.triggerTare);
router.post('/:id/confirm', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.confirm);
router.patch('/:id/status', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.advanceToTare);
router.post('/:id/weight-override', requireRole(['ADMIN']), ctrl.overrideWeight);
router.get('/:id/ticket/pdf', ctrl.downloadTicket);

module.exports = router;
