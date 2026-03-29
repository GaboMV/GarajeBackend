/**
 * Utils / Logger Académico
 * Estandarización de formato de logs en consola
 */

const getTimestamp = () => new Date().toISOString();

const logger = {
    info: (context, message, data = '') => {
        console.info(`[${getTimestamp()}] [INFO] [${context}] ${message}`, data);
    },
    warn: (context, message, data = '') => {
        console.warn(`[${getTimestamp()}] [WARN] [${context}] ${message}`, data);
    },
    error: (context, message, error) => {
        // En un entorno de producción, esto podría integrarse con Sentry o Datadog
        console.error(`[${getTimestamp()}] [ERROR] [${context}] ${message}`);
        if (error) {
            console.error(error);
        }
    }
};

module.exports = logger;
