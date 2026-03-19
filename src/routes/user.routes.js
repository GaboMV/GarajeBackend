const express = require('express');
const router = express.Router();

const { register, login, approveUser, rejectUser, uploadKyc, getUserKyc, googleSignIn, getUserProfile, getPendingKycUsers } = require('../controllers/user.controller');
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
 *     summary: Subir documentos KYC (DNI + selfie + teléfono)
 *     description: |
 *       Envía los documentos de identidad y un número de teléfono boliviano válido para iniciar
 *       el proceso de verificación KYC. El estado del usuario pasa a `PENDIENTE`.
 *       **Formato válido de teléfono:** debe empezar con 6 o 7 y tener 8 dígitos (ej: `74000123`).
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - dni_foto
 *               - selfie
 *               - telefono
 *             properties:
 *               dni_foto:
 *                 type: string
 *                 format: binary
 *                 description: Foto frontal y legible del DNI
 *               selfie:
 *                 type: string
 *                 format: binary
 *                 description: Selfie del usuario sosteniendo el DNI
 *               telefono:
 *                 type: string
 *                 description: "Número boliviano (8 dígitos, empieza con 6 o 7). Ej: 74000123"
 *                 example: "74000123"
 *     responses:
 *       200:
 *         description: Documentos KYC enviados correctamente, estado cambia a PENDIENTE
 *       400:
 *         description: Teléfono inválido o faltan documentos
 */
router.post('/kyc', requireAuth, upload.fields([{ name: 'dni_foto', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), uploadKyc);

// Rutas de administrador (requieren privilegios de admin)
/**
 * @swagger
 * /api/users/kyc/pending:
 *   get:
 *     summary: Listar todas las solicitudes KYC pendientes (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios pendientes de verificación
 */
router.get('/kyc/pending', requireAuth, requireAdmin, getPendingKycUsers);

/**
 * @swagger
 * /api/users/kyc/{idUsuario}:
 *   get:
 *     summary: Ver documentos KYC de un usuario (solo admin — genera URLs firmadas con vigencia de 5 min)
 *     description: |
 *       Retorna los campos del usuario incluyendo URLs firmadas temporales para `dni_foto_url` y `selfie_url`,
 *       además del número de `telefono` registrado durante el proceso KYC.
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
 *         description: URLs temporales y datos KYC generados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 correo: { type: string }
 *                 esta_verificado: { type: string, enum: [NO_VERIFICADO, PENDIENTE, VERIFICADO, RECHAZADO] }
 *                 telefono: { type: string, example: "74000123" }
 *                 dni_foto_url: { type: string, description: "URL firmada válida por 5 min" }
 *                 selfie_url: { type: string, description: "URL firmada válida por 5 min" }
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/kyc/:idUsuario', requireAuth, requireAdmin, getUserKyc);

/**
 * @swagger
 * /api/users/approve/{idUsuario}:
 *   post:
 *     summary: Aprobar un usuario verificado (solo admin)
 *     description: |
 *       Cambia el estado del usuario a `VERIFICADO`.
 *       **Además emite un evento WebSocket `kyc_approved` al usuario** con el mensaje de confirmación,
 *       lo que actualiza la UI de la app en tiempo real sin necesidad de que el usuario recargue.
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
 *         description: Usuario aprobado. Emite evento WebSocket `kyc_approved` al cliente.
 *       400:
 *         description: El usuario ya estaba verificado
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/approve/:idUsuario', requireAuth, requireAdmin, approveUser);

/**
 * @swagger
 * /api/users/reject/{idUsuario}:
 *   post:
 *     summary: Rechazar verificación de usuario con un motivo (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUsuario
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a rechazar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - motivo
 *             properties:
 *               motivo:
 *                 type: string
 *                 description: Razón por la cual se rechaza el KYC
 *     responses:
 *       200:
 *         description: Usuario rechazado correctamente
 *       400:
 *         description: Falta el motivo de rechazo
 */
router.post('/reject/:idUsuario', requireAuth, requireAdmin, rejectUser);

module.exports = router;
