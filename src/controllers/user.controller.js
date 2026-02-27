// Using Prisma directly
const prisma = require('../db/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

        res.status(201).json({
            message: 'Usuario registrado exitosamente. Requiere verificación KYC.',
            token,
            user: newUser
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
        // Obtenemos el usuario autenticado desde el middleware
        const userId = req.user.id;

        // Simulación: recibimos las URLs (en el mundo real se suben con Multer a S3 o localmente)
        const { dni_foto_url, selfie_url } = req.body;

        if (!dni_foto_url || !selfie_url) {
            return res.status(400).json({ error: 'Debes proveer las URLs para DNI y Selfie' });
        }

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

/**
 * Admin: Approve User Verification
 * Un admin revisa las fotos y aprueba al usuario
 */
const approveUser = async (req, res, next) => {
    try {
        // Asuminos que la ruta tiene middleware que comprueba si req.user es Admin
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

        const token = jwt.sign({ id: user.id, correo: user.correo }, JWT_SECRET, {
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

module.exports = {
    register,
    uploadKyc,
    approveUser,
    login
};
