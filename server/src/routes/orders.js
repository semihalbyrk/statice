const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const orderController = require('../controllers/orderController');
const arrivalController = require('../controllers/arrivalController');
const planningController = require('../controllers/planningController');

// Multer config for order document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/orders', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const ORDER_WRITE_ROLES = ['ADMIN', 'LOGISTICS_PLANNER'];
const ORDER_READ_ROLES = ['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR', 'WEIGHBRIDGE_OPERATOR', 'SORTER'];

router.use(authenticateToken);

// Arrival endpoints (must come before /:id routes)
router.get('/match-plate', requireRole(['GATE_OPERATOR', 'ADMIN']), arrivalController.matchPlate);
router.post('/adhoc-arrival', requireRole(['GATE_OPERATOR', 'ADMIN']), arrivalController.adhocArrival);

// Planning board (before /:id routes)
router.get('/planning-board', requireRole(['ADMIN', 'LOGISTICS_PLANNER', 'GATE_OPERATOR']), planningController.getPlanningBoard);

// Order CRUD
router.get('/', orderController.list);
router.get('/:id', orderController.getById);
router.post('/:id/incident', requireRole(['GATE_OPERATOR', 'ADMIN']), planningController.setIncident);
router.post('/', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), orderController.create);
router.put('/:id', requireRole(['ADMIN', 'LOGISTICS_PLANNER']), orderController.update);
router.delete('/:id', requireRole(['ADMIN']), orderController.cancel);

// Document management
router.post('/:id/documents', requireRole(ORDER_WRITE_ROLES), upload.single('file'), orderController.uploadDocument);
router.get('/:id/documents', requireRole(ORDER_READ_ROLES), orderController.listDocuments);
router.get('/:id/documents/:docId/download', requireRole(ORDER_READ_ROLES), orderController.downloadDocument);
router.delete('/:id/documents/:docId', requireRole(ORDER_WRITE_ROLES), orderController.deleteDocument);

module.exports = router;
