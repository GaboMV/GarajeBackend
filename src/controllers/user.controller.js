// Using Prisma directly
const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
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
                modo_actual: user.modo_actual,
                es_admin: user.es_admin
            }
        });
    } catch (error) {
        next(error);
    }
}

const fetch = require('node-fetch');

/**
 * Google Sign-In / Social Auth
 * El cliente (Flutter) puede enviar 'idToken' (Mobile) o 'accessToken' (Web).
 */
const googleSignIn = async (req, res, next) => {
    try {
        const { idToken, accessToken } = req.body;

        if (!idToken && !accessToken) {
            return res.status(400).json({ error: 'Se requiere idToken o accessToken de Google' });
        }

        let email, name, google_uid;

        if (idToken) {
            // Flujo Mobile (ID Token)
            const clientIDs = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.split(',').map(id => id.trim()) : [];
            const client = new OAuth2Client();
            
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: clientIDs,
            });

            const payload = ticket.getPayload();
            email = payload.email;
            name = payload.name;
            google_uid = payload.sub;
        } else {
            // Flujo Web (Access Token)
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error('No se pudo validar el accessToken con Google');
            }

            const data = await response.json();
            email = data.email;
            name = data.name;
            google_uid = data.sub;
        }

        if (!email) {
            return res.status(400).json({ error: 'El perfil de Google no contiene un correo electrónico.' });
        }

        // Buscar usuario existente o crear uno nuevo
        let user = await prisma.usuario.findUnique({ where: { correo: email } });

        if (!user) {
            user = await prisma.usuario.create({
                data: {
                    correo: email,
                    password: `google_oauth_${google_uid}`,
                    nombre_completo: name || null,
                    esta_verificado: false,
                    modo_actual: 'VENDEDOR'
                }
            });
        }

        const token = jwt.sign({ id: user.id, correo: user.correo, es_admin: user.es_admin }, JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            message: 'Login con Google exitoso.',
            token,
            user: {
                id: user.id,
                correo: user.correo,
                nombre_completo: user.nombre_completo,
                esta_verificado: user.esta_verificado,
                modo_actual: user.modo_actual,
                es_admin: user.es_admin
            }
        });
    } catch (error) {
        console.error('Error en Google Auth:', error);
        return res.status(401).json({ error: 'Token de Google inválido, expirado o error al obtener perfil.' });
    }
};

/**
 * Admin: List users with pending KYC
 * Busca usuarios que no están verificados pero que tienen documentos subidos.
 */
const getPendingKycUsers = async (req, res, next) => {
    try {
        console.log("Admin Request: getPendingKycUsers initiate");
        const users = await prisma.usuario.findMany({
            where: {
                esta_verificado: false,
                dni_foto_url: { not: null },
                selfie_url: { not: null }
            },
            select: {
                id: true,
                correo: true,
                nombre_completo: true,
                createdAt: true,
                dni_foto_url: true,
                selfie_url: true
            }
        });

        console.log(`Admin Request: found ${users.length} pending users`);
        res.json({
            count: users.length,
            solicitudes: users
        });
    } catch (error) {
        console.error("CRITICAL ERROR in getPendingKycUsers:", error);
        next(error);
    }
}

/**
 * User Profile
 * Usado para refrescar los datos del usuario en el frontend
 */
const getUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await prisma.usuario.findUnique({
            where: { id: userId },
            select: {
                id: true,
                correo: true,
                nombre_completo: true,
                esta_verificado: true,
                modo_actual: true,
                url_foto_perfil: true,
                dni_foto_url: true,
                selfie_url: true,
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    uploadKyc,
    getUserKyc,
    approveUser,
    login,
    googleSignIn,
    getUserProfile,
    getPendingKycUsers
};
