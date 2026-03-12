const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth.middleware');
const { getMessages, generatePresignedUrl, getAdjuntoUrl } = require('../controllers/chat.controller');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: |
 *     ## Chat en Tiempo Real (Socket.io + REST)
 *
 *     El chat usa **WebSocket (Socket.io)** montado en el **mismo servidor** que el API REST.
 *     No necesitas un servidor aparte. El mismo puerto (ej: `https://tu-backend.onrender.com`)
 *     sirve tanto HTTP como WebSocket.
 *
 *     ---
 *     ### ¿Cómo conectarse al Chat?
 *
 *     **1. Conectar el socket con JWT:**
 *     ```js
 *     const socket = io("https://tu-backend.onrender.com", {
 *       auth: { token: "Bearer eyJ..." }
 *     });
 *     ```
 *
 *     **2. Unirse al Room de la Reserva:**
 *     ```js
 *     socket.emit("join_room", { reservaId: "uuid-de-la-reserva" });
 *     socket.on("joined_room", (data) => console.log(data.message));
 *     ```
 *
 *     **3. Enviar un mensaje de texto:**
 *     ```js
 *     socket.emit("send_message", {
 *       reservaId: "uuid-de-la-reserva",
 *       contenido: "Hola, ¿podemos acordar el horario?"
 *     });
 *     ```
 *
 *     **4. Enviar un mensaje con imagen adjunta:**
 *     ```js
 *     // Paso A: Pedir Presigned URL (endpoint POST /api/chat/presigned-url)
 *     // Paso B: Hacer PUT directo a R2 con la foto
 *     // Paso C: Enviar el mensaje con la URL pública
 *     socket.emit("send_message", {
 *       reservaId: "uuid-de-la-reserva",
 *       contenido: "Te mando foto del local",
 *       url_adjunto: "https://pub-xxx.r2.dev/chat/foto.jpg"
 *     });
 *     ```
 *
 *     **5. Recibir mensajes en tiempo real:**
 *     ```js
 *     socket.on("receive_message", (mensaje) => {
 *       // { id, contenido, fecha_creacion, emisor: { nombre_completo }, adjuntos: [] }
 *       console.log(mensaje);
 *     });
 *     ```
 *
 *     **6. Salir del Chat:**
 *     ```js
 *     socket.emit("leave_room", { reservaId });
 *     ```
 *
 *     ---
 *     ### Reglas de Seguridad
 *     - Solo el **dueño del garaje** y el **vendedor** de la reserva pueden unirse al room.
 *     - Cualquier socket sin JWT válido es rechazado **antes de conectarse**.
 *     - Los mensajes siempre se persisten en PostgreSQL y se pueden recuperar via REST.
 */

/**
 * @swagger
 * /api/chat/{idReserva}/mensajes:
 *   get:
 *     summary: Obtener historial de mensajes de una reserva (últimos 50)
 *     description: Retorna todos los mensajes guardados en BD para esa reserva. Paginado con `skip` y `take`.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idReserva
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la Reserva cuyo chat quieres consultar
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Cuántos mensajes saltar (para paginación)
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cuántos mensajes traer
 *     responses:
 *       200:
 *         description: Lista de mensajes con información del emisor y adjuntos
 *         content:
 *           application/json:
 *             example:
 *               mensajes:
 *                 - id: "uuid-mensaje"
 *                   contenido: "Hola, ¿a qué hora llegas?"
 *                   fecha_creacion: "2026-03-11T20:00:00Z"
 *                   emisor:
 *                     id: "uuid-usuario"
 *                     nombre_completo: "Juan Pérez"
 *                     url_foto_perfil: null
 *                   adjuntos: []
 *               total: 1
 *       403:
 *         description: Sin permisos (no eres dueño ni vendedor de esta reserva)
 *       404:
 *         description: Reserva no encontrada
 */
router.get('/:idReserva/mensajes', requireAuth, getMessages);

/**
 * @swagger
 * /api/chat/presigned-url:
 *   post:
 *     summary: Genera una URL firmada para subir imagen adjunta directamente a Cloudflare R2
 *     description: |
 *       El cliente usa esta URL para hacer un **PUT HTTP directo a R2** (sin pasar el archivo por el backend).
 *       Después de subir, usa la `publicUrl` en el evento `send_message` del socket.
 *       La URL de subida expira en **5 minutos**.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentType
 *             properties:
 *               contentType:
 *                 type: string
 *                 example: image/jpeg
 *                 description: MIME type del archivo (solo imágenes)
 *     responses:
 *       200:
 *         description: URLs generadas exitosamente
 *         content:
 *           application/json:
 *             example:
 *               message: "URL de subida generada. Tienes 5 minutos para subir el archivo."
 *               uploadUrl: "https://garajes.r2.cloudflarestorage.com/chat/uuid.jpg?X-Amz-Signature=..."
 *               publicUrl: "https://pub-xxx.r2.dev/chat/uuid.jpg"
 *       400:
 *         description: contentType inválido (solo se permiten imágenes)
 */
router.post('/presigned-url', requireAuth, generatePresignedUrl);

/**
 * @swagger
 * /api/chat/adjunto/{key}:
 *   get:
 *     summary: Obtener URL temporal de lectura para un adjunto privado del chat
 *     description: |
 *       Genera una **Presigned GET URL** de Cloudflare R2 (expira en 5 minutos).
 *       Solo el dueño del garaje o el vendedor de esa reserva pueden acceder.
 *       Usa la `key` devuelta por el endpoint `POST /chat/presigned-url`.
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Key del archivo en R2 (devuelta al subir con presigned-url)
 *         example: chat/uuid-archivo.jpg
 *     responses:
 *       200:
 *         description: URL temporal de lectura generada
 *         content:
 *           application/json:
 *             example:
 *               url: "https://garajes-kyc.r2.cloudflarestorage.com/chat/uuid.jpg?X-Amz-Signature=..."
 *               expira_en: "5 minutos"
 *       403:
 *         description: Sin permisos (no participas en la reserva de este adjunto)
 *       404:
 *         description: Adjunto no encontrado
 */
router.get('/adjunto/:key', requireAuth, getAdjuntoUrl);

module.exports = router;

