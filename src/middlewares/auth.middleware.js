const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_garajes_dev_123';

/**
 * Middleware para validar si el token provisto es correcto
 * y cargar el usuario en la request
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Acceso denegado. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await prisma.usuario.findUnique({
            where: { id: decoded.id }
        });

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
};

/**
 * Middleware para validar que el usuario ya subió su KYC y el Admin lo verificó.
 * Debe ir después de 'requireAuth'
 */
const requireVerifiedKYC = (req, res, next) => {
    if (!req.user || !req.user.esta_verificado) {
        return res.status(403).json({
            error: 'KYC Pendiente. Debes subir tu foto y DNI y esperar la validación del Administrador para realizar esta acción.'
        });
    }
    next();
}

/**
 * Middleware temporal para simular Admin (solo para propósitos del ejercicio).
 * Idealmente usarías un role en la base de datos (por ende una tabla Role).
 */
const requireAdmin = (req, res, next) => {
    // Para simplificar, asumiremos que si envía una cabecera 'X-Admin-Token' con valor maestro entra.
    const adminToken = req.headers['x-admin-token'];

    if (adminToken !== 'soy-el-admin-secreto') {
        return res.status(403).json({ error: 'Privilegios de administrador requeridos' });
    }

    next();
}


module.exports = {
    requireAuth,
    requireVerifiedKYC,
    requireAdmin
};
