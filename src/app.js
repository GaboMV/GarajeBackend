const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorMiddleware } = require('./middlewares/error.middleware');

const app = express();
app.set('trust proxy', 1); // Confía en el proxy de Render para el Rate Limit

const userRoutes = require('./routes/user.routes');
const garageRoutes = require('./routes/garage.routes');
const searchRoutes = require('./routes/search.routes');
const reservationRoutes = require('./routes/reservation.routes');
const operationRoutes = require('./routes/operation.routes');
const financeRoutes = require('./routes/finance.routes');
const supportRoutes = require('./routes/support.routes');
const chatRoutes = require('./routes/chat.routes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.config');

// Middlewares de Seguridad Global
// Configurar cabeceras HTTP seguras
app.use(helmet());

// Habilitar CORS restrictivo (Configurable por variable de entorno)
// Si no hay FRONTEND_URL en el .env, por defecto permitirá '*' (útil para desarrollo)
const allowedOrigin = process.env.FRONTEND_URL || '*';

app.use(cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Limitar el número de requests repetidos a la API (Protección contra DDoS/Fuerza Bruta)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limitar a 100 requests por IP cada 15 min
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.',
    standardHeaders: true, // Retorna info del rate limit en los headers `RateLimit-*`
    legacyHeaders: false, // Deshabilita los headers `X-RateLimit-*`
});
// Aplicar limitador a todas las rutas bajo /api/
app.use('/api/', limiter);

// Parsear JSON (con un límite para evitar que colpasen la memoria con payloads masivos)
app.use(express.json({ limit: '10mb' }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Main Router Configuration
app.use('/api/users', userRoutes);
app.use('/api/garages', garageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/chat', chatRoutes);

// Routes (to be added)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
