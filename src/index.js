require('dotenv').config();
const http = require('http');
const app = require('./app');
const prisma = require('./db/prisma');
const { initSocketGateway } = require('./socket/chat.gateway');

const PORT = process.env.PORT || 3000;

// Crear el servidor HTTP sobre Express para que Socket.io lo comparta
const httpServer = http.createServer(app);

// Inicializar Socket.io sobre el mismo servidor HTTP
initSocketGateway(httpServer);

async function main() {
    try {
        await prisma.$connect();
        console.log('✅ Connected to database successfully');

        httpServer.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`💬 Socket.io Chat Gateway active`);
        });
    } catch (error) {
        console.error('❌ Failed to connect to the database', error);
        process.exit(1);
    }
}

main();

// Handle termination gracefully
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected on app termination');
    process.exit(0);
});

