const prisma = require('../db/prisma');

/**
 * 1. Crear Reserva (Solicitud + Escudo Legal)
 * El Vendedor elige un garaje, fecha/hora y servicios.
 * Se calcula el precio total, comisión app y monto dueño.
 */
const createReservation = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const {
            id_garaje, fecha, hora_inicio, hora_fin,
            mensaje_inicial, acepto_terminos_responsabilidad,
            servicios_extra // Array de objetos: [{ id_servicio, cantidad }]
        } = req.body;

        if (!acepto_terminos_responsabilidad) {
            return res.status(400).json({ error: 'Debes aceptar los términos de responsabilidad para reservar' });
        }

        const garaje = await prisma.garaje.findUnique({
            where: { id: id_garaje },
            include: {
                servicios_adicionales: true,
                reservas: {
                    include: { fechas: true },
                    where: { estado: { notIn: ['CANCELADA', 'REEMBOLSADA'] } }
                }
            }
        });

        if (!garaje) {
            return res.status(404).json({ error: 'Garaje no encontrado' });
        }

        // --- VALIDACIÓN DE CAPACIDAD MULTIVARIADA ---
        let reservasSolapadas = 0;
        const timeToMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return (h * 60) + m;
        };
        const searchStartMin = timeToMinutes(hora_inicio);
        const searchEndMin = timeToMinutes(hora_fin);

        garaje.reservas.forEach(reserva => {
            let reservaChoca = false;
            reserva.fechas.forEach(fr => {
                if (fr.fecha.toISOString().split('T')[0] === fecha) {
                    const resStartMin = timeToMinutes(fr.hora_inicio);
                    const resEndMin = timeToMinutes(fr.hora_fin) + garaje.tiempo_limpieza;

                    if (searchStartMin < resEndMin && searchEndMin > resStartMin) {
                        reservaChoca = true;
                    }
                }
            });

            if (reservaChoca) {
                reservasSolapadas++;
            }
        });

        if (reservasSolapadas >= garaje.capacidad_puestos) {
            return res.status(400).json({ error: 'El garaje ha alcanzado su capacidad máxima para este horario.' });
        }

        // --- CALCULO FINANCIERO SIMPLE ---
        // Convertimos las horas a fracciones para cobrar (Ej: 14:00 a 16:30 = 2.5 horas)
        const timeToDecimal = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h + (m / 60);
        };
        const horas = timeToDecimal(hora_fin) - timeToDecimal(hora_inicio);

        if (horas < garaje.minimo_horas) {
            return res.status(400).json({ error: `El mínimo de horas es ${garaje.minimo_horas}` });
        }

        // Asumimos Tipo Cobro POR HORA por defecto si hay precio_hora
        let subtotal = 0;
        let tipo_cobro = "POR_HORA";

        if (garaje.precio_hora) {
            subtotal = parseFloat(garaje.precio_hora) * horas;
        } else if (garaje.precio_dia) {
            subtotal = parseFloat(garaje.precio_dia);
            tipo_cobro = "POR_DIA";
        }

        // Sumar servicios adicionales
        let totalServicios = 0;
        const serviciosReservaData = [];

        if (servicios_extra && servicios_extra.length > 0) {
            for (const reqExtra of servicios_extra) {
                const srvDB = garaje.servicios_adicionales.find(s => s.id === reqExtra.id_servicio);
                if (srvDB) {
                    const precioItem = parseFloat(srvDB.precio) * (reqExtra.cantidad || 1);
                    totalServicios += precioItem;

                    serviciosReservaData.push({
                        id_servicio: srvDB.id,
                        cantidad: reqExtra.cantidad || 1,
                        precio_acordado: srvDB.precio
                    });
                }
            }
        }

        const precio_total = subtotal + totalServicios;

        // Obtener configuración global (Ej: 10% de comisión)
        // En un caso real se consulta a ConfiguracionPlataforma, usaremos 10% fijo para el ejemplo
        const COMISION_PORCENTAJE = 0.10;
        const comision_app = precio_total * COMISION_PORCENTAJE;
        const monto_dueno = precio_total - comision_app;

        // Crear la reserva y sus dependencias (transaccional)
        const nuevaReserva = await prisma.$transaction(async (tx) => {
            const reserva = await tx.reserva.create({
                data: {
                    id_garaje,
                    id_vendedor,
                    estado: 'PENDIENTE',
                    tipo_cobro,
                    precio_total,
                    comision_app,
                    monto_dueno,
                    mensaje_inicial,
                    acepto_terminos_responsabilidad,
                    version_terminos: "v1.0.0", // Hardcoded para el ejemplo
                    ip_aceptacion: req.ip || "127.0.0.1",

                    fechas: {
                        create: [{
                            fecha: new Date(fecha),
                            hora_inicio,
                            hora_fin
                        }]
                    },
                    servicios_extra: serviciosReservaData.length > 0 ? {
                        create: serviciosReservaData
                    } : undefined
                },
                include: {
                    fechas: true,
                    servicios_extra: true
                }
            });

            return reserva;
        });

        res.status(201).json({
            message: 'Reserva creada exitosamente',
            desglose: {
                subtotal_horas: subtotal,
                subtotal_servicios: totalServicios,
                precio_total,
                comision_app,
                monto_dueno
            },
            reserva: nuevaReserva
        });

        // Emitir notificación al dueño del garaje
        const io = req.app.get('socketio');
        if (io) {
            io.to(garaje.id_dueno).emit('new_reservation_request', {
                message: `¡Tienes una nueva solicitud de reserva para ${garaje.nombre}!`,
                reservaId: nuevaReserva.id
            });
        }

        await prisma.notificacion.create({
            data: {
                id_usuario: garaje.id_dueno,
                titulo: 'Nueva Solicitud de Reserva',
                cuerpo: `¡Tienes una nueva solicitud de reserva para ${garaje.nombre}!`
            }
        });

    } catch (error) {
        next(error);
    }
}

