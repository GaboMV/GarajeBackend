const express = require('express');
const router = express.Router();

const { getBalance, requestWithdrawal, approveWithdrawal } = require('../controllers/finance.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

/**
 * @swagger
 * /api/finances/billetera:
 *   get:
 *     summary: Consultar saldo de la billetera virtual propia
 *     description: Retorna el saldo disponible y el saldo retenido (fondos pendientes de liberar) del usuario autenticado.
 *     tags: [Finanzas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de la billetera del usuario
 *         content:
 *           application/json:
 *             example:
 *               saldo_disponible: 150.00
 *               saldo_retenido: 50.00
 */
router.get('/billetera', getBalance);

/**
 * @swagger
 * /api/finances/billetera/retiros:
 *   post:
 *     summary: Solicitar retiro del saldo disponible a cuenta bancaria
 *     tags: [Finanzas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - monto
 *               - cuenta_bancaria
 *             properties:
 *               monto:
 *                 type: number
 *                 description: Monto a retirar
 *               cuenta_bancaria:
 *                 type: string
 *                 description: Número de cuenta bancaria destino
 *     responses:
 *       201:
 *         description: Solicitud de retiro creada exitosamente, pendiente de aprobación por el administrador
 */
router.post('/billetera/retiros', requestWithdrawal);

/**
 * @swagger
 * /api/finances/billetera/retiros/{idSolicitud}/aprobar:
 *   post:
 *     summary: Aprobar una solicitud de retiro (solo admin)
 *     description: El administrador aprueba el retiro y registra la liquidación. El saldo disponible se descuenta del usuario.
 *     tags: [Finanzas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idSolicitud
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la solicitud de retiro
 *     responses:
 *       200:
 *         description: Retiro aprobado y liquidado exitosamente
 */
router.post('/billetera/retiros/:idSolicitud/aprobar', requireAdmin, approveWithdrawal);

module.exports = router;
