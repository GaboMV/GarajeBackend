const express = require('express');
const router = express.Router();

const { searchGarajes } = require('../controllers/search.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La ruta de búsqueda requiere estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Consultar garajes disponibles
// Ejemplo: GET /api/search?fecha=2026-03-01&hora_inicio=10:00&hora_fin=14:00
/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search for available garages
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to search (YYYY-MM-DD)
 *       - in: query
 *         name: hora_inicio
 *         schema:
 *           type: string
 *         description: Start time (HH:mm)
 *       - in: query
 *         name: hora_fin
 *         schema:
 *           type: string
 *         description: End time (HH:mm)
 *     responses:
 *       200:
 *         description: List of available garages
 */
router.get('/', searchGarajes);

module.exports = router;
