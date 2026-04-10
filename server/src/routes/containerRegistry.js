const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/containerRegistryController');

router.use(authenticateToken);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', requireRole(['ADMIN']), ctrl.create);
router.put('/:id', requireRole(['ADMIN']), ctrl.update);
router.delete('/:id', requireRole(['ADMIN']), ctrl.remove);

module.exports = router;
