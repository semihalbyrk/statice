const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/processingController');

const PROCESSING_ROLES = ['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN', 'COMPLIANCE_OFFICER'];

router.use(authenticateToken);

router.get('/sessions/:sessionId/records', ctrl.listRecords);
router.post('/sessions/:sessionId/records', requireRole(PROCESSING_ROLES), ctrl.createRecord);
router.get('/records/:recordId/history', ctrl.getHistory);

router.post('/records/:recordId/outcomes', requireRole(PROCESSING_ROLES), ctrl.createOutcome);
router.put('/outcomes/:outcomeId', requireRole(PROCESSING_ROLES), ctrl.updateOutcome);
router.delete('/outcomes/:outcomeId', requireRole(PROCESSING_ROLES), ctrl.deleteOutcome);

router.post('/sessions/:sessionId/assets/:assetId/finalize', requireRole(PROCESSING_ROLES), ctrl.finalizeAsset);
router.post('/sessions/:sessionId/assets/:assetId/confirm', requireRole(['ADMIN', 'COMPLIANCE_OFFICER']), ctrl.confirmAsset);
router.post('/sessions/:sessionId/assets/:assetId/reopen', requireRole(['ADMIN', 'COMPLIANCE_OFFICER']), ctrl.reopenAsset);

module.exports = router;
