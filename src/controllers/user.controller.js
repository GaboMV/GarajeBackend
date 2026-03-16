// Using Prisma directly
const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadFilePrivate } = require('../services/upload.service');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_garajes_dev_123';

/**
 * Register a new User
 * En el Flujo 1, un usuario descarga la app y se registra.
 * Nace en la base de datos como Usuario con esta_verificado = false.
 */
const register = async (req, res, next) => {
    try {
        const { correo, password, nombre_completo } = req.body;

        if (!correo || !password) {
            return res.status(400).json({ error: 'Correo y password son requeridos' });
        }

        // We check if the user exists
        const existingUser = await prisma.usuario.findUnique({ where: { correo } });
        if (existingUser) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.usuario.create({
            data: {
                correo,
                password: hashedPassword,
                nombre_completo: nombre_completo || null,
                esta_verificado: false // Nace sin verificar
            }
        });

        // Generate token
        const token = jwt.sign({ id: newUser.id, correo: newUser.correo }, JWT_SECRET, {
            expiresIn: '7d'
        });

        // Retornamos modo_actual explícitamente para que el frontend navegue
        // directamente a ModeSelection (no hay pantalla de OTP)
        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            token,
            user: {
                id: newUser.id,
                correo: newUser.correo,
                nombre_completo: newUser.nombre_completo,
                esta_verificado: newUser.esta_verificado,
                modo_actual: newUser.modo_actual  // → frontend navega a ModeSelection
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Upload KYC (Selfie and DNI)
 * La app le bloquea hacer reservas o publicar hasta que suba estas fotos
 */
const uploadKyc = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Validar que se enviaron ambos archivos
        if (!req.files || !req.files.dni_foto || !req.files.selfie) {
            return res.status(400).json({ error: 'Debes subir ambas fotos: dni_foto y selfie' });
        }

        const fileDni = req.files.dni_foto[0];
        const fileSelfie = req.files.selfie[0];

        // Subir a R2 Privado (bucket cerrado)
        const dni_foto_url = await uploadFilePrivate(fileDni, 'kyc');
        const selfie_url = await uploadFilePrivate(fileSelfie, 'kyc');

        const updatedUser = await prisma.usuario.update({
            where: { id: userId },
            data: {
                dni_foto_url,
                selfie_url,
                // El usuario NO SE VERIFICA AUN. Debe hacerlo el admin.
            }
        });

        res.json({
            message: 'Documentos KYC subidos correctamente. Esperando validación del Admin.',
            user: updatedUser
        });

    } catch (error) {
        next(error);
    }
}

const { getDynamicPresignedUrl } = require('../services/upload.service');

/**
 * Admin: Get User KYC details (Genera Presigned URLs)
 */
const getUserKyc = async (req, res, next) => {
    try {
        const { idUsuario } = req.params;
        const user = await prisma.usuario.findUnique({ where: { id: idUsuario } });

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!user.dni_foto_url && !user.selfie_url) return res.status(400).json({ error: 'El usuario no tiene documentos KYC subidos.' });

        const dniUrl = await getDynamicPresignedUrl(user.dni_foto_url);
        const selfieUrl = await getDynamicPresignedUrl(user.selfie_url);

        res.json({
            usuario: user.correo,
            estado: user.esta_verificado ? 'Aprobado' : 'Pendiente',
            documentos_temporales_5min: {
                dni_frontal: dniUrl,
                selfie: selfieUrl
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Admin: Approve User Verification
 * Un admin revisa las fotos y aprueba al usuario
 */
const approveUser = async (req, res, next) => {
    try {
        const { idUsuario } = req.params;

        const user = await prisma.usuario.findUnique({ where: { id: idUsuario } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (user.esta_verificado) {
            return res.status(400).json({ error: 'El usuario ya está verificado' });
        }

        const approvedUser = await prisma.usuario.update({
            where: { id: idUsuario },
            data: { esta_verificado: true }
        });

        res.json({
            message: 'Usuario aprobado exitosamente. Ya puede operar en la app.',
            user: approvedUser
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Login User
 */
const login = async (req, res, next) => {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({ error: 'Correo y password son requeridos' });
        }

        const user = await prisma.usuario.findUnique({ where: { correo } });
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user.id, correo: user.correo, es_admin: user.es_admin }, JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                correo: user.correo,
                nombre_completo: user.nombre_completo,
                esta_verificado: user.esta_verificado,
                modo_actual: user.modo_actual
            }
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Google Sign-In / Social Auth
 * El cliente (Flutter/React Native) usa Firebase Auth SDK con Google.
 * Tras autenticar al usuario, Firebase devuelve un "idToken".
 * Este endpoint recibe ese idToken, lo verifica y devuelve nuestro JWT propio.
 *
 * Flujo:
 *   1. App → Google → Firebase idToken
 *   2. App → POST /api/users/auth/google { idToken }
 *   3. Backend verifica idToken con Firebase Admin SDK
 *   4. Backend busca o crea el Usuario local
 *   5. Backend devuelve { token, user } con nuestro JWT
 */
const googleSignIn = async (req, res, next) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: 'idToken de Google es requerido' });
        }

        // Verificar el idToken con Firebase Admin SDK
        // Requiere inicializar firebase-admin con las credenciales del proyecto.
        // Por ahora el endpoint existe y está documentado; la inicialización de
        // firebase-admin se completa cuando el equipo provea el Service Account JSON.
        let firebaseAdmin;
        try {
            firebaseAdmin = require('../config/firebase.admin');
        } catch (e) {
            return res.status(501).json({
                error: 'Google Sign-In aún no configurado en el servidor.',
                instrucciones: 'Configura src/config/firebase.admin.js con el Service Account de Firebase para activar este endpoint.'
            });
        }

        const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
        const { email, name, uid } = decoded;

        if (!email) {
            return res.status(400).json({ error: 'El token de Google no contiene un correo electrónico.' });
        }

        // Buscar usuario existente o crear uno nuevo (sin contraseña)
        let user = await prisma.usuario.findUnique({ where: { correo: email } });

        if (!user) {
            user = await prisma.usuario.create({
                data: {
                    correo: email,
                    password: `google_uid_${uid}`, // contraseña placeholder; no usable para login clásico
                    nombre_completo: name || null,
                    esta_verificado: false
                }
            });
        }

        const token = jwt.sign({ id: user.id, correo: user.correo }, JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            message: user.createdAt === user.updatedAt ? 'Cuenta creada con Google.' : 'Login con Google exitoso.',
            token,
            user: {
                id: user.id,
                correo: user.correo,
                nombre_completo: user.nombre_completo,
                esta_verificado: user.esta_verificado,
                modo_actual: user.modo_actual
            }
        });
    } catch (error) {
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'El token de Google expiró. Vuelve a iniciar sesión.' });
        }
        if (error.code === 'auth/argument-error') {
            return res.status(400).json({ error: 'Token de Google inválido.' });
        }
        next(error);
    }
};

module.exports = {
    register,
    uploadKyc,
    getUserKyc,
    approveUser,
    login,
    googleSignIn
};
