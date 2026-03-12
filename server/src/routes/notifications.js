const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(authenticateToken);

router.get('/', ctrl.list);
router.patch('/:id/read', ctrl.markRead);
router.post('/mark-all-read', ctrl.markAllRead);

module.exports = router;
