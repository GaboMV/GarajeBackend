const express = require('express');
const router = express.Router();

const { register, login, approveUser, uploadKyc } = require('../controllers/user.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (require token)
router.post('/kyc', requireAuth, uploadKyc);

// Admin routes (require admin privileges)
router.post('/approve/:idUsuario', requireAdmin, approveUser);

module.exports = router;
