const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/processorController');

router.use(authenticateToken);

router.get('/', ctrl.list);
router.get('/validate', ctrl.validateCertificate);
router.post('/', requireRole(['ADMIN']), ctrl.create);
router.put('/:id', requireRole(['ADMIN']), ctrl.update);
router.post('/:id/certificates', requireRole(['ADMIN']), ctrl.createCertificate);
router.put('/certificates/:certificateId', requireRole(['ADMIN']), ctrl.updateCertificate);

module.exports = router;
