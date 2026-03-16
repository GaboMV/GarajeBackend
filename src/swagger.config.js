const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GarajeUCB — Documentación de API',
      version: '1.0.0',
      description:
        'Documentación de la API REST del proyecto GarajeUCB. ' +
        'Plataforma de alquiler de garajes/espacios comerciales entre particulares. ' +
        'Incluye autenticación JWT, verificación KYC, gestión de reservas, pagos, ' +
        'chat en tiempo real (Socket.io) y panel administrativo.',
      contact: {
        name: 'Equipo GarajeUCB',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor local (desarrollo)',
      },
      {
        url: 'https://tu-backend.onrender.com',
        description: 'Servidor de producción',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/app.js'], // files containing annotations as above
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
