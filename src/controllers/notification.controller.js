const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Extracción de incidencias notificativas directas dependientes del portador del token.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getMyNotifications = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;
        const notificaciones = await prisma.notificacion.findMany({
            where: { id_usuario },
            orderBy: { fecha_creacion: 'desc' }
        });

        const unreadCount = await prisma.notificacion.count({
            where: { id_usuario, leido: false }
        });

        res.json({
            notificaciones,
            unreadCount
        });
    } catch (error) {
        logger.error('NotificationController', 'Falla técnica bloqueando la compilación de eventos de aviso orientativos', error);
        next(error);
    }
}

/**
 * Neutralización analítica (marcado como leída) sobre una tupla específica de notificaciones.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const id_usuario = req.user.id;

        const notificacion = await prisma.notificacion.findUnique({ where: { id } });
        if (!notificacion || notificacion.id_usuario !== id_usuario) {
            return res.status(403).json({ error: 'Rechazo estructural. No es viable accesar apuntadores ajenos o inválidos.' });
        }

        const actualizada = await prisma.notificacion.update({
            where: { id },
            data: { leido: true }
        });

        logger.info('NotificationController', `Cambio de estatus (bandera leída) ejecutado en puntero ID: ${id}`);

        res.json({ message: 'Convalidación del consumo de la notificación ejecutado sistemáticamente', notificacion: actualizada });
    } catch (error) {
        logger.error('NotificationController', 'Interrupción severa al intentar actualizar estado booleano de la notificación visual', error);
        next(error);
    }
}

/**
 * Operación unificada para convalidar en bloque todos los remanentes visuales no atendidos (marcar todas como leídas).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;

        await prisma.notificacion.updateMany({
            where: { id_usuario, leido: false },
            data: { leido: true }
        });

        logger.info('NotificationController', `Purga masiva de banderas flotantes en UI realizada para el usuario: ${id_usuario}`);

        res.json({ message: 'Depuración integral en cola de lectura completada.' });
    } catch (error) {
        logger.error('NotificationController', 'Catástrofe de concurrencias operando depurador multi-tupla sobre notificaciones', error);
        next(error);
    }
}

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead
};
