const express = require('express');
const router = express.Router();

const { checkIn, checkOut } = require('../controllers/operation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

/**
 * @swagger
 * /api/operations/{idReserva}/check-in:
 *   post:
 *     summary: Registrar check-in de una reserva pagada
 *     description: El dueño del garaje confirma la llegada del vendedor. Cambia el estado de la fecha de reserva a EN_PROGRESO.
 *     tags: [Operaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la reserva
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               evidencia:
 *                 type: string
 *                 format: binary
 *                 description: Foto de evidencia del check-in (opcional)
 *     responses:
 *       200:
 *         description: Check-in registrado exitosamente
 */
router.post('/:idReserva/check-in', checkIn);

/**
 * @swagger
 * /api/operations/{idReserva}/check-out:
 *   post:
 *     summary: Registrar check-out y liberar fondos al dueño del garaje
 *     description: Confirma la salida del vendedor. Los fondos retenidos se transfieren al saldo disponible del dueño.
 *     tags: [Operaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la reserva
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               evidencia:
 *                 type: string
 *                 format: binary
 *                 description: Foto de evidencia del check-out (opcional)
 *     responses:
 *       200:
 *         description: Check-out registrado y fondos liberados exitosamente
 */
router.post('/:idReserva/check-out', checkOut);

module.exports = router;
