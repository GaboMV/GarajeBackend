const express = require('express');
const router = express.Router();

const { getBalance, requestWithdrawal, approveWithdrawal } = require('../controllers/finance.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Consultar saldo de su propia billetera
/**
 * @swagger
 * /api/finances/billetera:
 *   get:
 *     summary: Get balance of own wallet
 *     tags: [Finances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance
 */
router.get('/billetera', getBalance);

// Reportar un retiro hacia cuenta bancaria
/**
 * @swagger
 * /api/finances/billetera/retiros:
 *   post:
 *     summary: Request a withdrawal to bank account
 *     tags: [Finances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Withdrawal requested successfully
 */
router.post('/billetera/retiros', requestWithdrawal);

// (Admin) Aprobar el retiro y liquidar la deuda
/**
 * @swagger
 * /api/finances/billetera/retiros/{idSolicitud}/aprobar:
 *   post:
 *     summary: Approve a withdrawal (Admin only)
 *     tags: [Finances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idSolicitud
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Withdrawal approved successfully
 */
router.post('/billetera/retiros/:idSolicitud/aprobar', requireAdmin, approveWithdrawal);

module.exports = router;
