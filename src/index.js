require('dotenv').config();
const http = require('http');
const app = require('./app');
const prisma = require('./db/prisma');
const { initSocketGateway } = require('./socket/chat.gateway');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Crear el servidor HTTP sobre Express para que Socket.io lo comparta
const httpServer = http.createServer(app);

// Inicializar Socket.io sobre el mismo servidor HTTP
const io = initSocketGateway(httpServer);
app.set('socketio', io);

async function main() {
    try {
        await prisma.$connect();
        logger.info('System', 'Conexión a la base de datos establecida exitosamente.');

        httpServer.listen(PORT, () => {
            logger.info('System', `Servidor en ejecución sobre el puerto ${PORT}`);
            logger.info('System', 'Gateway de Socket.io Chat inicializado y activo');
        });
    } catch (error) {
        logger.error('System', 'Fallo al intentar establecer conexión con la base de datos', error);
        process.exit(1);
    }
}

main();

// Handle termination gracefully
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    logger.info('System', 'Conexión a Prisma finalizada por cierre de aplicación.');
    process.exit(0);
});
