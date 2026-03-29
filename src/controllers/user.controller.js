const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { uploadFilePrivate, getDynamicPresignedUrl } = require('../services/upload.service');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_garajes_dev_123';

/**
 * Registra un nuevo Usuario en la base de datos.
 * El usuario se crea con estado "NO_VERIFICADO" y modo "VENDEDOR".
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const register = async (req, res, next) => {
    try {
        const { correo, password, nombre_completo } = req.body;

        if (!correo || !password) {
            logger.warn('UserController', 'Intento de registro sin credenciales completas.');
            return res.status(400).json({ error: 'Correo y password son requeridos' });
        }

        const existingUser = await prisma.usuario.findUnique({ where: { correo } });
        if (existingUser) {
            logger.warn('UserController', `Intento de registro con correo ya existente: ${correo}`);
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.usuario.create({
            data: {
                correo,
                password: hashedPassword,
                nombre_completo: nombre_completo || null,
                esta_verificado: "NO_VERIFICADO",
                modo_actual: "VENDEDOR"
            }
        });

        const token = jwt.sign({ id: newUser.id, correo: newUser.correo }, JWT_SECRET, {
            expiresIn: '7d'
        });

        logger.info('UserController', `Usuario registrado exitosamente: ${newUser.id}`);

        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            token,
            user: {
                id: newUser.id,
                correo: newUser.correo,
                nombre_completo: newUser.nombre_completo,
                esta_verificado: newUser.esta_verificado,
                modo_actual: newUser.modo_actual
            }
        });
    } catch (error) {
        logger.error('UserController', 'Error en el proceso de registro.', error);
        next(error);
    }
}

/**
 * Carga de documentos de verificación de identidad (KYC).
 * Actualiza el estado del usuario a "PENDIENTE" de validación manual.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const uploadKyc = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { telefono } = req.body;

        if (!req.files || !req.files.dni_foto || !req.files.selfie) {
            logger.warn('UserController', `Faltan documentos KYC en la petición del usuario: ${userId}`);
            return res.status(400).json({ error: 'Debes subir ambas fotos: dni_foto y selfie' });
        }

        if (!telefono) {
            return res.status(400).json({ error: 'El número de teléfono es obligatorio.' });
        }

        const telefonoLimpio = telefono.replace(/\s+/g, '');
        if (!/^[67]\d{7}$/.test(telefonoLimpio)) {
            logger.warn('UserController', `Número de teléfono inválido proporcionado por el usuario: ${userId}`);
            return res.status(400).json({ error: 'Número de teléfono inválido para Bolivia (debe empezar con 6 o 7 y tener 8 dígitos).' });
        }

        const fileDni = req.files.dni_foto[0];
        const fileSelfie = req.files.selfie[0];

        const dni_foto_url = await uploadFilePrivate(fileDni, 'kyc');
        const selfie_url = await uploadFilePrivate(fileSelfie, 'kyc');

        const updatedUser = await prisma.usuario.update({
            where: { id: userId },
            data: {
                dni_foto_url,
                selfie_url,
                telefono: telefonoLimpio,
                esta_verificado: "PENDIENTE"
            }
        });

        logger.info('UserController', `Archivos KYC subidos correctamente para el usuario: ${userId}`);

        res.json({
            message: 'Documentos KYC subidos correctamente. Esperando validación del administrador.',
            user: updatedUser
        });

    } catch (error) {
        logger.error('UserController', 'Error al procesar la carga de documentos KYC.', error);
        next(error);
    }
}

/**
 * Genera y retorna URLs firmadas de manera dinámica para la visualización administrativa de documentos KYC.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getUserKyc = async (req, res, next) => {
    try {
        const { idUsuario } = req.params;
        const user = await prisma.usuario.findUnique({ where: { id: idUsuario } });

        if (!user) {
            logger.warn('UserController', `Intento de acceso a KYC de un usuario inexistente: ${idUsuario}`);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (!user.dni_foto_url && !user.selfie_url) {
            return res.status(400).json({ error: 'El usuario no tiene documentos KYC almacenados.' });
        }

        const dniUrl = await getDynamicPresignedUrl(user.dni_foto_url);
        const selfieUrl = await getDynamicPresignedUrl(user.selfie_url);

        logger.info('UserController', `URLs temporales de KYC generadas para el usuario: ${idUsuario}`);

        res.json({
            usuario: user.correo,
            telefono: user.telefono || 'Sin registro',
            estado: user.esta_verificado === "VERIFICADO" ? 'Aprobado' : 'Pendiente',
            documentos_temporales_5min: {
                dni_frontal: dniUrl,
                selfie: selfieUrl
            }
        });
    } catch (error) {
        logger.error('UserController', 'Error al consultar documentos KYC.', error);
        next(error);
    }
}

/**
 * Aprobación administrativa del proceso de validación KYC del usuario.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const approveUser = async (req, res, next) => {
    try {
        const { idUsuario } = req.params;

        const user = await prisma.usuario.findUnique({ where: { id: idUsuario } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (user.esta_verificado === "VERIFICADO") {
            return res.status(400).json({ error: 'El usuario ya ha sido verificado anteriormente.' });
        }

        const approvedUser = await prisma.usuario.update({
            where: { id: idUsuario },
            data: { 
                esta_verificado: "VERIFICADO",
                motivo_rechazo_kyc: null
            }
        });

        const io = req.app.get('socketio');
        if (io) {
            io.to(idUsuario).emit('kyc_approved', {
                message: 'Su proceso de verificación ha sido aprobado exitosamente.',
                userId: idUsuario
            });
        }
        
        await prisma.notificacion.create({
            data: {
                id_usuario: idUsuario,
                titulo: 'Verificación KYC Aprobada',
                cuerpo: 'Su proceso de verificación ha sido aprobado exitosamente. Proceda a gestionar espacios.'
            }
        });

        logger.info('UserController', `Usuario aprobado por el administrador: ${idUsuario}`);

        res.json({
            message: 'Usuario verificado exitosamente.',
            user: approvedUser
        });
    } catch (error) {
        logger.error('UserController', 'Error al ejecutar la aprobación del usuario.', error);
        next(error);
    }
}

/**
 * Autenticación mediante credenciales locales.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const login = async (req, res, next) => {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({ error: 'Debe especificar correo y contraseña.' });
        }

        const user = await prisma.usuario.findUnique({ where: { correo } });
        if (!user) {
            logger.warn('UserController', `Intento de acceso fallido para correo no registrado: ${correo}`);
            return res.status(401).json({ error: 'Credenciales de acceso inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.warn('UserController', `Intento de acceso fallido, contraseña incorrecta: ${correo}`);
            return res.status(401).json({ error: 'Credenciales de acceso inválidas.' });
        }

        const token = jwt.sign({ id: user.id, correo: user.correo, es_admin: user.es_admin }, JWT_SECRET, {
            expiresIn: '7d'
        });

        logger.info('UserController', `Autenticación exitosa (Login Local): ${user.id}`);

        res.json({
            message: 'Autenticación exitosa',
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
        logger.error('UserController', 'Error en el proceso de inicio de sesión local.', error);
        next(error);
    }
}

const fetch = require('node-fetch');

/**
 * Autenticación de usuarios vía Google Sign-In mediante la integración del API REST o ID Token.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const googleSignIn = async (req, res, next) => {
    try {
        const { idToken, accessToken } = req.body;

        if (!idToken && !accessToken) {
            return res.status(400).json({ error: 'Es necesario proporcionar un Token de Autenticación de Google.' });
        }

        let email, name, google_uid;

        if (idToken) {
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
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error('Validación de la autenticidad del AccessToken fallida.');
            }

            const data = await response.json();
            email = data.email;
            name = data.name;
            google_uid = data.sub;
        }

        if (!email) {
            return res.status(400).json({ error: 'No se pudo extraer la dirección de correo electrónico del perfil.' });
        }

        let user = await prisma.usuario.findUnique({ where: { correo: email } });

        if (!user) {
            user = await prisma.usuario.create({
                data: {
                    correo: email,
                    password: `google_oauth_${google_uid}`,
                    nombre_completo: name || null,
                    esta_verificado: "NO_VERIFICADO",
                    modo_actual: 'VENDEDOR'
                }
            });
            logger.info('UserController', `Nuevo usuario registrado vía Google Auth: ${user.id}`);
        } else {
            logger.info('UserController', `Autenticación exitosa (Google Auth): ${user.id}`);
        }

        const token = jwt.sign({ id: user.id, correo: user.correo, es_admin: user.es_admin }, JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            message: 'Autenticación con Google completada adecuadamente.',
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
        logger.error('UserController', 'Fallo general durante la validación del proveedor OAuth (Google).', error);
        return res.status(401).json({ error: 'El Token de integridad delegada ha caducado o es improcedente.' });
    }
};

/**
 * Rechazo administrativo del proceso de validación KYC del usuario, especificando el motivo.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const rejectUser = async (req, res, next) => {
    try {
        const { idUsuario } = req.params;
        const { motivo } = req.body;

        if (!motivo) {
            return res.status(400).json({ error: 'Es requisito primordial indicar el motivo del rechazo funcional.' });
        }

        const rejectedUser = await prisma.usuario.update({
            where: { id: idUsuario },
            data: { 
                esta_verificado: "RECHAZADO",
                motivo_rechazo_kyc: motivo
            }
        });

        logger.info('UserController', `Proceso de verificación rechazado por parte del área de auditoría para el usuario: ${idUsuario}`);

        res.json({ message: 'Estatus del usuario actualizado estructuralmente a "Rechazado".', user: rejectedUser });
    } catch (error) {
        logger.error('UserController', 'Error durante el procedimiento de rechazo de identidad.', error);
        next(error);
    }
}

/**
 * Obtener listado de usuarios cuyo proceso de verificación se encuentra pendiente o con observaciones (rechazados).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getPendingKycUsers = async (req, res, next) => {
    try {
        const users = await prisma.usuario.findMany({
            where: {
                esta_verificado: { in: ["PENDIENTE", "RECHAZADO"] }
            },
            select: {
                id: true,
                correo: true,
                nombre_completo: true,
                fecha_creacion: true,
                dni_foto_url: true,
                selfie_url: true,
                esta_verificado: true,
                motivo_rechazo_kyc: true
            }
        });

        logger.info('UserController', `Consulta administrativa de registros observados. Total encontrados: ${users.length}`);

        res.json({ count: users.length, users });
    } catch (error) {
        logger.error('UserController', 'Error originado en la extracción de listas jerárquicas observadas.', error);
        next(error);
    }
}

/**
 * Obtención de metadatos actualizados del perfil del usuario cliente.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
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
                motivo_rechazo_kyc: true,
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'No existen registros asociados a esta cuenta en particular.' });
        }

        res.json({ user });
    } catch (error) {
        logger.error('UserController', 'Fallo al solicitar información modular del perfil.', error);
        next(error);
    }
}

module.exports = {
    register,
    uploadKyc,
    getUserKyc,
    approveUser,
    rejectUser,
    login,
    googleSignIn,
    getUserProfile,
    getPendingKycUsers
};
