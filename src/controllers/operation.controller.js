const prisma = require('../db/prisma');

/**
 * 1. Check-In "Blindado"
 * El Vendedor llega y toma foto de cómo está el garaje.
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
            return res.status(403).json({ error: 'Reserva no encontrada o no tienes permisos' });
        }

        if (reserva.estado !== 'PAGADA' && reserva.estado !== 'EN_CURSO') {
            return res.status(400).json({ error: 'No puedes hacer check-in. La reserva no ha sido pagada.' });
        }

        const fechaReserva = reserva.fechas.find(fr => fr.id === id_fecha_reserva);
        if (!fechaReserva) {
            return res.status(404).json({ error: 'Fecha de reserva no encontrada' });
        }

        await prisma.$transaction(async (tx) => {
            // Guardar evidencia fotográfica
            await tx.evidenciaReserva.create({
                data: {
                    id_fecha_reserva,
                    tipo_momento: 'CHECK_IN',
                    url_foto,
                    comentarios
                }
            });

            // Actualizar status del día
            await tx.fechaReserva.update({
                where: { id: id_fecha_reserva },
                data: {
                    estado: 'EN_CURSO',
                    hora_checkin_real: new Date()
                }
            });

            // Actualizar status general de la reserva
            if (reserva.estado !== 'EN_CURSO') {
                await tx.reserva.update({
                    where: { id: idReserva },
                    data: { estado: 'EN_CURSO' }
                });
            }
        });

        res.json({ message: 'Check-in registrado de forma segura. El dueño fue notificado.' });

    } catch (error) {
        next(error);
    }
}

/**
 * 2. Check-Out "Blindado" y Liberación de Fondos
 * El Vendedor se va, sube foto de limpieza, la reserva se marca como COMPLETADA.
 * Los fondos del dueño se mueven de "Retenidos" a "Disponibles".
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
            return res.status(403).json({ error: 'Reserva no encontrada o no tienes permisos' });
        }

        const fechaReserva = reserva.fechas.find(fr => fr.id === id_fecha_reserva);
        if (!fechaReserva) {
            return res.status(404).json({ error: 'Fecha de reserva no encontrada' });
        }

        if (fechaReserva.estado !== 'EN_CURSO') {
            return res.status(400).json({ error: 'No puedes hacer check-out si no hiciste check-in.' });
        }

        // Ejecutar Flujo Transaccional CRÍTICO (Escrow Cash-Out)
        await prisma.$transaction(async (tx) => {
            // 1. Guardar la evidencia fotográfica de salida
            await tx.evidenciaReserva.create({
                data: {
                    id_fecha_reserva,
                    tipo_momento: 'CHECK_OUT',
                    url_foto,
                    comentarios
                }
            });

            // 2. Marcar día(FechaReserva) como completado
            await tx.fechaReserva.update({
                where: { id: id_fecha_reserva },
                data: {
                    estado: 'COMPLETADA',
                    hora_checkout_real: new Date()
                }
            });

            // Consideraremos la RESERVA entera como completada para el MVP.
            // Si la reserva tiene varías fechas, la lógica real debería verificar que 
            // no queden días EN_CURSO ni PROGRAMADOS antes de liberar fondos globales.
            const todasCompletadas = reserva.fechas.every(fr =>
                fr.id === id_fecha_reserva || fr.estado === 'COMPLETADA'
            );

            if (todasCompletadas) {
                // 3. Marcar Reserva como COMPLETADA
                await tx.reserva.update({
                    where: { id: idReserva },
                    data: { estado: 'COMPLETADA' }
                });

                // 4. Liberar los fondos al dueño
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

                    // Registrar Movimiento Billetera (Liberación)
                    await tx.movimientoBilletera.create({
                        data: {
                            id_billetera: billeteraDueno.id,
                            id_reserva: idReserva,
                            tipo: 'LIBERACION',
                            monto: reserva.monto_dueno,
                            descripcion: `Fondos liberados por Check-out Reserva #${reserva.id.split('-')[0]}.`
                        }
                    });

                    // (Opcional MVP) Mover tu ganancia (comision_app) a tu billetera Admin
                }
            }
        });

        res.json({ message: 'Check-out completado exitosamente. Los fondos han sido liberados y procesados.' });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    checkIn,
    checkOut
};
