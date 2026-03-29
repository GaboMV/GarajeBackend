const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_garajes_dev_123';

/**
 * Inicializa el servidor de Socket.io sobre el httpServer de Express.
 * Implementa aislamiento estricto de eventos basado en la arquitectura de salas por id_reserva.
 * 
 * @param {import('http').Server} httpServer - Servidor http subyacente de Express.
 * @returns {Server} Instancia configurada de Socket.io
 */
function initSocketGateway(httpServer) {
    const allowedOrigin = process.env.FRONTEND_URL || '*';

    const io = new Server(httpServer, {
        cors: {
            origin: allowedOrigin,
            methods: ['GET', 'POST'],
        },
    });

    // ── MIDDLEWARE DE AUTENTICACIÓN ──────────────────────────────────────────
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('AUTH_REQUIRED: Credencial de autenticación ausente en el handshake.'));
            }

            if (token.startsWith('Bearer ')) {
                token = token.slice(7);
            }

            const decoded = jwt.verify(token, JWT_SECRET);

            const user = await prisma.usuario.findUnique({ where: { id: decoded.id } });
            if (!user) {
                return next(new Error('AUTH_REQUIRED: Referencia de usuario no resoluble en base de datos.'));
            }

            socket.user = user;
            next();
        } catch (err) {
            next(new Error('AUTH_REQUIRED: Token de seguridad expirado o inconsistente.'));
        }
    });

    // ── EVENTOS DE CONEXIÓN ──────────────────────────────────────────────────
    io.on('connection', (socket) => {
        logger.info('ChatGateway', `Enlace de socket establecido: ${socket.user.nombre_completo} (${socket.user.id})`);

        // Canalización unificada de notificaciones directas al usuario
        socket.join(socket.user.id);
        logger.info('ChatGateway', `Usuario suscrito a canal persistente personal: ${socket.user.id}`);

        // ── join_room ────────────────────────────────────────────────────────
        socket.on('join_room', async ({ reservaId }) => {
            try {
                if (!reservaId) {
                    return socket.emit('error', { message: 'El identificador de reserva es mandatorio de consulta.' });
                }

                const reserva = await prisma.reserva.findUnique({
                    where: { id: reservaId },
                    include: { garaje: { select: { id_dueno: true } } }
                });

                if (!reserva) {
                    return socket.emit('error', { message: 'Activo arrendaticio no localizado en registros de negocio.' });
                }

                const esVendedor = reserva.id_vendedor === socket.user.id;
                const esDueno = reserva.garaje.id_dueno === socket.user.id;

                if (!esVendedor && !esDueno) {
                    return socket.emit('error', { message: 'Infracción de privilegios: acceso delegado no admitido.' });
                }

                socket.join(reservaId);
                socket.activeRooms = socket.activeRooms || new Set();
                socket.activeRooms.add(reservaId);

                logger.info('ChatGateway', `Suscripción concedida a sala transaccional: ${reservaId} para usuario: ${socket.user.id}`);
                socket.emit('joined_room', { reservaId, message: 'Vinculación a sala completada.' });

            } catch (err) {
                logger.error('ChatGateway', 'Excepción crítica registrada en ciclo de suscripción (join_room).', err);
                socket.emit('error', { message: 'No es posible canalizar la conexión solicitada.' });
            }
        });

        // ── send_message ─────────────────────────────────────────────────────
        socket.on('send_message', async ({ reservaId, contenido, key_adjunto }) => {
            try {
                const infoStr = contenido ? contenido.substring(0, 20) : '[Sin contenido]';
                logger.info('ChatGateway', `Transmisión originada desde socket ${socket.user.id} hacia reserva ${reservaId}: ${infoStr}...`);

                if (!reservaId || !contenido?.trim()) {
                    logger.warn('ChatGateway', 'Atributos resolutivos faltantes (reservaId o contenido) abortando transmisión.');
                    return socket.emit('error', { message: 'Dependencias paramétricas insuficientes en carga útil.' });
                }

                if (!socket.activeRooms?.has(reservaId)) {
                    logger.warn('ChatGateway', `Bloqueo de difusión por desacople en salas persistentes. Socket: ${socket.user.id}, Sala: ${reservaId}`);
                    return socket.emit('error', { message: 'Transmisión denegada. Es requisito suscribirse mediante join_room.' });
                }

                const reserva = await prisma.reserva.findUnique({
                    where: { id: reservaId },
                    include: { garaje: { select: { id_dueno: true } } }
                });

                if (!reserva) {
                    return socket.emit('error', { message: 'Reserva no localizable en registros centrales.' });
                }

                const esVendedor = reserva.id_vendedor === socket.user.id;
                const esDueno = reserva.garaje.id_dueno === socket.user.id;

                if (!esVendedor && !esDueno) {
                    return socket.emit('error', { message: 'Infracción sistémica. Interés sin aval dentro de esta sala.' });
                }

                const mensajeGuardado = await prisma.mensaje.create({
                    data: {
                        id_reserva: reservaId,
                        id_emisor: socket.user.id,
                        contenido: contenido.trim(),
                        adjuntos: key_adjunto ? {
                            create: [{
                                url: key_adjunto,
                                tipo: 'IMAGEN'
                            }]
                        } : undefined
                    },
                    include: {
                        emisor: {
                            select: { id: true, nombre_completo: true, url_foto_perfil: true }
                        },
                        adjuntos: true
                    }
                });

                io.to(reservaId).emit('receive_message', mensajeGuardado);
                logger.info('ChatGateway', `Distribución de carga de red ejecutada hacia sala persistente: ${reservaId}`);

                const isEmisorVendedor = reserva.id_vendedor === socket.user.id;
                const receptorId = isEmisorVendedor ? reserva.garaje.id_dueno : reserva.id_vendedor;
                
                io.to(receptorId).emit('new_message_notification', {
                    reservaId: reservaId,
                    emisorName: socket.user.nombre_completo,
                    contenido: contenido
                });

                try {
                    await prisma.notificacion.create({
                        data: {
                            id_usuario: receptorId,
                            titulo: 'Interacción de Mensajería',
                            cuerpo: `La contraparte referenciada como ${socket.user.nombre_completo} ha ingresado mensajería a la sala.`
                        }
                    });
                } catch (notifErr) {
                    logger.error('ChatGateway', 'Falla asincrónica en replicación de notificaciones subyacentes', notifErr);
                }

            } catch (err) {
                logger.error('ChatGateway', 'Colapso operativo durante el manejo de flujo multidestino (send_message)', err);
                socket.emit('error', { message: 'Saturación en el despachador central impidió certificar su mensaje.' });
            }
        });

        // ── leave_room ───────────────────────────────────────────────────────
        socket.on('leave_room', ({ reservaId }) => {
            socket.leave(reservaId);
            socket.activeRooms?.delete(reservaId);
            logger.info('ChatGateway', `Desvinculación voluntaria de sala: ${reservaId} provista para: ${socket.user.nombre_completo}`);
        });

        // ── disconnect ───────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            logger.info('ChatGateway', `Interrupción operativa detectada en Socket: ${socket.user.nombre_completo}. Razón subyacente: ${reason}`);
        });
    });

    return io;
}

module.exports = { initSocketGateway };
