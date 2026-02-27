const express = require('express');
const router = express.Router();

const {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen
} = require('../controllers/garage.controller');

const { requireAuth, requireVerifiedKYC } = require('../middlewares/auth.middleware');

// Todas estas rutas requieren estar autenticado y verificado
router.use(requireAuth);
router.use(requireVerifiedKYC);

// Crear un garaje
router.post('/', createGaraje);

// Agregar configuración a un garaje específico
router.post('/:idGaraje/horarios', addHorario);
router.post('/:idGaraje/servicios', addServicioAdicional);
router.post('/:idGaraje/bloquear-fecha', blockDate);
router.post('/:idGaraje/imagenes', addImagen);

module.exports = router;
