const express = require('express');
const router = express.Router();

const { createReservation, payReservation, getMyReservations, getOwnerReservations, getReservationById, approveReservation, rejectReservation } = require('../controllers/reservation.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La reserva requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

/**
 * @swagger
 * /api/reservations/me:
 *   get:
 *     summary: Obtener mis reservas (como cliente/vendedor)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reservas obtenida exitosamente
 */
router.get('/me', getMyReservations);

/**
 * @swagger
 * /api/reservations/owner:
 *   get:
 *     summary: Obtener las reservas recibidas (como dueño de garaje)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reservas recibidas obtenida exitosamente
 */
router.get('/owner', getOwnerReservations);

/**
 * @swagger
 * /api/reservations/{idReserva}:
 *   get:
 *     summary: Obtener el detalle de una reserva específica
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la reserva
 *     responses:
 *       200:
 *         description: Detalle de la reserva obtenido exitosamente
 *       403:
 *         description: No tienes permisos para ver esta reserva
 *       404:
 *         description: Reserva no encontrada
 */
router.get('/:idReserva', getReservationById);

/**
 * @swagger
 * /api/reservations/{idReserva}/approve:
 *   post:
 *     summary: Aprobar una solicitud de reserva (solo el dueño del garaje)
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reserva aprobada exitosamente
 */
router.post('/:idReserva/approve', approveReservation);

/**
 * @swagger
 * /api/reservations/{idReserva}/reject:
 *   post:
 *     summary: Rechazar o cancelar una solicitud de reserva
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reserva rechazada/cancelada exitosamente
 */
router.post('/:idReserva/reject', rejectReservation);

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Crear una nueva reserva
 *     description: Crea la reserva, calcula el precio total según tipo de cobro y retiene fondos en la billetera del dueño.
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_garaje
 *               - tipo_cobro
 *               - fechas
 *               - acepto_terminos_responsabilidad
 *             properties:
 *               id_garaje:
 *                 type: string
 *                 format: uuid
 *                 description: ID del garaje a reservar
 *               tipo_cobro:
 *                 type: string
 *                 enum: [POR_HORA, POR_DIA]
 *                 description: Modalidad de cobro
 *               mensaje_inicial:
 *                 type: string
 *                 description: Mensaje opcional para el dueño del garaje
 *               fechas:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fecha:
 *                       type: string
 *                       format: date
 *                     hora_inicio:
 *                       type: string
 *                     hora_fin:
 *                       type: string
 *               categorias:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs de categorías de productos
 *               acepto_terminos_responsabilidad:
 *                 type: boolean
 *                 description: Aceptación de los términos de responsabilidad
 *     responses:
 *       201:
 *         description: Reserva creada exitosamente con precio calculado y desglose de comisión
 */
router.post('/', createReservation);

/**
 * @swagger
 * /api/reservations/{idReserva}/pagar:
 *   post:
 *     summary: Pagar una reserva y transferir fondos a la billetera retenida del dueño
 *     tags: [Reservas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la reserva a pagar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metodo:
 *                 type: string
 *                 enum: [QR, TARJETA]
 *                 description: Método de pago utilizado
 *     responses:
 *       200:
 *         description: Reserva pagada exitosamente
 */
router.post('/:idReserva/pagar', payReservation);

module.exports = router;
