const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const badUrlHost = 'https://6b9366f5de0e1f1504b93b03c118f04c.r2.cloudflarestorage.com/garajes';
  const goodUrlHost = 'https://pub-ea90bddb9761482cada6720de6b9e634.r2.dev';

  const images = await prisma.imagenGaraje.findMany({
    where: {
      url: {
        startsWith: badUrlHost,
      },
    },
  });

  console.log(`Encontradas ${images.length} imágenes con URL antigua.`);

  for (const img of images) {
    const newUrl = img.url.replace(badUrlHost, goodUrlHost);
    await prisma.imagenGaraje.update({
      where: { id: img.id },
      data: { url: newUrl },
    });
  }
  
  console.log('URLs de imágenes actualizadas exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
