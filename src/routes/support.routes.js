const express = require('express');
const router = express.Router();

const { reportIssue, resolveTicket, rateExperience } = require('../controllers/support.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');

router.use(requireAuth);
router.use(requireVerifiedKYC);

// Flujo 6: Botón de Pánico
router.post('/reservas/:idReserva/disputa', reportIssue);

// Resolución por el Admin
router.post('/tickets/:idTicket/resolver', requireAdmin, resolveTicket);

// Flujo 7: Calificaciones
router.post('/reservas/:idReserva/calificar', rateExperience);

module.exports = router;