/**
 * 2. Pagar Reserva y Subir Comprovante (FLUJO 4 - El Escrow)
 * El vendedor sube el comprobante. La reserva pasa a PAGADA
 * y el dinero del dueño pasa a 'Retenido' temporalmente.
 */
const payReservation = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const { idReserva } = req.params;
        const { metodo, url_imagen, id_transaccion } = req.body;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        if (!reserva || reserva.id_vendedor !== id_vendedor) {
            return res.status(403).json({ error: 'Reserva no encontrada o no tienes permisos' });
        }

        if (reserva.estado !== 'ACEPTADA') {
            return res.status(400).json({ error: 'La reserva debe estar ACEPTADA por el dueño antes de pagarla.' });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Guardar Comprobante
            await tx.comprobantePago.create({
                data: {
                    id_reserva: idReserva,
                    metodo,
                    url_imagen,
                    id_transaccion,
                    estado: 'EN_REVISION'
                }
            });

            // 2. Actualizar Reserva a PAGADA
            await tx.reserva.update({
                where: { id: idReserva },
                data: { estado: 'PAGADA' }
            });

            // 3. Crear Billetera del dueño si no tiene
            let billeteraDueno = await tx.billetera.findUnique({
                where: { id_usuario: reserva.garaje.id_dueno }
            });

            if (!billeteraDueno) {
                billeteraDueno = await tx.billetera.create({
                    data: { id_usuario: reserva.garaje.id_dueno }
                });
            }

            // 4. Retener el saldo del dueño (Monto va a Saldo Retenido)
            await tx.billetera.update({
                where: { id: billeteraDueno.id },
                data: {
                    saldo_retenido: {
                        increment: reserva.monto_dueno
                    }
                }
            });

            // 5. Registrar Movimiento Billetera (Retención)
            await tx.movimientoBilletera.create({
                data: {
                    id_billetera: billeteraDueno.id,
                    id_reserva: idReserva,
                    tipo: 'RETENCION',
                    monto: reserva.monto_dueno,
                    descripcion: `Reserva #${reserva.id.split('-')[0]} Pagada. Fondos retenidos hasta Check-out.`
                }
            });
        });

        res.json({
            message: 'Pago reportado exitosamente. La reserva está confirmada y el horario asegurado.'
        });

    } catch (error) {
        next(error);
    }
}

