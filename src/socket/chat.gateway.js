const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_garajes_dev_123';

/**
 * Inicializa el servidor de Socket.io sobre el httpServer de Express.
 * Estrategia: Rooms estrictos por id_reserva.
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
    // Rechaza cualquier conexión sin JWT válido ANTES de que entre al sistema
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('AUTH_REQUIRED: Sin token de autenticación.'));
            }

            if (token.startsWith('Bearer ')) {
                token = token.slice(7);
            }

            const decoded = jwt.verify(token, JWT_SECRET);

            // Cargar el usuario completo desde BD para tener datos frescos
            const user = await prisma.usuario.findUnique({ where: { id: decoded.id } });
            if (!user) {
                return next(new Error('AUTH_REQUIRED: Usuario no encontrado.'));
            }

            // Inyectar el usuario en el socket para usar en handlers
            socket.user = user;
            next();
        } catch (err) {
            next(new Error('AUTH_REQUIRED: Token inválido o expirado.'));
        }
    });

    // ── EVENTOS DE CONEXIÓN ──────────────────────────────────────────────────
    io.on('connection', (socket) => {
        console.log(`🔌 Socket conectado: ${socket.user.nombre_completo} (${socket.user.id})`);

        // Unirse a la sala personal para recibir notificaciones directas (KYC, Reservas)
        socket.join(socket.user.id);
        console.log(`🔔 ${socket.user.nombre_completo} unido a room personal: ${socket.user.id}`);

        // ── join_room ────────────────────────────────────────────────────────
        // El cliente envía: { reservaId }
        // El backend valida que el usuario pertenece a esa reserva y lo une al room
        socket.on('join_room', async ({ reservaId }) => {
            try {
                if (!reservaId) {
                    return socket.emit('error', { message: 'Debes especificar un reservaId.' });
                }

                // Verificar que la reserva existe y que el usuario es parte de ella
                const reserva = await prisma.reserva.findUnique({
                    where: { id: reservaId },
                    include: { garaje: { select: { id_dueno: true } } }
                });

                if (!reserva) {
                    return socket.emit('error', { message: 'Reserva no encontrada.' });
                }

                const esVendedor = reserva.id_vendedor === socket.user.id;
                const esDueno = reserva.garaje.id_dueno === socket.user.id;

                if (!esVendedor && !esDueno) {
                    return socket.emit('error', { message: 'Sin permisos para unirte a este chat.' });
                }

                socket.join(reservaId);
                // Guardar el reservaId activo en el socket para validaciones futuras
                socket.activeRooms = socket.activeRooms || new Set();
                socket.activeRooms.add(reservaId);

                console.log(`📨 ${socket.user.nombre_completo} se unió al room de reserva: ${reservaId}`);
                socket.emit('joined_room', { reservaId, message: 'Conectado al chat.' });

            } catch (err) {
                console.error('[join_room error]', err.message);
                socket.emit('error', { message: 'Error al unirse al chat.' });
            }
        });

        // ── send_message ─────────────────────────────────────────────────────
        // El cliente envía: { reservaId, contenido, key_adjunto? }
        // key_adjunto es la KEY de R2 privado devuelta por POST /api/chat/presigned-url
        socket.on('send_message', async ({ reservaId, contenido, key_adjunto }) => {
            try {
                console.log(`📩 Recibido send_message de ${socket.user.id} para reserva ${reservaId}: ${contenido?.substring(0, 20)}...`);

                if (!reservaId || !contenido?.trim()) {
                    console.log('⚠️ Error: reservaId o contenido faltantes');
                    return socket.emit('error', { message: 'reservaId y contenido son requeridos.' });
                }

                // Validar que el socket está en ese room
                if (!socket.activeRooms?.has(reservaId)) {
                    console.log(`⚠️ Error: Usuario ${socket.user.id} no está en el room ${reservaId}`);
                    return socket.emit('error', { message: 'No estás en este room. Haz join_room primero.' });
                }

                // Verificar pertenencia a la reserva (doble check de seguridad)
                const reserva = await prisma.reserva.findUnique({
                    where: { id: reservaId },
                    include: { garaje: { select: { id_dueno: true } } }
                });

                if (!reserva) {
                    return socket.emit('error', { message: 'Reserva no encontrada.' });
                }

                const esVendedor = reserva.id_vendedor === socket.user.id;
                const esDueno = reserva.garaje.id_dueno === socket.user.id;

                if (!esVendedor && !esDueno) {
                    return socket.emit('error', { message: 'Sin permisos para enviar mensajes en este chat.' });
                }

                // Persistir el mensaje en la base de datos
                const mensajeGuardado = await prisma.mensaje.create({
                    data: {
                        id_reserva: reservaId,
                        id_emisor: socket.user.id,
                        contenido: contenido.trim(),
                        // Si hay adjunto, guardar la KEY privada en la tabla AdjuntoMensaje
                        // El receptor accederá a la imagen via GET /api/chat/adjunto/:key
                        adjuntos: key_adjunto ? {
                            create: [{
                                url: key_adjunto,  // KEY del archivo en R2 privado
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

                // Emitir a TODOS en el room (incluyendo al emisor para confirmación)
                io.to(reservaId).emit('receive_message', mensajeGuardado);
                console.log(`📤 Mensaje emitido a room ${reservaId}`);

                // Notificar directamente al receptor en su room personal
                const isEmisorVendedor = reserva.id_vendedor === socket.user.id;
                const receptorId = isEmisorVendedor ? reserva.garaje.id_dueno : reserva.id_vendedor;
                
                io.to(receptorId).emit('new_message_notification', {
                    reservaId: reservaId,
                    emisorName: socket.user.nombre_completo,
                    contenido: contenido
                });

                // Persistir la notificación en DB para el historial
                try {
                    await prisma.notificacion.create({
                        data: {
                            id_usuario: receptorId,
                            titulo: 'Nuevo mensaje de chat',
                            cuerpo: `${socket.user.nombre_completo} te ha enviado un mensaje.`
                        }
                    });
                } catch (notifErr) {
                    console.error('[send_message] Error guardando notificacion DB:', notifErr.message);
                }

            } catch (err) {
                console.error('[send_message error]', err.message);
                socket.emit('error', { message: 'Error al enviar el mensaje.' });
            }
        });

        // ── leave_room ───────────────────────────────────────────────────────
        socket.on('leave_room', ({ reservaId }) => {
            socket.leave(reservaId);
            socket.activeRooms?.delete(reservaId);
            console.log(`🚪 ${socket.user.nombre_completo} salió del room: ${reservaId}`);
        });

        // ── disconnect ───────────────────────────────────────────────────────
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket desconectado: ${socket.user.nombre_completo} — ${reason}`);
        });
    });

    return io;
}

module.exports = { initSocketGateway };
