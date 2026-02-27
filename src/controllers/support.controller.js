const prisma = require('../db/prisma');

/**
 * 1. Botón de Pánico / Crear Ticket de Disputa
 * El vendedor o dueño reportan un problema durante la reserva.
 * La Plataforma congela los fondos.
 */
const reportIssue = async (req, res, next) => {
    try {
        const id_reportador = req.user.id;
        const { idReserva } = req.params;
        const { tipo_problema, descripcion_urgente } = req.body;

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva },
            include: { garaje: true }
        });

        // Validar que participa en la reserva
        if (!reserva || (reserva.id_vendedor !== id_reportador && reserva.garaje.id_dueno !== id_reportador)) {
            return res.status(403).json({ error: 'Reserva no encontrada o no tienes permisos' });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Crear el ticket
            await tx.ticketSoporte.create({
                data: {
                    id_reserva: idReserva,
                    id_reportador,
                    tipo_problema,
                    descripcion_urgente,
                    estado: 'ABIERTO'
                }
            });

            // 2. Cambiar reserva a EN_DISPUTA (Congela la operación normal)
            await tx.reserva.update({
                where: { id: idReserva },
                data: { estado: 'EN_DISPUTA' }
            });

            // Los fondos del dueño se mantienen en "saldo_retenido", no se liberan.
        });

        res.status(201).json({
            message: 'Ticket creado. La reserva se ha puesto en disputa y los fondos están congelados. Nuestro equipo analizará el caso.'
        });

    } catch (error) {
        next(error);
    }
}

/**
 * 2. Cierre de Ticket (Admin)
 * El administrador (tú) le das la razón a alguna de las partes.
 */
const resolveTicket = async (req, res, next) => {
    try {
        const { idTicket } = req.params;
        const { decision } = req.body; // 'CERRADO_A_FAVOR_VENDEDOR' o 'CERRADO_A_FAVOR_DUENO'

        const ticket = await prisma.ticketSoporte.findUnique({
            where: { id: idTicket },
            include: {
                reserva: { include: { garaje: true } }
            }
        });

        if (!ticket || ticket.estado !== 'ABIERTO') {
            return res.status(400).json({ error: 'Ticket no válido o ya cerrado' });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Cerrar Ticket
            await tx.ticketSoporte.update({
                where: { id: idTicket },
                data: {
                    estado: decision,
                    resolucion_admin: `Decisión manual por Admin`,
                    fecha_cierre: new Date()
                }
            });

            if (decision === 'CERRADO_A_FAVOR_VENDEDOR') {
                // El Vendedor tenía razón (Ej. el lugar estaba cerrado). Se le reembolsa el total.
                await tx.reserva.update({
                    where: { id: ticket.id_reserva },
                    data: { estado: 'REEMBOLSADA' }
                });

                const billeteraDueno = await tx.billetera.findUnique({
                    where: { id_usuario: ticket.reserva.garaje.id_dueno }
                });

                if (billeteraDueno) {
                    // Descontar la retención del dueño, no recibirá el dinero.
                    await tx.billetera.update({
                        where: { id: billeteraDueno.id },
                        data: { saldo_retenido: { decrement: ticket.reserva.monto_dueno } }
                    });
                }

                // (Opcional) Guardar registro de que App debe Reembolsar manualmente al medio bancario del vendedor.
            } else if (decision === 'CERRADO_A_FAVOR_DUENO') {
                // El Dueño tenía razón. (Ej. el vendedor dañó algo). El dueño se queda el pago.
                await tx.reserva.update({
                    where: { id: ticket.id_reserva },
                    data: { estado: 'COMPLETADA' }
                });

                const billeteraDueno = await tx.billetera.findUnique({
                    where: { id_usuario: ticket.reserva.garaje.id_dueno }
                });

                if (billeteraDueno) {
                    // Mover retención a disponible
                    await tx.billetera.update({
                        where: { id: billeteraDueno.id },
                        data: {
                            saldo_retenido: { decrement: ticket.reserva.monto_dueno },
                            saldo_disponible: { increment: ticket.reserva.monto_dueno }
                        }
                    });
                }
            }
        });

        res.json({ message: `Disputa resuelta: ${decision}` });

    } catch (error) {
        next(error);
    }
}

/**
 * 3. Dejar Calificación 
 * Al completarse la reserva, ambas partes se califican.
 */
const rateExperience = async (req, res, next) => {
    try {
        const id_autor = req.user.id;
        const { idReserva } = req.params;
        const { id_objetivo, tipo_objetivo, puntuacion, comentario } = req.body;
        // tipo_objetivo: USUARIO (Vendedor) o GARAJE (Dueño)

        if (puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({ error: 'La puntuación debe ser entre 1 y 5' });
        }

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva }
        });

        if (!reserva || reserva.estado !== 'COMPLETADA') {
            return res.status(400).json({ error: 'Solo puedes calificar reservas COMPLETADAS' });
        }

        const calificacion = await prisma.calificacion.create({
            data: {
                id_reserva: idReserva,
                id_autor,
                id_objetivo,
                tipo_objetivo,
                puntuacion,
                comentario
            }
        });

        res.status(201).json({ message: 'Calificación registrada', calificacion });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    reportIssue,
    resolveTicket,
    rateExperience
}
