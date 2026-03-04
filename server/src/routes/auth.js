const express = require('express');
const router = express.Router();
const { login, loginValidation, refresh, logout, me } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', loginValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);

module.exports = router;
