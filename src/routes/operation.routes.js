const express = require('express');
const router = express.Router();

const { checkIn, checkOut } = require('../controllers/operation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 5: Validar Checkin de una reserva pagada
router.post('/:idReserva/check-in', checkIn);

// Flujo 5: Validar Checkout, registrar limpieza y soltar fondos
router.post('/:idReserva/check-out', checkOut);

module.exports = router;
