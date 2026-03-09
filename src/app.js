const express = require('express');
const cors = require('cors');
const { errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

const userRoutes = require('./routes/user.routes');
const garageRoutes = require('./routes/garage.routes');
const searchRoutes = require('./routes/search.routes');
const reservationRoutes = require('./routes/reservation.routes');
const operationRoutes = require('./routes/operation.routes');
const financeRoutes = require('./routes/finance.routes');
const supportRoutes = require('./routes/support.routes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.config');

// Middlewares
app.use(cors());
app.use(express.json());

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

// Routes (to be added)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
