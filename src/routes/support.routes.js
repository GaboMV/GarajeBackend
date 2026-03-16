const express = require('express');
const router = express.Router();

const { reportIssue, resolveTicket, rateExperience } = require('../controllers/support.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

router.use(requireAuth);
router.use(requireVerifiedKYC);

/**
 * @swagger
 * /api/support/reservas/{idReserva}/disputa:
 *   post:
 *     summary: Reportar un problema o disputa en una reserva
 *     description: Crea un ticket de soporte asociado a la reserva. El administrador podrá revisarlo y resolverlo.
 *     tags: [Soporte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la reserva con el problema
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo_problema
 *               - descripcion
 *             properties:
 *               tipo_problema:
 *                 type: string
 *                 description: Tipo de problema reportado
 *               descripcion:
 *                 type: string
 *                 description: Descripción detallada del problema
 *     responses:
 *       200:
 *         description: Disputa reportada exitosamente. Se creó un ticket de soporte.
 */
router.post('/reservas/:idReserva/disputa', reportIssue);

/**
 * @swagger
 * /api/support/tickets/{idTicket}/resolver:
 *   post:
 *     summary: Resolver un ticket de soporte (solo admin)
 *     description: El administrador revisa el ticket y registra la resolución. El ticket queda cerrado.
 *     tags: [Soporte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idTicket
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del ticket a resolver
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolucion
 *             properties:
 *               resolucion:
 *                 type: string
 *                 description: Texto con la resolución del administrador
 *     responses:
 *       200:
 *         description: Ticket resuelto exitosamente
 */
router.post('/tickets/:idTicket/resolver', requireAdmin, resolveTicket);

/**
 * @swagger
 * /api/support/reservas/{idReserva}/calificar:
 *   post:
 *     summary: Calificar la experiencia de una reserva
 *     description: Permite al dueño o al vendedor calificar la experiencia una vez finalizada la reserva.
 *     tags: [Soporte]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la reserva a calificar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - puntuacion
 *             properties:
 *               puntuacion:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Puntuación del 1 al 5
 *               comentario:
 *                 type: string
 *                 description: Comentario opcional sobre la experiencia
 *     responses:
 *       200:
 *         description: Calificación registrada exitosamente
 */
router.post('/reservas/:idReserva/calificar', rateExperience);

module.exports = router;
