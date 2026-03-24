const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/invoiceController');

const FINANCE_ROLES = ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_USER'];

router.use(authenticateToken);

// Static paths and sub-resource paths BEFORE /:id to avoid conflicts
router.get('/completed-orders/:supplierId', requireRole(FINANCE_ROLES), ctrl.getCompletedOrders);
router.put('/lines/:lineId', requireRole(FINANCE_ROLES), ctrl.updateLine);
router.delete('/lines/:lineId', requireRole(FINANCE_ROLES), ctrl.deleteLine);

router.get('/', requireRole(FINANCE_ROLES), ctrl.list);
router.post('/', requireRole(FINANCE_ROLES), ctrl.generateSupplierInvoice);
router.get('/:id', requireRole(FINANCE_ROLES), ctrl.getById);
router.get('/:id/pdf', requireRole(FINANCE_ROLES), ctrl.previewPdf);
router.put('/:id/status', requireRole(FINANCE_ROLES), ctrl.updateStatus);
router.post('/:id/lines', requireRole(FINANCE_ROLES), ctrl.addLine);

module.exports = router;
