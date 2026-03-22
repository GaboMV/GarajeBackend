const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const publicUrlBase = 'https://pub-ea90bddb9761482cada6720de6b9e634.r2.dev';
  const badHosts = [
    'https://6b9366f5de0e1f1504b93b03c118f04c.r2.cloudflarestorage.com/garajes',
    'https://6b9366f5de0e1f1504b93b03c118f04c.r2.cloudflarestorage.com'
  ];

  console.log('--- Iniciando limpieza profunda de URLs ---');

  const images = await prisma.imagenGaraje.findMany();
  console.log(`Analizando ${images.length} imágenes...`);

  let fixCount = 0;

  for (const img of images) {
    let newUrl = img.url;

    // 1. Corregir Hosts
    for (const badHost of badHosts) {
      if (newUrl.startsWith(badHost)) {
        // Si el badHost termina en /garajes, lo reemplazamos por el publicUrlBase
        // Si no, lo reemplazamos por publicUrlBase pero manteniendo el resto del path (que probablemente sea /garajes/...)
        newUrl = newUrl.replace(badHost, publicUrlBase);
        break;
      }
    }

    // 2. Corregir rutas duplicadas /garajes/garajes/
    if (newUrl.includes('/garajes/garajes/')) {
      newUrl = newUrl.replace('/garajes/garajes/', '/garajes/');
    }

    // 3. Asegurarse de que el path /garajes esté presente si el host es el público
    // Pero solo si no está ya. (Por ejemplo, si la URL quedó como https://...dev/uuid.jpeg)
    if (newUrl.startsWith(publicUrlBase) && !newUrl.includes('/garajes/')) {
        newUrl = newUrl.replace(publicUrlBase, publicUrlBase + '/garajes');
    }

    if (newUrl !== img.url) {
      console.log(`FIX: ${img.url} -> ${newUrl}`);
      await prisma.imagenGaraje.update({
        where: { id: img.id },
        data: { url: newUrl },
      });
      fixCount++;
    }
  }

  console.log(`--- Limpieza completada. Se actualizaron ${fixCount} imágenes. ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
