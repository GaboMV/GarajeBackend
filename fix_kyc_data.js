const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando reparación de datos KYC ---');

  // 1. Actualizar "true" (string de legado) a "VERIFICADO"
  const updatedTrue = await prisma.$executeRaw`
    UPDATE "Usuario" 
    SET "esta_verificado" = 'VERIFICADO' 
    WHERE "esta_verificado" = 'true' OR "esta_verificado" = '1';
  `;
  console.log(`Usuarios actualizados de "true" a "VERIFICADO": ${updatedTrue}`);

  // 2. Actualizar "false" (string de legado) a "NO_VERIFICADO"
  const updatedFalse = await prisma.$executeRaw`
    UPDATE "Usuario" 
    SET "esta_verificado" = 'NO_VERIFICADO' 
    WHERE "esta_verificado" = 'false' OR "esta_verificado" = '0' OR "esta_verificado" IS NULL;
  `;
  console.log(`Usuarios actualizados de "false" a "NO_VERIFICADO": ${updatedFalse}`);

  console.log('--- Reparación completada ---');
}

main()
  .catch((e) => {
    console.error('Error durante la reparación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
