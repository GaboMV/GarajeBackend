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
            include: { servicios_adicionales: true }
        });

        if (!garaje) {
            return res.status(404).json({ error: 'Garaje no encontrado' });
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

        if (reserva.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: `La reserva ya está en estado ${reserva.estado}` });
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

module.exports = {
    createReservation,
    payReservation
};
