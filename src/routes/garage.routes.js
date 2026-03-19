const express = require('express');
const router = express.Router();

const {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen,
    getMyGarages,
    getGarageById,
    updateGarage,
    getPendingGarages,
    approveGarage,
    uploadPropertyDoc
} = require('../controllers/garage.controller');
const { requireAuth, requireVerifiedKYC, requireAdmin } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// La gestión básica requiere estar autenticado
router.use(requireAuth);

/**
 * @swagger
 * /api/garages:
 *   post:
 *     summary: Crear un nuevo garaje (solicitud de publicación)
 *     description: |
 *       Crea un garaje con todos los datos en una sola petición `multipart/form-data`.
 *       El garaje se crea con `esta_aprobado: false` y queda pendiente de aprobación por un administrador.
 *       
 *       **Campos de texto** se envían como fields del formulario.
 *       **Imágenes** se suben al bucket público con clave `imagenes[]` (máx. 5).
 *       **Documento de propiedad** se sube al bucket privado con clave `documento` (1 archivo).
 *       
 *       Requiere KYC verificado.
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del espacio
 *                 example: "Garaje amplio en el centro"
 *               descripcion:
 *                 type: string
 *                 description: Descripción del espacio
 *               direccion:
 *                 type: string
 *                 description: Dirección textual del garaje
 *               latitud:
 *                 type: number
 *                 format: float
 *                 description: Coordenada de latitud (se convierte a PostGIS)
 *               longitud:
 *                 type: number
 *                 format: float
 *                 description: Coordenada de longitud
 *               precio_hora:
 *                 type: number
 *                 format: float
 *                 description: Precio en Bs por hora
 *               precio_dia:
 *                 type: number
 *                 format: float
 *                 description: Precio en Bs por día
 *               minimo_horas:
 *                 type: integer
 *                 description: Mínimo de horas para reservar (default 1)
 *               tiempo_limpieza:
 *                 type: integer
 *                 description: Minutos de limpieza entre reservas (default 0)
 *               tiene_wifi:
 *                 type: boolean
 *                 description: "true o false como string"
 *               tiene_bano:
 *                 type: boolean
 *               tiene_electricidad:
 *                 type: boolean
 *               tiene_mesa:
 *                 type: boolean
 *               documento:
 *                 type: string
 *                 format: binary
 *                 description: Foto o imagen del título de propiedad / factura / contrato (guardado en bucket PRIVADO)
 *               imagenes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Fotos del garaje — máximo 5 (guardadas en bucket PÚBLICO)
 *     responses:
 *       201:
 *         description: Garaje creado, pendiente de aprobación del administrador
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 garaje:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     nombre: { type: string }
 *                     esta_aprobado: { type: boolean, example: false }
 *                     documento_propiedad_url: { type: string }
 *       400:
 *         description: Faltan campos obligatorios (nombre o precio)
 *       401:
 *         description: No autenticado
 *       403:
 *         description: KYC no verificado
 */
router.post('/', requireVerifiedKYC, upload.fields([
    { name: 'imagenes', maxCount: 5 },
    { name: 'documento', maxCount: 1 }
]), createGaraje);

/**
 * @swagger
 * /api/garages/me:
 *   get:
 *     summary: Obtener los garajes del usuario autenticado
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de garajes obtenida exitosamente
 */
router.get('/me', getMyGarages);

/**
 * @swagger
 * /api/garages/{idGaraje}:
 *   get:
 *     summary: Obtener el detalle completo de un garaje específico
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Detalle del garaje obtenido exitosamente
 *       404:
 *         description: Garaje no encontrado
 */
router.get('/:idGaraje', getGarageById);

/**
 * @swagger
 * /api/garages/{idGaraje}:
 *   put:
 *     summary: Editar un garaje existente
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               direccion: { type: string }
 *               precio_hora: { type: number }
 *               precio_dia: { type: number }
 *               capacidad_puestos: { type: integer }
 *     responses:
 *       200:
 *         description: Garaje actualizado exitosamente
 *       403:
 *         description: No tienes permisos sobre este garaje
 *       404:
 *         description: Garaje no encontrado
 */
