const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/catalogueController');

router.use(authenticateToken);

router.get('/materials', ctrl.listMaterials);
router.post('/materials', requireRole(['ADMIN']), ctrl.createMaterial);
router.put('/materials/:id', requireRole(['ADMIN']), ctrl.updateMaterial);
router.put('/materials/:id/fractions', requireRole(['ADMIN']), ctrl.replaceMaterialFractions);

router.get('/fractions', ctrl.listFractions);
router.post('/fractions', requireRole(['ADMIN']), ctrl.createFraction);
router.put('/fractions/:id', requireRole(['ADMIN']), ctrl.updateFraction);

router.get('/product-types', ctrl.listProductTypes);
router.post('/product-types', requireRole(['ADMIN']), ctrl.createProductType);
router.put('/product-types/:id', requireRole(['ADMIN']), ctrl.updateProductType);

router.get('/sessions/:sessionId/entries', ctrl.listEntries);
router.post('/sessions/:sessionId/assets/:assetId/entries', requireRole(['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']), ctrl.createEntry);
router.put('/entries/:entryId', requireRole(['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']), ctrl.updateEntry);
router.delete('/entries/:entryId', requireRole(['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']), ctrl.deleteEntry);

router.get('/sessions/:sessionId/reusables', ctrl.listReusableItems);
router.put('/reusables/:id', requireRole(['SORTING_EMPLOYEE', 'GATE_OPERATOR', 'ADMIN']), ctrl.updateReusableItem);

module.exports = router;
