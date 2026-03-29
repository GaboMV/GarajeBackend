const logger = require('../utils/logger');

/**
 * Middleware global de captura y formateo de excepciones HTTP no controladas.
 * 
 * @param {Error} err - Instancia del error capturado.
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const errorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor no categorizado.';

    logger.error('ErrorMiddleware', `Interceptado fallo estructural. Status: ${statusCode}`, err);

    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err : undefined
    });
};

module.exports = {
    errorMiddleware
};
