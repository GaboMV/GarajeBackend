const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Consulta referencial del balance contable estipulado a las carteras de un usuario específico.
 * Agrupa los saldos activos e integra sumatorias retenidas de reservaciones provisionales.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getBalance = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;

        const billetera = await prisma.billetera.findUnique({
            where: { id_usuario }
        });

        const reservasRetenidas = await prisma.reserva.aggregate({
            _sum: {
                monto_dueno: true
            },
            where: {
                garaje: { id_dueno: id_usuario },
                estado: { in: ['PAGADA', 'EN_CURSO'] }
            }
        });

        const en_proceso_reserva = reservasRetenidas._sum.monto_dueno || 0.00;
        const saldo_disponible = billetera ? billetera.saldo_disponible : 0.00;
        const saldo_retenido_billetera = billetera ? billetera.saldo_retenido : 0.00;

        res.json({
            saldo_disponible,
            saldo_retenido: parseFloat(saldo_retenido_billetera) + parseFloat(en_proceso_reserva),
            detalles: {
                billetera_retenido: saldo_retenido_billetera,
                reservas_en_curso: parseFloat(en_proceso_reserva)
            }
        });
    } catch (error) {
        logger.error('FinanceController', 'Error durante la agresión matemática de proyecciones financieras', error);
        next(error);
    }
}

/**
 * Instrumento para asentar la solicitud de reintegro en efectivo de saldos virtualizados.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const requestWithdrawal = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;
        const { monto, banco_destino, cuenta_destino } = req.body;

        if (!monto || monto <= 0) {
            return res.status(400).json({ error: 'Denominación monetaria incompatible.' });
        }

        const billetera = await prisma.billetera.findUnique({
            where: { id_usuario }
        });

        if (!billetera || parseFloat(billetera.saldo_disponible) < parseFloat(monto)) {
            return res.status(400).json({ error: 'Carencia de fondos suficientes para atender esta detracción.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.billetera.update({
                where: { id: billetera.id },
                data: {
                    saldo_disponible: { decrement: monto }
                }
            });

            await tx.solicitudRetiro.create({
                data: {
                    id_usuario,
                    monto,
                    banco_destino,
                    cuenta_destino,
                    estado: 'PENDIENTE'
                }
            });

            await tx.movimientoBilletera.create({
                data: {
                    id_billetera: billetera.id,
                    tipo: 'RETIRO',
                    monto,
                    descripcion: 'Emisión de petición formal orientada al flujo externo en el sistema bancario matriz.'
                }
            });
        });

        logger.info('FinanceController', `Fórmula de retiro encolada originada por usuario: ${id_usuario}. Monto: ${monto}`);

        res.json({ message: 'Tramitación recepcionada para revisión de área administrativa local.' });

    } catch (error) {
        logger.error('FinanceController', 'Dificultades insalvables operando el drenaje sistemático hacia entidades terciarias.', error);
        next(error);
    }
}

/**
 * Procedimiento reservado para la liberación ejecutiva de fondos mediante auditoría externa (Admin).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const approveWithdrawal = async (req, res, next) => {
    try {
        const { idSolicitud } = req.params;
        const { url_comprobante } = req.body;

        const solicitud = await prisma.solicitudRetiro.findUnique({ where: { id: idSolicitud } });

        if (!solicitud || solicitud.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: 'El expediente de abono excede sus atribuciones procesales o ya cursó salida.' });
        }

        await prisma.solicitudRetiro.update({
            where: { id: idSolicitud },
            data: {
                estado: 'PROCESADO',
                url_comprobante,
                fecha_procesado: new Date()
            }
        });

        logger.info('FinanceController', `Egreso procesado efectivamente y cerrado a nivel transaccional. ID Solicitud: ${idSolicitud}`);

        res.json({ message: 'Canalización completada. Transferencia ratificada en subsistema logístico central.' });
    } catch (error) {
        logger.error('FinanceController', 'Caída al aplicar estatus definitivo sobre la emisión contable subordinada', error);
        next(error);
    }
}

module.exports = {
    getBalance,
    requestWithdrawal,
    approveWithdrawal
};
