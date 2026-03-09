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

// Crear un garaje
/**
 * @swagger
 * /api/garages:
 *   post:
 *     summary: Create a new garage
 *     tags: [Garages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Garage created successfully
 */
router.post('/', createGaraje);

// Agregar configuración a un garaje específico
/**
 * @swagger
 * /api/garages/{idGaraje}/horarios:
 *   post:
 *     summary: Add schedule to a garage
 *     tags: [Garages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Schedule added successfully
 */
router.post('/:idGaraje/horarios', addHorario);

/**
 * @swagger
 * /api/garages/{idGaraje}/servicios:
 *   post:
 *     summary: Add additional service to a garage
 *     tags: [Garages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service added successfully
 */
router.post('/:idGaraje/servicios', addServicioAdicional);

/**
 * @swagger
 * /api/garages/{idGaraje}/bloquear-fecha:
 *   post:
 *     summary: Block a date for a garage
 *     tags: [Garages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Date blocked successfully
 */
router.post('/:idGaraje/bloquear-fecha', blockDate);
/**
 * @swagger
 * /api/garages/{idGaraje}/imagenes:
 *   post:
 *     summary: Add image to a garage
 *     tags: [Garages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Image added successfully
 */
router.post('/:idGaraje/imagenes', upload.single('imagen'), addImagen);

module.exports = router;
