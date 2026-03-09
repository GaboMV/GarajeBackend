const express = require('express');
const router = express.Router();

const { register, login, approveUser, uploadKyc } = require('../controllers/user.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

// Public routes
/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - password
 *             properties:
 *               correo:
 *                 type: string
 *               password:
 *                 type: string
 *               nombre_completo:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
router.post('/register', register);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - password
 *             properties:
 *               correo:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Unauthorized
 */
router.post('/login', login);

// Protected routes (require token)
/**
 * @swagger
 * /api/users/kyc:
 *   post:
 *     summary: Upload KYC documents
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC documents uploaded successfully
 */
router.post('/kyc', requireAuth, uploadKyc);

// Admin routes (require admin privileges)
/**
 * @swagger
 * /api/users/approve/{idUsuario}:
 *   post:
 *     summary: Approve a user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUsuario
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User approved successfully
 */
router.post('/approve/:idUsuario', requireAdmin, approveUser);

module.exports = router;
