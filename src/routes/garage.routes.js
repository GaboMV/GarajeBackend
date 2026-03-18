const express = require('express');
const router = express.Router();

const {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen,
    getMyGarages,
    getGarageById,
    updateGarage,
    getPendingGarages,
    approveGarage,
    uploadPropertyDoc
} = require('../controllers/garage.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Todas estas rutas requieren estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

/**
 * @swagger
 * /api/garages:
 *   post:
 *     summary: Crear un nuevo garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del garaje
 *               direccion:
 *                 type: string
 *                 description: Dirección del garaje
 *               lat:
 *                 type: number
 *                 description: Latitud
 *               lng:
 *                 type: number
 *                 description: Longitud
 *               precio_hora:
 *                 type: number
 *                 description: Precio por hora
 *               precio_dia:
 *                 type: number
 *                 description: Precio por día
 *               capacidad:
 *                 type: integer
 *                 description: Capacidad máxima
 *     responses:
 *       201:
 *         description: Garaje creado exitosamente
 */
router.post('/', createGaraje);

/**
 * @swagger
 * /api/garages/me:
 *   get:
 *     summary: Obtener los garajes del usuario autenticado
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de garajes obtenida exitosamente
 */
router.get('/me', getMyGarages);

/**
 * @swagger
 * /api/garages/{idGaraje}:
 *   get:
 *     summary: Obtener el detalle completo de un garaje específico
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Detalle del garaje obtenido exitosamente
 *       404:
 *         description: Garaje no encontrado
 */
router.get('/:idGaraje', getGarageById);

/**
 * @swagger
 * /api/garages/{idGaraje}:
 *   put:
 *     summary: Editar un garaje existente
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               direccion: { type: string }
 *               precio_hora: { type: number }
 *               precio_dia: { type: number }
 *               capacidad_puestos: { type: integer }
 *     responses:
 *       200:
 *         description: Garaje actualizado exitosamente
 *       403:
 *         description: No tienes permisos sobre este garaje
 *       404:
 *         description: Garaje no encontrado
 */
router.put('/:idGaraje', updateGarage);

/**
 * @swagger
 * /api/garages/{idGaraje}/horarios:
 *   post:
 *     summary: Agregar horario semanal a un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Horario agregado exitosamente
 */
router.post('/:idGaraje/horarios', addHorario);

/**
 * @swagger
 * /api/garages/{idGaraje}/servicios:
 *   post:
 *     summary: Agregar servicio adicional a un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Servicio adicional agregado exitosamente
 */
router.post('/:idGaraje/servicios', addServicioAdicional);

/**
 * @swagger
 * /api/garages/{idGaraje}/bloquear-fecha:
 *   post:
 *     summary: Bloquear una fecha específica en un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Fecha bloqueada exitosamente
 */
router.post('/:idGaraje/bloquear-fecha', blockDate);

/**
 * @swagger
 * /api/garages/{idGaraje}/imagenes:
 *   post:
 *     summary: Subir imagen de un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *                 description: Imagen del garaje
 *     responses:
 *       200:
 *         description: Imagen subida exitosamente
 */
router.post('/:idGaraje/imagenes', upload.single('imagen'), addImagen);

/**
 * @swagger
 * /api/garages/{idGaraje}/documento-propiedad:
 *   post:
 *     summary: Subir documento legal que comprueba la propiedad del garaje (Bucket PRIVADO)
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:idGaraje/documento-propiedad', requireAuth, upload.single('documento'), uploadPropertyDoc);

/**
 * @swagger
 * /api/garages/admin/pending:
 *   get:
 *     summary: Listar garajes pendientes de aprobación (solo admin)
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/pending', requireAuth, requireAdmin, getPendingGarages);

/**
 * @swagger
 * /api/garages/admin/approve/{idGaraje}:
 *   post:
 *     summary: Aprobar un garaje (solo admin)
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/approve/:idGaraje', requireAuth, requireAdmin, approveGarage);

module.exports = router;