/**
 * 3. Get mis reservas (Vendedor / Cliente)
 * Lista todas las reservas que el usuario actual ha realizado.
 */
const getMyReservations = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const reservas = await prisma.reserva.findMany({
            where: { id_vendedor },
            include: {
                garaje: {
                    select: {
                        nombre: true,
                        direccion: true
                    }
                },
                fechas: true
            },
            orderBy: { fecha_creacion: 'desc' }
        });

        res.json({ reservas });
    } catch (error) {
        next(error);
    }
}

/**
 * 4. Get Reservas Recibidas (Dueño de Garaje)
 * Lista las reservas hechas hacia los garajes que posee el usuario.
 */
const getOwnerReservations = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const reservas = await prisma.reserva.findMany({
            where: {
                garaje: {
                    id_dueno
                }
            },
            include: {
                garaje: {
                    select: {
                        nombre: true
                    }
                },
                vendedor: {
                    select: {
                        nombre_completo: true,
                        correo: true,
                        url_foto_perfil: true
                    }
                },
                fechas: true
            },
            orderBy: { fecha_creacion: 'desc' }
        });

        res.json({ reservas });
    } catch (error) {
        next(error);
    }
}

/**
 * 5. Get Reservation By ID
 * Detalle completo de una reserva (para el dueño o el cliente)
 */
const getReservationById = async (req, res, next) => {
    try {
        const { idReserva } = req.params;
        const userId = req.user.id;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: {
                garaje: {
                    include: {
                        dueno: {
                            select: { id: true, nombre_completo: true, url_foto_perfil: true }
                        }
                    }
                },
                vendedor: {
                    select: { id: true, nombre_completo: true, url_foto_perfil: true }
                },
                fechas: {
                    include: { evidencias: true }
                },
                comprobante_pago: true,
                servicios_extra: {
                    include: { servicio: true }
                }
            }
        });

        if (!reserva) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        // Verificar permisos (solo el dueño del garaje o el cliente que reservó pueden verla)
        const isOwner = reserva.garaje.id_dueno === userId;
        const isClient = reserva.id_vendedor === userId;

        if (!isOwner && !isClient) {
            return res.status(403).json({ error: 'No tienes permisos para ver esta reserva' });
        }

        res.json({ reserva });
    } catch (error) {
        next(error);
    }
}

/**
 * 6. Aprobar Reserva (Dueño de Garaje)
 * El dueño acepta la solicitud del vendedor.
 */
const approveReservation = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idReserva } = req.params;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        if (!reserva || reserva.garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Reserva no encontrada o no tienes permisos' });
        }

        if (reserva.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: `No se puede aprobar una reserva en estado ${reserva.estado}` });
        }

        const updatedReserva = await prisma.reserva.update({
            where: { id: idReserva },
            data: { estado: 'ACEPTADA' }
        });

        res.json({
            message: 'Reserva aprobada exitosamente. El cliente ahora puede proceder al pago.',
            reserva: updatedReserva
        });

    } catch (error) {
        next(error);
    }
}

/**
 * 7. Rechazar/Cancelar Reserva (Dueño o Cliente)
 */
const rejectReservation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { idReserva } = req.params;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        if (!reserva) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        const isOwner = reserva.garaje.id_dueno === userId;
        const isClient = reserva.id_vendedor === userId;

        if (!isOwner && !isClient) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }

        if (['PAGADA', 'EN_CURSO', 'COMPLETADA'].includes(reserva.estado)) {
            return res.status(400).json({ error: 'No se puede rechazar una reserva que ya ha sido pagada o está en curso.' });
        }

        const updatedReserva = await prisma.reserva.update({
            where: { id: idReserva },
            data: { estado: 'CANCELADA' }
        });

        res.json({
            message: 'Reserva cancelada/rechazada exitosamente.',
            reserva: updatedReserva
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    createReservation,
    payReservation,
    getMyReservations,
    getOwnerReservations,
    getReservationById,
    approveReservation,
    rejectReservation
};
