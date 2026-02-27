const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    // Uncomment for debugging queries
    // log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;
