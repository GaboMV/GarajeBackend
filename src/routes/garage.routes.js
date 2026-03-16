const express = require('express');
const router = express.Router();

const {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen
} = require('../controllers/garage.controller');

const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');
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

module.exports = router;
