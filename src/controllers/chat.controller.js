const prisma = require('../db/prisma');
const { getPresignedUploadUrl, getPresignedChatUrl } = require('../services/upload.service');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Iteración paginada del historial transaccional de mensajería asíncrona dentro de una reservación activa.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getMessages = async (req, res, next) => {
    try {
        const { idReserva } = req.params;
        const id_usuario = req.user.id;
        const { skip = 0, take = 50 } = req.query;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: { select: { id_dueno: true } } }
        });

        if (!reserva) {
            return res.status(404).json({ error: 'Ausencia de punteros a la reserva inquirida.' });
        }

        const esVendedor = reserva.id_vendedor === id_usuario;
        const esDueno = reserva.garaje.id_dueno === id_usuario;

        if (!esVendedor && !esDueno) {
            return res.status(403).json({ error: 'Nivel de intrusión detectado superior a las tolerancias habilitadas en esta reserva.' });
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
            skip: parseInt(skip, 10),
            take: parseInt(take, 10)
        });

        logger.info('ChatController', `Trazabilidad de mensajería descargada para la reserva. Lote extraído: ${mensajes.length} registros.`);

        res.json({ mensajes, total: mensajes.length });

    } catch (error) {
        logger.error('ChatController', 'Excepción crítica operando descompresión del registro de chats locales.', error);
        next(error);
    }
};

/**
 * Despliega algoritmos criptográficos para proporcionar una URL temporal asimétrica de depósito en buckets R2.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const generatePresignedUrl = async (req, res, next) => {
    try {
        const { contentType } = req.body;

        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'Discriminación de contenido fallida. Únicamente se soportan formatos de imagen (ej: image/jpeg).' });
        }

        const ext = contentType.split('/')[1];
        const fileName = `chat/${crypto.randomUUID()}.${ext}`;

        const { uploadUrl, key } = await getPresignedUploadUrl(fileName, contentType);

        logger.info('ChatController', `Dirección criptografiada de carga provista dinámicamente. Key generada: ${key}`);

        res.json({
            message: 'Túnel de transferencia temporal aperturado y provisto (vigencia acotada a 5 minutos).',
            uploadUrl,
            key
        });

    } catch (error) {
        logger.error('ChatController', 'Falla observada en los procedimientos de firma HMAC preasignada hacia almacenamiento en fríos.', error);
        next(error);
    }
};

/**
 * Consecución de un descriptor temporal cifrado (URL Presigned) para la lectura privativa de contenido adjunto desde repositorios R2.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getAdjuntoUrl = async (req, res, next) => {
    try {
        const { key } = req.params;
        const id_usuario = req.user.id;

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
            return res.status(404).json({ error: 'Identificador del binario estático inencontrable.' });
        }

        const reserva = adjunto.mensaje.reserva;
        const esVendedor = reserva.id_vendedor === id_usuario;
        const esDueno = reserva.garaje.id_dueno === id_usuario;

        if (!esVendedor && !esDueno) {
            return res.status(403).json({ error: 'Manejo repudiado, infracción en permisos relativos a la consulta del archivo.' });
        }

        const url = await getPresignedChatUrl(key);
        
        logger.info('ChatController', `Concesión de acceso unitario delegado para archivo encubierto consumada.`);
        
        res.json({ url, expira_en: '5 minutos' });

    } catch (error) {
        logger.error('ChatController', 'Error originado en motor de desencripción y canal de lectura temporal a nodos R2', error);
        next(error);
    }
};

module.exports = {
    getMessages,
    generatePresignedUrl,
    getAdjuntoUrl
};
