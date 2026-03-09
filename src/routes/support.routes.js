const express = require('express');
const router = express.Router();

const { reportIssue, resolveTicket, rateExperience } = require('../controllers/support.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 6: Botón de Pánico
/**
 * @swagger
 * /api/support/reservas/{idReserva}/disputa:
 *   post:
 *     summary: Report an issue/dispute for a reservation
 *     tags: [Support]
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
 *         description: Issue reported successfully
 */
router.post('/reservas/:idReserva/disputa', reportIssue);

/**
 * @swagger
 * /api/support/tickets/{idTicket}/resolver:
 *   post:
 *     summary: Resolve a support ticket (Admin only)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idTicket
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket resolved successfully
 */
router.post('/tickets/:idTicket/resolver', requireAdmin, resolveTicket);

/**
 * @swagger
 * /api/support/reservas/{idReserva}/calificar:
 *   post:
 *     summary: Rate the experience for a reservation
 *     tags: [Support]
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
 *         description: Experience rated successfully
 */
router.post('/reservas/:idReserva/calificar', rateExperience);

module.exports = router;
