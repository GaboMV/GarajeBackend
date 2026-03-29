const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Reporte sistemático de incidentes operativos o fallas transaccionales durante la ejecución de una reserva.
 * Provoca el bloqueo transitorio de fondos y la inmovilización del flujo normal del contrato.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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

        if (!reserva || (reserva.id_vendedor !== id_reportador && reserva.garaje.id_dueno !== id_reportador)) {
            return res.status(403).json({ error: 'Condición simétrica denegada. Su perfil no interviene en la reserva afectada.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.ticketSoporte.create({
                data: {
                    id_reserva: idReserva,
                    id_reportador,
                    tipo_problema,
                    descripcion_urgente,
                    estado: 'ABIERTO'
                }
            });

            await tx.reserva.update({
                where: { id: idReserva },
                data: { estado: 'EN_DISPUTA' }
            });
        });

        logger.info('SupportController', `Alerta de sistema (Soporte) emitida por usuario: ${id_reportador}. Reserva congelada: ${idReserva}`);

        res.status(201).json({
            message: 'Incidencia técnica y legal reportada. El activo subyacente entra en suspensión y los saldos quedan retenidos preventivamente.'
        });

    } catch (error) {
        logger.error('SupportController', 'Error crítico al instaurar variables de litigio', error);
        next(error);
    }
}

/**
 * Veredicto administrativo resolutorio a una disputa abierta. 
 * Finaliza el conflicto financiero y redirecciona los fondos en custodia hacia una de las partes.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const resolveTicket = async (req, res, next) => {
    try {
        const { idTicket } = req.params;
        const { decision } = req.body;

        const ticket = await prisma.ticketSoporte.findUnique({
            where: { id: idTicket },
            include: {
                reserva: { include: { garaje: true } }
            }
        });

        if (!ticket || ticket.estado !== 'ABIERTO') {
            return res.status(400).json({ error: 'Expediente no localizable o previamente sentenciado.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.ticketSoporte.update({
                where: { id: idTicket },
                data: {
                    estado: decision,
                    resolucion_admin: `Fallo y ejecución administrativa emitida manualmente.`,
                    fecha_cierre: new Date()
                }
            });

            if (decision === 'CERRADO_A_FAVOR_VENDEDOR') {
                await tx.reserva.update({
                    where: { id: ticket.id_reserva },
                    data: { estado: 'REEMBOLSADA' }
                });

                const billeteraDueno = await tx.billetera.findUnique({
                    where: { id_usuario: ticket.reserva.garaje.id_dueno }
                });

                if (billeteraDueno) {
                    await tx.billetera.update({
                        where: { id: billeteraDueno.id },
                        data: { saldo_retenido: { decrement: ticket.reserva.monto_dueno } }
                    });
                }

                logger.info('SupportController', `Veredicto de reembolso emitido sobre el ticket: ${idTicket}`);
            } else if (decision === 'CERRADO_A_FAVOR_DUENO') {
                await tx.reserva.update({
                    where: { id: ticket.id_reserva },
                    data: { estado: 'COMPLETADA' }
                });

                const billeteraDueno = await tx.billetera.findUnique({
                    where: { id_usuario: ticket.reserva.garaje.id_dueno }
                });

                if (billeteraDueno) {
                    await tx.billetera.update({
                        where: { id: billeteraDueno.id },
                        data: {
                            saldo_retenido: { decrement: ticket.reserva.monto_dueno },
                            saldo_disponible: { increment: ticket.reserva.monto_dueno }
                        }
                    });
                }
                
                logger.info('SupportController', `Veredicto de retención consolidada emitido sobre el ticket: ${idTicket}`);
            }
        });

        res.json({ message: `Diligencia de soporte dictaminada bajo cláusula: ${decision}` });

    } catch (error) {
        logger.error('SupportController', 'Colapso sistémico procesando mitigación de conflicto financiero.', error);
        next(error);
    }
}

/**
 * Evaluación métrica de la interacción contractual (Calificación Par a Par).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const rateExperience = async (req, res, next) => {
    try {
        const id_autor = req.user.id;
        const { idReserva } = req.params;
        const { id_objetivo, tipo_objetivo, puntuacion, comentario } = req.body;

        if (puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({ error: 'La escala de cuantificación estricta debe circunscribirse entre valores enteros de 1 al 5.' });
        }

        const reserva = await prisma.reserva.findUnique({
            where: { id: idReserva }
        });

        if (!reserva || reserva.estado !== 'COMPLETADA') {
            return res.status(400).json({ error: 'Evaluación asincrónica no permitida en estadios de reserva inconclusos.' });
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

        logger.info('SupportController', `Atribución cuantitativa inyectada exitosamente para la reserva: ${idReserva}`);

        res.status(201).json({ message: 'Índices descriptivos de servicio adjuntados satisfactoriamente en los repositorios centrales.', calificacion });

    } catch (error) {
        logger.error('SupportController', 'Error impidiendo estabilización de metadata descriptiva (Rating)', error);
        next(error);
    }
}

module.exports = {
    reportIssue,
    resolveTicket,
    rateExperience
}
