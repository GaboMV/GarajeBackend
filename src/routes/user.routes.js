const express = require('express');
const router = express.Router();

const { register, login, approveUser, uploadKyc, getUserKyc, googleSignIn, getUserProfile } = require('../controllers/user.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Rutas públicas
/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Usuarios]
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
 *                 description: Correo electrónico del usuario
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *               nombre_completo:
 *                 type: string
 *                 description: Nombre completo del usuario
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Solicitud inválida
 */
router.post('/register', register);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Iniciar sesión con correo y contraseña
 *     tags: [Usuarios]
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
 *                 description: Correo electrónico del usuario
 *               password:
 *                 type: string
 *                 description: Contraseña del usuario
 *     responses:
 *       200:
 *         description: Sesión iniciada correctamente, retorna JWT
 *       401:
 *         description: No autorizado, credenciales inválidas
 */
router.post('/login', login);

/**
 * @swagger
 * /api/users/google:
 *   post:
 *     summary: Iniciar sesión / Registrarse con Google (OAuth 2.0)
 *     description: |
 *       El cliente autentica al usuario con Google directamente en Flutter.
 *       Luego envía el `idToken` a este endpoint.
 *       El backend lo verifica usando `google-auth-library`, busca o crea el usuario local, y retorna un JWT propio.
 *
 *       **Notas importantes:**
 *       - No requiere Firebase.
 *       - Requiere `GOOGLE_CLIENT_ID` configurado en el `.env`.
 *     tags: [Usuarios]
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
 *                 description: Token ID de Google obtenido tras autenticar en el cliente
 *     responses:
 *       200:
 *         description: JWT propio retornado.
 *       400:
 *         description: idToken faltante o inválido
 *       401:
 *         description: Token de Google expirado o inválido
 *       501:
 *         description: Google Client ID aún no configurado en el servidor
 */
router.post('/google', googleSignIn);

// Rutas protegidas (requieren token JWT)
/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario obtenido exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/profile', requireAuth, getUserProfile);

/**
 * @swagger
 * /api/users/kyc:
 *   post:
 *     summary: Subir documentos KYC (DNI + selfie)
 *     tags: [Usuarios]
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
 *                 description: Foto del DNI del usuario
 *               selfie:
 *                 type: string
 *                 format: binary
 *                 description: Selfie del usuario
 *     responses:
 *       200:
 *         description: Documentos KYC subidos exitosamente
 */
router.post('/kyc', requireAuth, upload.fields([{ name: 'dni_foto', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), uploadKyc);

// Rutas de administrador (requieren privilegios de admin)
/**
 * @swagger
 * /api/users/kyc/{idUsuario}:
 *   get:
 *     summary: Ver documentos KYC de un usuario (solo admin — genera URL con vigencia de 5 min)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUsuario
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a consultar
 *     responses:
 *       200:
 *         description: URLs temporales generadas exitosamente
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/kyc/:idUsuario', requireAdmin, getUserKyc);

/**
 * @swagger
 * /api/users/approve/{idUsuario}:
 *   post:
 *     summary: Aprobar un usuario verificado (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUsuario
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a aprobar
 *     responses:
 *       200:
 *         description: Usuario aprobado exitosamente
 */
router.post('/approve/:idUsuario', requireAdmin, approveUser);

module.exports = router;
