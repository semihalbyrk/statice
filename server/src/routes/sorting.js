const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validatePctSum, validateSessionDraft } = require('../middleware/sortingValidation');
const ctrl = require('../controllers/sortingController');

const SORTING_ROLES = ['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN'];

router.use(authenticateToken);

// Static routes must come before /:sessionId
router.get('/', ctrl.listSessions);
router.get('/categories/:categoryId/defaults', ctrl.getCategoryDefaults);

// Session routes
router.get('/:sessionId', ctrl.getSession);
router.patch('/:sessionId/submit', requireRole(SORTING_ROLES), ctrl.submitSession);
router.patch('/:sessionId/reopen', requireRole(['ADMIN']), ctrl.reopenSession);

// Line routes
router.get('/:sessionId/lines', ctrl.listLines);
router.post('/:sessionId/lines', requireRole(SORTING_ROLES), validateSessionDraft, validatePctSum, ctrl.createLine);
router.put('/:sessionId/lines/:lineId', requireRole(SORTING_ROLES), validateSessionDraft, validatePctSum, ctrl.updateLine);
router.delete('/:sessionId/lines/:lineId', requireRole(SORTING_ROLES), validateSessionDraft, ctrl.deleteLine);

module.exports = router;
