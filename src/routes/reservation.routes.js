const express = require('express');
const router = express.Router();

const { createReservation, payReservation } = require('../controllers/reservation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La reserva requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 4: Crear la reserva interactuando con Escrow y Comisiones
router.post('/', createReservation);

// Flujo 4: Pagar y enviar fondos a Cartera Retenida del Dueño
router.post('/:idReserva/pagar', payReservation);

module.exports = router;
