require('dotenv').config();
const app = require('./app');
const prisma = require('./db/prisma');

const PORT = process.env.PORT || 3000;

async function main() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Connected to database successfully');

        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
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
