const express = require('express');
const router = express.Router();

const { getBalance, requestWithdrawal, approveWithdrawal } = require('../controllers/finance.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

// La operación requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Consultar saldo de su propia billetera
router.get('/billetera', getBalance);

// Reportar un retiro hacia cuenta bancaria
router.post('/billetera/retiros', requestWithdrawal);

// (Admin) Aprobar el retiro y liquidar la deuda
router.post('/billetera/retiros/:idSolicitud/aprobar', requireAdmin, approveWithdrawal);

module.exports = router;
