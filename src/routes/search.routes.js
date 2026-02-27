const express = require('express');
const router = express.Router();

const { searchGarajes } = require('../controllers/search.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La ruta de búsqueda requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Consultar garajes disponibles
// Ejemplo: GET /api/search?fecha=2026-03-01&hora_inicio=10:00&hora_fin=14:00
router.get('/', searchGarajes);

module.exports = router;
