const express = require('express');
const router = express.Router();

const { checkIn, checkOut } = require('../controllers/operation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 5: Validar Checkin de una reserva pagada
/**
 * @swagger
 * /api/operations/{idReserva}/check-in:
 *   post:
 *     summary: Validate check-in for a paid reservation
 *     tags: [Operations]
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
 *         description: Check-in validated successfully
 */
router.post('/:idReserva/check-in', checkIn);

// Flujo 5: Validar Checkout, registrar limpieza y soltar fondos
/**
 * @swagger
 * /api/operations/{idReserva}/check-out:
 *   post:
 *     summary: Validate check-out and release funds
 *     tags: [Operations]
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
 *         description: Check-out validated successfully
 */
router.post('/:idReserva/check-out', checkOut);

module.exports = router;
