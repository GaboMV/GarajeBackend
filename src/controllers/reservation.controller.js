const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Crea una solicitud de reserva e inicializa las métricas computables contractuales.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const createReservation = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const {
            id_garaje, fecha, hora_inicio, hora_fin,
            mensaje_inicial, acepto_terminos_responsabilidad,
            servicios_extra,
            categorias_venta,
            tipo_cobro: tipo_cobro_req
        } = req.body;

        if (!acepto_terminos_responsabilidad) {
            return res.status(400).json({ error: 'La confirmación de las bases legales y de responsabilidad es excluyente.' });
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
            return res.status(404).json({ error: 'El activo solicitado no se encuentra registrado en el sistema.' });
        }

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
            return res.status(400).json({ error: 'El aforo disponible ha alcanzado el límite estructural para la banda horaria indicada.' });
        }

        const timeToDecimal = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h + (m / 60);
        };
        const horas = timeToDecimal(hora_fin) - timeToDecimal(hora_inicio);

        if (horas < garaje.minimo_horas) {
            return res.status(400).json({ error: `La ventana de tiempo elegida no satisface el mínimo estipulado (${garaje.minimo_horas} horas).` });
        }

        let subtotal = 0;
        let tipo_cobro = tipo_cobro_req || "POR_HORA";

        if (tipo_cobro === "POR_DIA" && garaje.precio_dia) {
            subtotal = parseFloat(garaje.precio_dia);
        } else if (garaje.precio_hora) {
            subtotal = parseFloat(garaje.precio_hora) * horas;
            tipo_cobro = "POR_HORA";
        } else if (garaje.precio_dia) {
            subtotal = parseFloat(garaje.precio_dia);
            tipo_cobro = "POR_DIA";
        }

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
        const COMISION_PORCENTAJE = 0.10;
        const comision_app = precio_total * COMISION_PORCENTAJE;
        const monto_dueno = precio_total - comision_app;

        const nuevaReserva = await prisma.$transaction(async (tx) => {
            const categoriasReservaData = [];
            if (categorias_venta && Array.isArray(categorias_venta)) {
                for (const catName of categorias_venta) {
                    if (!catName.trim()) continue;
                    let cat = await tx.categoriaProducto.findFirst({
                        where: { nombre: { equals: catName.trim(), mode: 'insensitive' } }
                    });
                    if (!cat) {
                        cat = await tx.categoriaProducto.create({ data: { nombre: catName.trim() } });
                    }
                    categoriasReservaData.push({ id_categoria: cat.id });
                }
            }

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
                    version_terminos: "v1.0.0",
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
                    } : undefined,
                    categorias: categoriasReservaData.length > 0 ? {
                        create: categoriasReservaData
                    } : undefined,
                    mensajes: mensaje_inicial ? {
                        create: [{
                            id_emisor: id_vendedor,
                            contenido: mensaje_inicial
                        }]
                    } : undefined
                },
                include: {
                    fechas: true,
                    servicios_extra: true,
                    categorias: { include: { categoria: true } }
                }
            });

            return reserva;
        });

        logger.info('ReservationController', `Contrato provisional estructurado. ID: ${nuevaReserva.id}`);

        res.status(201).json({
            message: 'Acuerdo inicial procesado con normalidad.',
            desglose: {
                subtotal_horas: subtotal,
                subtotal_servicios: totalServicios,
                precio_total,
                comision_app,
                monto_dueno
            },
            reserva: nuevaReserva
        });

        const io = req.app.get('socketio');
        if (io) {
            io.to(garaje.id_dueno).emit('new_reservation_request', {
                message: `Existen propuestas comerciales para el establecimiento referenciado como ${garaje.nombre}.`,
                reservaId: nuevaReserva.id
            });
        }

        await prisma.notificacion.create({
            data: {
                id_usuario: garaje.id_dueno,
                titulo: 'Aviso Transaccional',
                cuerpo: `Existen propuestas comerciales para el establecimiento referenciado como ${garaje.nombre}.`
            }
        });

    } catch (error) {
        logger.error('ReservationController', 'Condición excepcional observada durante ensamblaje contractual.', error);
        next(error);
    }
}

