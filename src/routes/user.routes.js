const express = require('express');
const router = express.Router();

const { register, login, approveUser, uploadKyc, getUserKyc, googleSignIn } = require('../controllers/user.controller');
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
 * /api/users/auth/google:
 *   post:
 *     summary: Iniciar sesión / Registrarse con Google (Firebase)
 *     description: |
 *       El cliente autentica al usuario con Google usando el SDK de Firebase.
 *       Luego envía el `idToken` que devuelve Firebase a este endpoint.
 *       El backend lo verifica, busca o crea el usuario local, y retorna un JWT propio.
 *
 *       **Notas importantes:**
 *       - Este endpoint reemplaza el flujo "Continuar con Google" del frontend.
 *       - No existe ni se necesita pantalla de OTP. El JWT se retorna directamente.
 *       - El campo `modo_actual` en la respuesta indica si el usuario ya eligió su rol
 *         o debe navegar a la pantalla de selección de modo.
 *       - Requiere `src/config/firebase.admin.js` inicializado (ver instrucciones).
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
 *                 description: Token ID de Firebase obtenido tras autenticar con Google en el cliente
 *     responses:
 *       200:
 *         description: JWT propio retornado. Navegar a selección de modo si `modo_actual` es null.
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

// Rutas protegidas (requieren token JWT)
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
