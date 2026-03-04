const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.use(authenticateToken);

router.get('/stats', dashboardController.getStats);

module.exports = router;
