const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GarajeBackend API Documentation',
      version: '1.0.0',
      description: 'API documentation for the GarajeBackend freelance project.',
      contact: {
        name: 'Developer',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local server',
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
