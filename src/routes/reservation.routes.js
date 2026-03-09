const express = require('express');
const router = express.Router();

const { createReservation, payReservation } = require('../controllers/reservation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La reserva requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 4: Crear la reserva interactuando con Escrow y Comisiones
/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Reservation created successfully
 */
router.post('/', createReservation);

// Flujo 4: Pagar y enviar fondos a Cartera Retenida del Dueño
/**
 * @swagger
 * /api/reservations/{idReserva}/pagar:
 *   post:
 *     summary: Pay for a reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reservation paid successfully
 */
router.post('/:idReserva/pagar', payReservation);

module.exports = router;
