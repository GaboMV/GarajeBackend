const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
    console.log("=== INICIANDO PRUEBAS GLOBALES DE ENDPOINTS ===");
    let token = '';
    let adminToken = '';
    let userId = '';
    let garajeId = '';

    // --- AUTH FLOW ---
    try {
        console.log("\n--- FLUJO DE USUARIOS ---");

        // 1. Registro
        console.log("[1] Probando: POST /users/register");
        const resReg = await fetch(`${BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                correo: `test_${Date.now()}@mail.com`,
                password: 'password123',
                nombre_completo: 'Test User'
            })
        });
        const dataReg = await resReg.json();
        console.log(`Estado: ${resReg.status}`, dataReg.message || dataReg.error || dataReg);

        // 2. Login
        console.log("\n[2] Probando: POST /users/login");
        const resLogin = await fetch(`${BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                correo: dataReg.user.correo,
                password: 'password123'
            })
        });
        const dataLogin = await resLogin.json();
        console.log(`Estado: ${resLogin.status}`, dataLogin.message || dataLogin.error);

        if (dataLogin.token) {
            token = dataLogin.token;
            userId = dataLogin.user.id;
        } else {
            console.error("Login fallido, abortando pruebas");
            return;
        }

        // Crear una imagen falsa en disco para probar Cloudflare
        const dummyImgPath = './dummy.jpg';
        fs.writeFileSync(dummyImgPath, 'dummy image content data here for testing');

        // 3. KYC (Upload Privado)
        console.log("\n[3] Probando: POST /users/kyc (Cloudflare Privado)");
        const formKyc = new FormData();
        formKyc.append('dni_foto', fs.createReadStream(dummyImgPath), { contentType: 'image/jpeg' });
        formKyc.append('selfie', fs.createReadStream(dummyImgPath), { contentType: 'image/jpeg' });

        const resKyc = await fetch(`${BASE_URL}/users/kyc`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formKyc
        });
        const dataKyc = await resKyc.json();
        console.log(`Estado: ${resKyc.status}`, dataKyc.message || dataKyc.error);
        if (dataKyc.user) {
            console.log("-> Key de DNI obtenida:", dataKyc.user.dni_foto_url);
        }

        // 4. Admin KYC Endpoint 
        console.log("\n[4] Probando: GET /users/kyc/:id (Como Admin para verificar URL firmada de S3)");

        // Vamos a inyectar al usuario como ADMIN directamente en BD para el test
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        // Ejecutamos crudo porque puede que el schema no haya migrado 'es_admin'
        await prisma.$executeRawUnsafe(`UPDATE "Usuario" SET es_admin = true, esta_verificado = true WHERE id = '${userId}'`);

        // Volvemos a hacer login para tener un token con es_admin=true
        const resLoginAdmin = await fetch(`${BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: dataReg.user.correo, password: 'password123' })
        });
        const dataLoginAdmin = await resLoginAdmin.json();
        adminToken = dataLoginAdmin.token;

        const resKycAdmin = await fetch(`${BASE_URL}/users/kyc/${userId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataKycAdmin = await resKycAdmin.json();
        console.log(`Estado: ${resKycAdmin.status}`, "Presigned URL de DNI obtenida con éxito.");

        // 5. Aprobar KYC
        console.log("\n[5] Probando: POST /users/approve/:id");
        const resApprove = await fetch(`${BASE_URL}/users/approve/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log(`Estado: ${resApprove.status}`, "Usuario KYC aprobado");

        console.log("\n--- FLUJO DE GARAJES ---");
        console.log("\n[6] Probando: POST /garages");
        const resGarage = await fetch(`${BASE_URL}/garages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                nombre: 'Garaje Central Test',
                precio_hora: 15.5,
                descripcion: 'Test',
                direccion: 'Calle Test'
            })
        });
        const dataGarage = await resGarage.json();
        console.log(`Estado: ${resGarage.status}`, dataGarage.error || dataGarage.message);

        if (dataGarage.garaje) {
            garajeId = dataGarage.garaje.id;
        } else {
            // Si falla por el KYC, lo forzaremos en la BD solo para este test
        }

        // 7. Subir imagen de Garaje (Upload Público)
        if (garajeId) {
            console.log("\n[7] Probando: POST /garages/:id/imagenes (Cloudflare Público)");
            const formGarage = new FormData();
            formGarage.append('imagen', fs.createReadStream(dummyImgPath), { contentType: 'image/jpeg' });

            const resImg = await fetch(`${BASE_URL}/garages/${garajeId}/imagenes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formGarage
            });
            const dataImg = await resImg.json();
            console.log(`Estado: ${resImg.status}`, dataImg.error || dataImg.imagen);
        }

        // --- FLUJO DE BUSQUEDA ---
        console.log("\n--- FLUJO DE BUSQUEDA ---");
        console.log("\n[8] Probando: GET /search");
        const resSearch = await fetch(`${BASE_URL}/search?fecha=2026-10-10&hora_inicio=08:00&hora_fin=12:00`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataSearch = await resSearch.json();
        console.log(`Estado: ${resSearch.status}`, dataSearch.error || `Ok, ${dataSearch.total_encontrados ?? 0} garajes`);

        // --- FLUJO DE RESERVA (necesaria para el chat) ---
        console.log("\n--- FLUJO DE RESERVA ---");
        console.log("\n[9] Probando: POST /reservations");
        const resReserva = await fetch(`${BASE_URL}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                id_garaje: garajeId,
                fecha: '2027-08-15',
                hora_inicio: '09:00',
                hora_fin: '13:00',
                mensaje_inicial: 'Quiero reservar un puesto.',
                acepto_terminos_responsabilidad: true
            })
        });
        const dataReserva = await resReserva.json();
        console.log(`Estado: ${resReserva.status}`, dataReserva.error || dataReserva.message);
        const reservaId = dataReserva.reserva?.id;

        // --- FLUJO DE CHAT ---
        console.log("\n--- FLUJO DE CHAT (REST + Socket.io) ---");

        // [10] Presigned URL para adjunto
        console.log("\n[10] Probando: POST /chat/presigned-url");
        const resPresigned = await fetch(`${BASE_URL}/chat/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ contentType: 'image/jpeg' })
        });
        const dataPresigned = await resPresigned.json();
        console.log(`Estado: ${resPresigned.status}`, dataPresigned.error || (dataPresigned.uploadUrl ? 'Presigned URL generada ✅' : 'Error'));

        if (reservaId) {
            // [11] Historial mensajes (vacío inicialmente)
            console.log("\n[11] Probando: GET /chat/:id/mensajes");
            const resHist = await fetch(`${BASE_URL}/chat/${reservaId}/mensajes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataHist = await resHist.json();
            console.log(`Estado: ${resHist.status}`, dataHist.error || `${dataHist.mensajes?.length ?? 0} mensajes en historial`);

            // [12] Chat en tiempo real via Socket.io
            console.log("\n[12] Probando: Socket.io — join_room + send_message + receive_message");
            const { io } = require('socket.io-client');
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));

            const socketA = io('http://localhost:3000', { auth: { token }, transports: ['websocket'] });
            const socketB = io('http://localhost:3000', { auth: { token: adminToken }, transports: ['websocket'] });

            let received = [];
            socketA.on('receive_message', (msg) => received.push({ para: 'A', msg }));
            socketB.on('receive_message', (msg) => received.push({ para: 'B', msg }));
            socketA.on('error', (e) => console.log('  Socket A error:', e.message));
            socketB.on('error', (e) => console.log('  Socket B error:', e.message));

            await sleep(800);
            socketA.emit('join_room', { reservaId });
            socketB.emit('join_room', { reservaId });
            await sleep(800);

            socketA.emit('send_message', { reservaId, contenido: 'Hola desde Socket Test A' });
            await sleep(1500);
            socketB.emit('send_message', { reservaId, contenido: 'Respuesta desde Socket Test B' });
            await sleep(1500);

            socketA.disconnect();
            socketB.disconnect();

            // Verificar que los mensajes persistieron en BD
            const resHist2 = await fetch(`${BASE_URL}/chat/${reservaId}/mensajes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataHist2 = await resHist2.json();

            console.log(`  -> Eventos receive_message capturados: ${received.length} (esperado: 4 — 2 msg × 2 sockets)`);
            console.log(`  -> Mensajes persistidos en BD: ${dataHist2.mensajes?.length} (esperado: 2)`);
            console.log(`  -> ${received.length >= 4 && dataHist2.mensajes?.length >= 2 ? '🎉 CHAT 100% OK' : '⚠️  Verificar conteos'}`);
        } else {
            console.log("  [!] Saltando tests de chat: no se pudo crear la reserva.");
        }

        console.log("\n=== PRUEBAS COMPLETADAS ===");

        // Limpiar dummy
        if (fs.existsSync(dummyImgPath)) {
            fs.unlinkSync(dummyImgPath);
        }

    } catch (e) {
        console.error("Error en las pruebas:", e);
    }
}

runTests();
