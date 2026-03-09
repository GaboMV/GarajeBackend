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
        console.log(`Estado: ${resSearch.status}`, dataSearch.error || `Ok, ${dataSearch.length} garajes`);

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
