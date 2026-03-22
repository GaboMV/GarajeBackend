const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando Seed de Datos ---');

    console.log('1. Limpiando base de datos (Opcional)...');
    // Para un seed limpio, podrías borrar todo, pero ten cuidado si hay datos importantes.
    // await prisma.usuario.deleteMany(); 

    const salt = await bcrypt.genSalt(10);
    const commonPassword = await bcrypt.hash('password123', salt);
    const adminPassword = await bcrypt.hash('admin123', salt);

    // 2. Crear Usuarios
    console.log('2. Creando usuarios...');

    // Admin
    const admin = await prisma.usuario.upsert({
        where: { correo: 'admin@garaje.com' },
        update: {},
        create: {
            correo: 'admin@garaje.com',
            password: adminPassword,
            nombre_completo: 'Administrador Sistema',
            es_admin: true,
            esta_verificado: "VERIFICADO"
        }
    });

    // Dueño Verificado
    const owner1 = await prisma.usuario.upsert({
        where: { correo: 'juan@garaje.com' },
        update: {},
        create: {
            correo: 'juan@garaje.com',
            password: commonPassword,
            nombre_completo: 'Juan Pérez',
            esta_verificado: "VERIFICADO",
            modo_actual: 'VENDEDOR'
        }
    });

    // Dueño Pendiente (Subió KYC pero no aprobado)
    const owner2 = await prisma.usuario.upsert({
        where: { correo: 'maria@garaje.com' },
        update: {},
        create: {
            correo: 'maria@garaje.com',
            password: commonPassword,
            nombre_completo: 'Maria García',
            esta_verificado: "PENDIENTE",
            dni_foto_url: 'kyc/dni_dummy.jpg',
            selfie_url: 'kyc/selfie_dummy.jpg',
            modo_actual: 'VENDEDOR'
        }
    });

    // Cliente (Arrendatario)
    const client = await prisma.usuario.upsert({
        where: { correo: 'pepe@garaje.com' },
        update: {},
        create: {
            correo: 'pepe@garaje.com',
            password: commonPassword,
            nombre_completo: 'Pepe Cliente',
            esta_verificado: "NO_VERIFICADO",
            modo_actual: 'ARRENDATARIO'
        }
    });

    console.log('3. Creando garajes para Juan (Miraflores y San Isidro)...');

    // Garaje 1: Miraflores
    const g1 = await prisma.garaje.create({
        data: {
            id_dueno: owner1.id,
            nombre: 'Garaje Central Miraflores',
            descripcion: 'Espacio amplio, techado y con vigilancia 24/7.',
            direccion: 'Av. Larco 123, Miraflores',
            latitud: -12.122114,
            longitud: -77.029854,
            precio_hora: 5.50,
            precio_dia: 40.00,
            capacidad_puestos: 2,
            esta_aprobado: true,
            tiene_wifi: true,
            tiene_electricidad: true,
            documento_propiedad_url: 'docs/g1_propiedad.pdf'
        }
    });

    // Garaje 2: San Isidro
    const g2 = await prisma.garaje.create({
        data: {
            id_dueno: owner1.id,
            nombre: 'San Isidro Executive Parking',
            descripcion: 'Ideal para ejecutivos. Cerca a zona financiera.',
            direccion: 'Calle Las Begonias 456, San Isidro',
            latitud: -12.093358,
            longitud: -77.022131,
            precio_hora: 8.00,
            precio_dia: 60.00,
            capacidad_puestos: 1,
            esta_aprobado: true,
            tiene_bano: true,
            documento_propiedad_url: 'docs/g2_propiedad.pdf'
        }
    });

    // Garaje 3: Para Maria (Pendiente)
    const g3 = await prisma.garaje.create({
        data: {
            id_dueno: owner2.id,
            nombre: 'Cochera Familiar Surco',
            descripcion: 'Cochera en casa familiar, muy segura.',
            direccion: 'Av. El Polo 789, Surco',
            latitud: -12.112211,
            longitud: -76.974422,
            precio_hora: 4.00,
            precio_dia: 30.00,
            capacidad_puestos: 1,
            esta_aprobado: false, // Pendiente de Admin
            documento_propiedad_url: 'docs/g3_propiedad.pdf'
        }
    });

    console.log('4. Actualizando ubicaciones espaciales en PostGIS...');
    
    // Actualizar puntos PostGIS para que funcionen con la búsqueda por radio
    const garajes = [g1, g2, g3];
    for (const g of garajes) {
        await prisma.$executeRaw`
            UPDATE "Garaje" 
            SET ubicacion_geo = ST_SetSRID(ST_MakePoint(${parseFloat(g.longitud)}, ${parseFloat(g.latitud)}), 4326) 
            WHERE id = ${g.id}
        `;
    }

    console.log('5. Creando horarios default...');
    // Abrir de Lunes a Domingo de 8am a 10pm para todos
    const ids = [g1.id, g2.id, g3.id];
    for (const gid of ids) {
        for (let i = 0; i <= 6; i++) {
            await prisma.horarioSemanal.create({
                data: {
                    id_garaje: gid,
                    dia_semana: i,
                    abierto: true,
                    hora_inicio: '08:00',
                    hora_fin: '20:00'
                }
            });
        }
    }

    console.log('--- Seed Finalizado con Éxito ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
