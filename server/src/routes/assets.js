const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/assetsController');

router.use(authenticateToken);

// Static routes must come before /:id
router.get('/next-label', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.getNextLabel);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.create);
router.put('/:id', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.update);
router.delete('/:id', requireRole(['GATE_OPERATOR', 'ADMIN']), ctrl.remove);

module.exports = router;