/**
 * Reporte y confirmación de pago inicial. Bloquea formalmente los fondos provisionales retenidos.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
            return res.status(403).json({ error: 'Nivel jerárquico reprobado bajo este perfil transaccional.' });
        }

        if (reserva.estado !== 'ACEPTADA') {
            return res.status(400).json({ error: 'Es requisito primordial una autorización gerencial previa al aporte financiero.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.comprobantePago.create({
                data: {
                    id_reserva: idReserva,
                    metodo,
                    url_imagen,
                    id_transaccion,
                    estado: 'EN_REVISION'
                }
            });

            await tx.reserva.update({
                where: { id: idReserva },
                data: { estado: 'PAGADA' }
            });

            let billeteraDueno = await tx.billetera.findUnique({
                where: { id_usuario: reserva.garaje.id_dueno }
            });

            if (!billeteraDueno) {
                billeteraDueno = await tx.billetera.create({
                    data: { id_usuario: reserva.garaje.id_dueno }
                });
            }

            await tx.billetera.update({
                where: { id: billeteraDueno.id },
                data: {
                    saldo_retenido: {
                        increment: reserva.monto_dueno
                    }
                }
            });

            await tx.movimientoBilletera.create({
                data: {
                    id_billetera: billeteraDueno.id,
                    id_reserva: idReserva,
                    tipo: 'RETENCION',
                    monto: reserva.monto_dueno,
                    descripcion: `Flujo ${reserva.id.split('-')[0]} completado. Capital inmovilizado y sujeto a auditorías finales.`
                }
            });
        });

        logger.info('ReservationController', `Liquidación del instrumento provisional avalada para la reserva ID: ${idReserva}`);

        res.json({
            message: 'Inyección de capital comunicada exitosamente al marco administrativo local.'
        });

    } catch (error) {
        logger.error('ReservationController', 'El protocolo financiero local desencadenó una divergencia crítica.', error);
        next(error);
    }
}

/**
 * Retorna las vinculaciones históricas ejecutadas por el arrendatario actual.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
        logger.error('ReservationController', 'Errores esporádicos bloqueando subida analítica.', error);
        next(error);
    }
}

/**
 * Provee la relación global de contratos asociados al conjunto de propiedades del arrendador.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
                        id: true,
                        nombre: true,
                        direccion: true,
                        imagenes: true,
                        precio_hora: true,
                        precio_dia: true
                    }
                },
                vendedor: {
                    select: {
                        id: true,
                        nombre_completo: true,
                        correo: true,
                        url_foto_perfil: true,
                        telefono: true
                    }
                },
                fechas: true,
                servicios_extra: {
                    include: { servicio: true }
                }
            },
            orderBy: { fecha_creacion: 'desc' }
        });

        res.json({ reservas });
    } catch (error) {
        logger.error('ReservationController', 'Recopilación dependiente falló abruptamente sobre métricas dueñas.', error);
        next(error);
    }
}

/**
 * Inspección puntual y extendida referida netamente a una entidad de reserva específica por su UUID.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
                },
                categorias: {
                    include: { categoria: true }
                }
            }
        });

        if (!reserva) {
            return res.status(404).json({ error: 'Mapeo ineficaz. No se han localizado registros equivalentes en memoria.' });
        }

        const isOwner = reserva.garaje.id_dueno === userId;
        const isClient = reserva.id_vendedor === userId;

        if (!isOwner && !isClient) {
            return res.status(403).json({ error: 'Condición transaccional asimétrica. Permisos insuficientes.' });
        }

        res.json({ reserva });
    } catch (error) {
        logger.error('ReservationController', 'No se resolvió la referencia explícita del activo de alquiler.', error);
        next(error);
    }
}

/**
 * Alteración estructural del ciclo de vida a la fase de mediación consensuada (Negociación).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const acceptForChat = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idReserva } = req.params;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        if (!reserva || reserva.garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Se exigen privilegios delegados sobre la entidad base.' });
        }

        if (reserva.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: `La condición sistémica actual es antinómica al progreso pretendido:` });
        }

        const updatedReserva = await prisma.reserva.update({
            where: { id: idReserva },
            data: { estado: 'EN_NEGOCIACION' }
        });

        logger.info('ReservationController', `El espacio P2P de comunicación mutua queda formalmente liberado para: ${idReserva}`);

        res.json({
            message: 'Estatus operacional transformado sin disrupción. Canal asimétrico provisto.',
            reserva: updatedReserva
        });

    } catch (error) {
        logger.error('ReservationController', 'Error en el escalado posicional del objeto arrendaticio.', error);
        next(error);
    }
}

/**
 * Convalidación directiva del acuerdo, preparando el entorno para ejecución de saldos.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const confirmReservation = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idReserva } = req.params;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        if (!reserva || reserva.garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Delegación de propiedad sin efecto en este ámbito.' });
        }

        if (!['PENDIENTE', 'EN_NEGOCIACION'].includes(reserva.estado)) {
            return res.status(400).json({ error: `Atributo cíclico invalido para esta acción: ${reserva.estado}` });
        }

        const updatedReserva = await prisma.reserva.update({
            where: { id: idReserva },
            data: { estado: 'ACEPTADA' }
        });

        logger.info('ReservationController', `Avenencia comercial mutua estabilizada sobre reserva: ${idReserva}`);

        res.json({
            message: 'Mutuo entendimiento suscrito. Disposición lista para la enajenación financiera.',
            reserva: updatedReserva
        });

    } catch (error) {
        logger.error('ReservationController', 'Trunca generalizada al asegurar variables contractuales de reserva.', error);
        next(error);
    }
}

/**
 * Desestima procedimentalmente los efectos jurídicos e impositivos del contrato en curso, forzando estado "CANCELADA".
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
            return res.status(404).json({ error: 'Omisión detectada; activo no listado en jerarquía.' });
        }

        const isOwner = reserva.garaje.id_dueno === userId;
        const isClient = reserva.id_vendedor === userId;

        if (!isOwner && !isClient) {
            return res.status(403).json({ error: 'Suspensión denegada por jerarquización deficiente.' });
        }

        if (['PAGADA', 'EN_CURSO', 'COMPLETADA'].includes(reserva.estado)) {
            return res.status(400).json({ error: 'Naturaleza irrevocable; ciclo mercantil se encuentra ya cerrado o respaldado en curso orgánico.' });
        }

        const updatedReserva = await prisma.reserva.update({
            where: { id: idReserva },
            data: { estado: 'CANCELADA' }
        });

        logger.info('ReservationController', `Extinción prematura del instrumento de concesión lograda: ${idReserva}`);

        res.json({
            message: 'Sustitución de estridencias finalizada. Se invalida el alcance presente.',
            reserva: updatedReserva
        });

    } catch (error) {
        logger.error('ReservationController', 'Condición caótica durante invalidación paramétrica.', error);
        next(error);
    }
}

module.exports = {
    createReservation,
    payReservation,
    getMyReservations,
    getOwnerReservations,
    getReservationById,
    acceptForChat,
    confirmReservation,
    rejectReservation
};
