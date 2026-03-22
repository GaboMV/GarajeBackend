const prisma = require('../db/prisma');

/**
 * Obtener las notificaciones del usuario autenticado.
 * GET /api/notifications
 */
const getMyNotifications = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;
        const notificaciones = await prisma.notificacion.findMany({
            where: { id_usuario },
            orderBy: { fecha_creacion: 'desc' }
        });

        // Contar las no leídas
        const unreadCount = await prisma.notificacion.count({
            where: { id_usuario, leido: false }
        });

        res.json({
            notificaciones,
            unreadCount
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Marcar una notificación como leída.
 * PUT /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const id_usuario = req.user.id;

        // Validar propiedad
        const notificacion = await prisma.notificacion.findUnique({ where: { id } });
        if (!notificacion || notificacion.id_usuario !== id_usuario) {
            return res.status(403).json({ error: 'Notificación no encontrada o sin permisos' });
        }

        const actualizada = await prisma.notificacion.update({
            where: { id },
            data: { leido: true }
        });

        res.json({ message: 'Notificación leída', notificacion: actualizada });
    } catch (error) {
        next(error);
    }
}

/**
 * Marcar TODAS las notificaciones del usuario como leídas.
 * PUT /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;

        await prisma.notificacion.updateMany({
            where: { id_usuario, leido: false },
            data: { leido: true }
        });

        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead
};
