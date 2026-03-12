const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const reportsController = require('../controllers/reportsController');
const scheduleController = require('../controllers/scheduleController');

router.use(authenticateToken);
router.use(requireRole(['REPORTING_MANAGER', 'ADMIN']));

// Report generation & management
router.post('/generate', reportsController.generate);
router.get('/', reportsController.list);

// Schedule CRUD — must be before /:id routes to avoid param collision
router.get('/schedules', scheduleController.list);
router.post('/schedules', scheduleController.create);
router.get('/schedules/:id', scheduleController.getById);
router.put('/schedules/:id', scheduleController.update);
router.delete('/schedules/:id', scheduleController.remove);

// Report download & delete
router.get('/:id/download', reportsController.download);
router.delete('/:id', requireRole(['ADMIN']), reportsController.deleteReport);

module.exports = router;
