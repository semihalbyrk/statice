const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const wsController = require('../controllers/wasteStreamController');

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Waste Streams
router.get('/waste-streams', wsController.listWasteStreams);
router.post('/waste-streams', wsController.createWasteStream);
router.put('/waste-streams/:id', wsController.updateWasteStream);

// Product Categories
router.get('/product-categories', wsController.listProductCategories);
router.post('/product-categories', wsController.createProductCategory);
router.put('/product-categories/:id', wsController.updateProductCategory);

module.exports = router;
