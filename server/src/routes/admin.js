const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const wsController = require('../controllers/wasteStreamController');
const usersController = require('../controllers/usersController');
const auditController = require('../controllers/auditController');
const settingsController = require('../controllers/settingsController');

router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

// Users
router.get('/users', usersController.list);
router.post('/users', usersController.create);
router.get('/users/:id', usersController.getById);
router.put('/users/:id', usersController.update);
router.post('/users/:id/reset-password', usersController.resetPassword);
router.patch('/users/:id/status', usersController.toggleStatus);
router.get('/users/:id/activity', usersController.getActivity);

// Audit Log
router.get('/audit-logs', auditController.list);
router.get('/audit-logs/:id', auditController.getById);

// Settings
router.get('/settings', settingsController.get);
router.put('/settings', settingsController.update);

// Waste Streams
router.get('/waste-streams', wsController.listWasteStreams);
router.post('/waste-streams', wsController.createWasteStream);
router.put('/waste-streams/:id', wsController.updateWasteStream);

// Product Categories
router.get('/product-categories', wsController.listProductCategories);
router.post('/product-categories', wsController.createProductCategory);
router.put('/product-categories/:id', wsController.updateProductCategory);
router.delete('/product-categories/:id', wsController.deleteProductCategory);

module.exports = router;