router.put('/:idGaraje', requireVerifiedKYC, updateGarage);

/**
 * @swagger
 * /api/garages/{idGaraje}/horarios:
 *   post:
 *     summary: Agregar horario semanal a un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Horario agregado exitosamente
 */
router.post('/:idGaraje/horarios', requireVerifiedKYC, addHorario);

/**
 * @swagger
 * /api/garages/{idGaraje}/servicios:
 *   post:
 *     summary: Agregar servicio adicional a un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Servicio adicional agregado exitosamente
 */
router.post('/:idGaraje/servicios', requireVerifiedKYC, addServicioAdicional);

/**
 * @swagger
 * /api/garages/{idGaraje}/bloquear-fecha:
 *   post:
 *     summary: Bloquear una fecha específica en un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     responses:
 *       200:
 *         description: Fecha bloqueada exitosamente
 */
router.post('/:idGaraje/bloquear-fecha', requireVerifiedKYC, blockDate);

/**
 * @swagger
 * /api/garages/{idGaraje}/imagenes:
 *   post:
 *     summary: Subir imagen de un garaje
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *                 description: Imagen del garaje
 *     responses:
 *       200:
 *         description: Imagen subida exitosamente
 */
router.post('/:idGaraje/imagenes', requireVerifiedKYC, upload.single('imagen'), addImagen);

/**
 * @swagger
 * /api/garages/{idGaraje}/documento-propiedad:
 *   post:
 *     summary: Actualizar el documento legal de propiedad de un garaje existente (Bucket PRIVADO)
 *     description: |
 *       Permite subir o reemplazar el documento de propiedad de un garaje ya creado.
 *       El archivo se guarda en el bucket **privado** de R2; solo el admin puede obtener la URL firmada.
 *       Nota: En la creación con `POST /api/garages` ya se puede enviar el documento en el mismo formulario.
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [documento]
 *             properties:
 *               documento:
 *                 type: string
 *                 format: binary
 *                 description: Foto o imagen del documento de propiedad
 *     responses:
 *       200:
 *         description: Documento actualizado exitosamente
 *       403:
 *         description: No tienes permiso sobre este garaje
 */
router.post('/:idGaraje/documento-propiedad', requireAuth, upload.single('documento'), uploadPropertyDoc);

/**
 * @swagger
 * /api/garages/admin/pending:
 *   get:
 *     summary: Listar garajes pendientes de aprobación (solo admin)
 *     description: |
 *       Retorna todos los garajes con `esta_aprobado: false`.
 *       Para cada garaje con `documento_propiedad_url`, genera una URL **firmada temporal** (5 min)
 *       en el campo `documento_propiedad_presigned` para que el admin pueda visualizarlo sin exponer el bucket privado.
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de garajes pendientes con URLs firmadas para documentos privados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 garajes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       nombre: { type: string }
 *                       esta_aprobado: { type: boolean, example: false }
 *                       documento_propiedad_url: { type: string, description: "Ruta interna en R2" }
 *                       documento_propiedad_presigned: { type: string, description: "URL firmada válida 5 min" }
 */
router.get('/admin/pending', requireAuth, requireAdmin, getPendingGarages);

/**
 * @swagger
 * /api/garages/admin/approve/{idGaraje}:
 *   post:
 *     summary: Aprobar la publicación de un garaje (solo admin)
 *     description: |
 *       Cambia `esta_aprobado` a `true` en la base de datos.
 *       **Emite el evento WebSocket `garage_approved`** al propietario del garaje,
 *       actualizando la UI de la app en tiempo real (cambia de «Solicitud en atención» a «Mis Garajes»).
 *     tags: [Garajes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idGaraje
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del garaje a aprobar
 *     responses:
 *       200:
 *         description: Garaje aprobado. Emite evento WebSocket `garage_approved` al propietario.
 *       404:
 *         description: Garaje no encontrado
 */
router.post('/admin/approve/:idGaraje', requireAuth, requireAdmin, approveGarage);

module.exports = router;
