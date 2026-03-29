const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Registra formalmente la llegada del arrendatario al establecimiento (Check-In).
 * Requiere captura de evidencia fotográfica del estado inicial del inmueble.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const checkIn = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const { idReserva } = req.params;
        const { id_fecha_reserva, url_foto, comentarios } = req.body;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { fechas: true }
        });

        if (!reserva || reserva.id_vendedor !== id_vendedor) {
            return res.status(403).json({ error: 'Reserva no encontrada o no posee los permisos requeridos.' });
        }

        if (reserva.estado !== 'PAGADA' && reserva.estado !== 'EN_CURSO') {
            return res.status(400).json({ error: 'Operación denegada. La reserva no presenta estado de pago validado.' });
        }

        const fechaReserva = reserva.fechas.find(fr => fr.id === id_fecha_reserva);
        if (!fechaReserva) {
            return res.status(404).json({ error: 'La fecha de reserva especificada no existe en el sistema.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.evidenciaReserva.create({
                data: {
                    id_fecha_reserva,
                    tipo_momento: 'CHECK_IN',
                    url_foto,
                    comentarios
                }
            });

            await tx.fechaReserva.update({
                where: { id: id_fecha_reserva },
                data: {
                    estado: 'EN_CURSO',
                    hora_checkin_real: new Date()
                }
            });

            if (reserva.estado !== 'EN_CURSO') {
                await tx.reserva.update({
                    where: { id: idReserva },
                    data: { estado: 'EN_CURSO' }
                });
            }
        });

        logger.info('OperationController', `Check-In registrado exitosamente para la reserva: ${idReserva}`);

        res.json({ message: 'Procedimiento inicial registrado satisfactoriamente. El reporte fue documentado.' });

    } catch (error) {
        logger.error('OperationController', 'Error durante el procedimiento de Check-In.', error);
        next(error);
    }
}

/**
 * Registra la salida del arrendatario y ejecuta la liberación condicionada de fondos retenidos (Check-Out).
 * Transfiere los fondos de estado 'Retenido' a 'Disponible' en la billetera del arrendador.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const checkOut = async (req, res, next) => {
    try {
        const id_vendedor = req.user.id;
        const { idReserva } = req.params;
        const { id_fecha_reserva, url_foto, comentarios } = req.body;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: {
                fechas: true,
                garaje: true
            }
        });

        if (!reserva || reserva.id_vendedor !== id_vendedor) {
            return res.status(403).json({ error: 'Reserva no encontrada o no posee los permisos requeridos.' });
        }

        const fechaReserva = reserva.fechas.find(fr => fr.id === id_fecha_reserva);
        if (!fechaReserva) {
            return res.status(404).json({ error: 'La fecha de reserva especificada no existe en el sistema.' });
        }

        if (fechaReserva.estado !== 'EN_CURSO') {
            return res.status(400).json({ error: 'No es posible validar la salida sin un ingreso (Check-In) previamente documentado.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.evidenciaReserva.create({
                data: {
                    id_fecha_reserva,
                    tipo_momento: 'CHECK_OUT',
                    url_foto,
                    comentarios
                }
            });

            await tx.fechaReserva.update({
                where: { id: id_fecha_reserva },
                data: {
                    estado: 'COMPLETADA',
                    hora_checkout_real: new Date()
                }
            });

            const todasCompletadas = reserva.fechas.every(fr =>
                fr.id === id_fecha_reserva || fr.estado === 'COMPLETADA'
            );

            if (todasCompletadas) {
                await tx.reserva.update({
                    where: { id: idReserva },
                    data: { estado: 'COMPLETADA' }
                });

                const billeteraDueno = await tx.billetera.findUnique({
                    where: { id_usuario: reserva.garaje.id_dueno }
                });

                if (billeteraDueno) {
                    await tx.billetera.update({
                        where: { id: billeteraDueno.id },
                        data: {
                            saldo_retenido: { decrement: reserva.monto_dueno },
                            saldo_disponible: { increment: reserva.monto_dueno }
                        }
                    });

                    await tx.movimientoBilletera.create({
                        data: {
                            id_billetera: billeteraDueno.id,
                            id_reserva: idReserva,
                            tipo: 'LIBERACION',
                            monto: reserva.monto_dueno,
                            descripcion: `Fondos liberados correspondientes a la finalización de la Reserva #${reserva.id.split('-')[0]}.`
                        }
                    });
                }
            }
        });

        logger.info('OperationController', `Check-Out y liquidación de fondos completados para la reserva: ${idReserva}`);

        res.json({ message: 'Procedimiento de salida completado. Los fondos han sido liberados de acuerdo a las directrices de custodia.' });

    } catch (error) {
        logger.error('OperationController', 'Excepción crítica generada durante la estructura transaccional de Check-Out.', error);
        next(error);
    }
}

module.exports = {
    checkIn,
    checkOut
};
