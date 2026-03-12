const prisma = require('../db/prisma');
const { getPresignedUploadUrl, getPresignedChatUrl } = require('../services/upload.service');
const crypto = require('crypto');

/**
 * 1. Obtener historial de mensajes de una reserva (últimos 50, paginable)
 * Solo el dueño del garaje o el vendedor de la reserva pueden acceder.
 */
const getMessages = async (req, res, next) => {
    try {
        const { idReserva } = req.params;
        const id_usuario = req.user.id;
        const { skip = 0, take = 50 } = req.query;

        // Verificar pertenencia a la reserva
        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: { select: { id_dueno: true } } }
        });

        if (!reserva) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        const esVendedor = reserva.id_vendedor === id_usuario;
        const esDueno = reserva.garaje.id_dueno === id_usuario;

        if (!esVendedor && !esDueno) {
            return res.status(403).json({ error: 'Sin permisos para ver este chat.' });
        }

        const mensajes = await prisma.mensaje.findMany({
            where: { id_reserva: idReserva },
            include: {
                emisor: {
                    select: { id: true, nombre_completo: true, url_foto_perfil: true }
                },
                adjuntos: true
            },
            orderBy: { fecha_creacion: 'asc' },
            skip: parseInt(skip),
            take: parseInt(take)
        });

        res.json({ mensajes, total: mensajes.length });

    } catch (error) {
        next(error);
    }
};

/**
 * 2. Generar Presigned URL para subir un adjunto directo a Cloudflare R2
 * El cliente sube el archivo directo a R2, luego manda el socket con la URL pública.
 * Body: { contentType } — Ej: "image/jpeg"
 */
const generatePresignedUrl = async (req, res, next) => {
    try {
        const { contentType } = req.body;

        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'Solo se permiten imágenes. Proporciona un contentType válido (ej: image/jpeg).' });
        }

        const ext = contentType.split('/')[1];
        const fileName = `chat/${crypto.randomUUID()}.${ext}`;

        const { uploadUrl, key } = await getPresignedUploadUrl(fileName, contentType);

        res.json({
            message: 'URL de subida generada (bucket privado). Tienes 5 minutos para subir el archivo.',
            uploadUrl,  // URL firmada para hacer PUT directo a R2 PRIVADO
            key         // Guarda esta key y úsal a para pedir la URL de lectura temporal
        });

    } catch (error) {
        next(error);
    }
};

/**
 * 3. Obtener URL temporal de lectura para un adjunto privado del Chat
 * El frontend la usa para mostrar la imagen en pantalla (expira en 5 min).
 * Body: { key } -- la key que se guardó en la tabla AdjuntoMensaje
 */
const getAdjuntoUrl = async (req, res, next) => {
    try {
        const { key } = req.params;
        const id_usuario = req.user.id;

        // Verificar que el adjunto pertenece a una reserva donde el usuario participa
        const adjunto = await prisma.adjuntoMensaje.findFirst({
            where: { url: key },
            include: {
                mensaje: {
                    include: {
                        reserva: {
                            include: {
                                garaje: { select: { id_dueno: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!adjunto) {
            return res.status(404).json({ error: 'Adjunto no encontrado.' });
        }

        const reserva = adjunto.mensaje.reserva;
        const esVendedor = reserva.id_vendedor === id_usuario;
        const esDueno = reserva.garaje.id_dueno === id_usuario;

        if (!esVendedor && !esDueno) {
            return res.status(403).json({ error: 'Sin permisos para ver este adjunto.' });
        }

        const url = await getPresignedChatUrl(key);
        res.json({ url, expira_en: '5 minutos' });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMessages,
    generatePresignedUrl,
    getAdjuntoUrl
};
