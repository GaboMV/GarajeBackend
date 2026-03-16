const express = require('express');
const router = express.Router();

const { register, login, approveUser, uploadKyc, getUserKyc, googleSignIn } = require('../controllers/user.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

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

/**
 * @swagger
 * /api/users/auth/google:
 *   post:
 *     summary: Sign in / Sign up with Google (Firebase)
 *     description: |
 *       El cliente autentica al usuario con Google usando el SDK de Firebase.
 *       Luego envía el `idToken` que devuelve Firebase a este endpoint.
 *       El backend lo verifica, busca o crea el usuario local, y retorna un JWT propio.
 *
 *       **Notas importantes:**
 *       - Este endpoint reemplaza el flujo "Continuar con Google" del frontend.
 *       - No existe ni se necesita pantalla de OTP. El JWT se retorna directamente.
 *       - El campo `modo_actual` en la respuesta indica si el usuario ya eligió su rol
 *         o debe navegar a la pantalla ModeSelection.
 *       - Requiere `src/config/firebase.admin.js` inicializado (ver instrucciones).
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID Token obtenido tras autenticar con Google en el cliente
 *     responses:
 *       200:
 *         description: JWT propio retornado. Navegar a ModeSelection si modo_actual es null.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     correo: { type: string }
 *                     nombre_completo: { type: string }
 *                     esta_verificado: { type: boolean }
 *                     modo_actual: { type: string, nullable: true }
 *       400:
 *         description: idToken faltante o inválido
 *       401:
 *         description: Token de Google expirado
 *       501:
 *         description: Firebase Admin aún no configurado en el servidor
 */
router.post('/auth/google', googleSignIn);

// Protected routes (require token)
/**
 * @swagger
 * /api/users/kyc:
 *   post:
 *     summary: Upload KYC documents
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               dni_foto:
 *                 type: string
 *                 format: binary
 *               selfie:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: KYC documents uploaded successfully
 */
router.post('/kyc', requireAuth, upload.fields([{ name: 'dni_foto', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), uploadKyc);

// Admin routes (require admin privileges)
/**
 * @swagger
 * /api/users/kyc/{idUsuario}:
 *   get:
 *     summary: View User KYC Documents (Admin only - generates 5min URL)
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
 *         description: Ephemeral URLs generated successfully
 *       404:
 *         description: User not found
 */
router.get('/kyc/:idUsuario', requireAdmin, getUserKyc);
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
