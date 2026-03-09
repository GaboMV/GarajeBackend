const prisma = require('../db/prisma');

/**
 * 1. Consultar Saldo (Dueño) y Analítica
 * Incluye Retenidos por reservas "EN_CURSO"
 */
const getBalance = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;

        // 1. Obtener billetera actual
        const billetera = await prisma.billetera.findUnique({
            where: { id_usuario }
        });

        // 2. Calcular saldos retenidos en Reservas "EN_CURSO" y "PAGADAS" que aún no liberan el dinero
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
        next(error);
    }
}

/**
 * 2. Solicitar Retiro de Fondos
 */
const requestWithdrawal = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;
        const { monto, banco_destino, cuenta_destino } = req.body;

        if (!monto || monto <= 0) {
            return res.status(400).json({ error: 'Monto inválido' });
        }

        const billetera = await prisma.billetera.findUnique({
            where: { id_usuario }
        });

        if (!billetera || parseFloat(billetera.saldo_disponible) < parseFloat(monto)) {
            return res.status(400).json({ error: 'Saldo disponible insuficiente' });
        }

        await prisma.$transaction(async (tx) => {
            // Descontar saldo de la billetera temporalmente (o bloquearlo as "en transito" si tuvieramos ese estado)
            await tx.billetera.update({
                where: { id: billetera.id },
                data: {
                    saldo_disponible: { decrement: monto }
                }
            });

            // Registrar la solicitud
            await tx.solicitudRetiro.create({
                data: {
                    id_usuario,
                    monto,
                    banco_destino,
                    cuenta_destino,
                    estado: 'PENDIENTE'
                }
            });

            // Registrar movimiento de retiro
            await tx.movimientoBilletera.create({
                data: {
                    id_billetera: billetera.id,
                    tipo: 'RETIRO',
                    monto,
                    descripcion: 'Solicitud de retiro a cuenta bancaria.'
                }
            });
        });

        res.json({ message: 'Solicitud de retiro creada. El administrador procesará tu pago en breve.' });

    } catch (error) {
        next(error);
    }
}

/**
 * 3. Aprobar Retiro (Admin)
 */
const approveWithdrawal = async (req, res, next) => {
    try {
        const { idSolicitud } = req.params;
        const { url_comprobante } = req.body;

        const solicitud = await prisma.solicitudRetiro.findUnique({ where: { id: idSolicitud } });

        if (!solicitud || solicitud.estado !== 'PENDIENTE') {
            return res.status(400).json({ error: 'Solicitud no encontrada o ya procesada.' });
        }

        await prisma.solicitudRetiro.update({
            where: { id: idSolicitud },
            data: {
                estado: 'PROCESADO',
                url_comprobante,
                fecha_procesado: new Date()
            }
        });

        res.json({ message: 'Retiro procesado correctamente.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getBalance,
    requestWithdrawal,
    approveWithdrawal
};
