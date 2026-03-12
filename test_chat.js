/**
 * Test E2E del Chat en Tiempo Real con Socket.io
 * Simula 2 usuarios: el Dueño del Garaje y un Vendedor 
 * conectándose al mismo room y enviando mensajes entre sí.
 */

const fetch = require('node-fetch');
const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'http://localhost:3000';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function registerAndLogin(correo, password, nombre) {
    await fetch(`${BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password, nombre_completo: nombre })
    });

    const res = await fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
    });

    const data = await res.json();
    return data;
}

async function runChatTests() {
    console.log('\n=== TEST E2E SOCKET.IO CHAT ===\n');

    try {
        // ── 1. Crear 2 usuarios ────────────────────────────────────────────
        const ts = Date.now();
        const dueno = await registerAndLogin(`dueno_${ts}@test.com`, 'pass123', 'Dueño Test');
        const vendedor = await registerAndLogin(`vendedor_${ts}@test.com`, 'pass123', 'Vendedor Test');

        console.log(`✅ Usuarios creados: Dueño y Vendedor`);

        // ── 2. Promover Dueño a Verificado y Admin para poder crear Garaje ─
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        await prisma.$executeRawUnsafe(
            `UPDATE "Usuario" SET es_admin = true, esta_verificado = true WHERE id IN ('${dueno.user.id}', '${vendedor.user.id}')`
        );
        await prisma.$disconnect();

        // Re-login ambos para JWT fresco
        const dueno2 = await registerAndLogin(`dueno_${ts}@test.com`, 'pass123', 'Dueño Test');
        const vendedor2 = await registerAndLogin(`vendedor_${ts}@test.com`, 'pass123', 'Vendedor Test');

        console.log(`✅ Usuarios verificados`);

        // ── 3. Dueño crea un Garaje ────────────────────────────────────────
        const resGaraje = await fetch(`${BASE_URL}/garages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dueno2.token}` },
            body: JSON.stringify({ nombre: 'Garaje Chat Test', precio_hora: 10, descripcion: 'Test' })
        });
        const dataGaraje = await resGaraje.json();
        const garajeId = dataGaraje.garaje?.id;
        console.log(`✅ Garaje creado: ${garajeId}`);

        // ── 4. Vendedor crea una Reserva (PENDIENTE) ───────────────────────
        const resReserva = await fetch(`${BASE_URL}/reservations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendedor2.token}` },
            body: JSON.stringify({
                id_garaje: garajeId,
                fecha: '2027-05-10',
                hora_inicio: '09:00',
                hora_fin: '11:00',
                mensaje_inicial: 'Quiero alquilar',
                acepto_terminos_responsabilidad: true
            })
        });
        const dataReserva = await resReserva.json();
        const reservaId = dataReserva.reserva?.id;
        console.log(`✅ Reserva creada: ${reservaId}`);

        // ── 5. Conectar 2 Sockets al mismo Room ───────────────────────────
        console.log('\n--- Conectando sockets al room de la reserva ---\n');

        const socketDueno = io(WS_URL, { auth: { token: dueno2.token }, transports: ['websocket'] });
        const socketVendedor = io(WS_URL, { auth: { token: vendedor2.token }, transports: ['websocket'] });

        await sleep(1000);

        // ── 6. Escuchar mensajes ───────────────────────────────────────────
        let messagesReceived = [];

        socketDueno.on('receive_message', (msg) => {
            console.log(`📩 Dueño recibió mensaje: "${msg.contenido}" de ${msg.emisor?.nombre_completo}`);
            messagesReceived.push({ receptor: 'dueno', msg });
        });

        socketVendedor.on('receive_message', (msg) => {
            console.log(`📩 Vendedor recibió mensaje: "${msg.contenido}" de ${msg.emisor?.nombre_completo}`);
            messagesReceived.push({ receptor: 'vendedor', msg });
        });

        socketDueno.on('error', (err) => console.error('❌ Error socket Dueño:', err));
        socketVendedor.on('error', (err) => console.error('❌ Error socket Vendedor:', err));

        // ── 7. Ambos se unen al room ────────────────────────────────────
        socketDueno.emit('join_room', { reservaId });
        socketVendedor.emit('join_room', { reservaId });

        await sleep(1000);

        // ── 8. Vendedor envía mensaje al Dueño ────────────────────────────
        console.log('📤 Vendedor envía mensaje...');
        socketVendedor.emit('send_message', {
            reservaId,
            contenido: '¡Hola! ¿Está disponible el garaje para 2 puestos?'
        });

        await sleep(2000);

        // ── 9. Dueño responde ──────────────────────────────────────────────
        console.log('📤 Dueño responde...');
        socketDueno.emit('send_message', {
            reservaId,
            contenido: 'Sí, tenemos capacidad para 3 vendedores simultáneos.'
        });

        await sleep(2000);

        // ── 10. Verificar historial via REST ─────────────────────────────
        const resHistorial = await fetch(`${BASE_URL}/chat/${reservaId}/mensajes`, {
            headers: { 'Authorization': `Bearer ${vendedor2.token}` }
        });
        const dataHistorial = await resHistorial.json();
        console.log(`\n✅ GET /chat/:id/mensajes → ${dataHistorial.mensajes?.length} mensajes persistidos`);

        // ── 11. Verificar Presigned URL ────────────────────────────────────
        const resPresigned = await fetch(`${BASE_URL}/chat/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vendedor2.token}` },
            body: JSON.stringify({ contentType: 'image/jpeg' })
        });
        const dataPresigned = await resPresigned.json();
        console.log(`✅ POST /chat/presigned-url → Estado: ${resPresigned.status}`);
        console.log('   uploadUrl:', dataPresigned.uploadUrl ? '✔ Generada' : '✘ Error');
        console.log('   publicUrl:', dataPresigned.publicUrl ? '✔ Generada' : '✘ Error');

        // ── Resultado ─────────────────────────────────────────────────────
        console.log('\n=== RESULTADO FINAL ===');
        // io.to(room) enviĆ³ cada mensaje a AMBOS sockets (emisor incluido).
        // 2 mensajes x 2 sockets = 4 eventos receive_message en total.
        console.log(`Eventos receive_message capturados: ${messagesReceived.length} (esperado: 4)`);
        console.log(`Mensajes persistidos en BD: ${dataHistorial.mensajes?.length} (esperado: 2)`);
        console.log(messagesReceived.length >= 4 && dataHistorial.mensajes?.length >= 2
            ? '🎉 TODOS LOS TESTS DEL CHAT PASARON ✅'
            : '⚠️  Revisar conteos: esperados 4 receive_message y 2 en BD');

        socketDueno.disconnect();
        socketVendedor.disconnect();

    } catch (e) {
        console.error('❌ Error en las pruebas de chat:', e);
    }
}

runChatTests();
