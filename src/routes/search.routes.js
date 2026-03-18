const express = require('express');
const router = express.Router();

const { searchGarajes } = require('../controllers/search.controller');
const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// La ruta de búsqueda requiere estar autenticado
router.use(requireAuth);

// Consultar garajes disponibles
// Ejemplo: GET /api/search?fecha=2026-03-01&hora_inicio=10:00&hora_fin=14:00
/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Buscar garajes disponibles por fecha y horario
 *     tags: [Búsqueda]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de búsqueda (formato AAAA-MM-DD)
 *       - in: query
 *         name: hora_inicio
 *         schema:
 *           type: string
 *         description: Hora de inicio (HH:mm)
 *       - in: query
 *         name: hora_fin
 *         schema:
 *           type: string
 *         description: Hora de fin (HH:mm)
 *     responses:
 *       200:
 *         description: Lista de garajes disponibles en el horario indicado
 */
router.get('/', searchGarajes);

module.exports = router;
