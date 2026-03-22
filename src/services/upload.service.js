const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');

// Inicializar cliente S3 para Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_PUBLIC = process.env.R2_BUCKET_PUBLIC || 'garajes-public';
const BUCKET_PRIVATE = process.env.R2_BUCKET_PRIVATE || 'garajes-kyc';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // Solo para garajes

/**
 * 1. Subida a bucket PÚBLICO (Garajes)
 * Retorna URL completa accesible por todos.
 */
const uploadFilePublic = async (file, folder = 'general') => {
    if (!file) return null;

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${crypto.randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_PUBLIC,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3Client.send(command);

    // Limpiar R2_PUBLIC_URL de posibles barras diagonales al final
    const publicUrlBase = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/+$/, '') : null;

    if (publicUrlBase) {
        return `${publicUrlBase}/${fileName}`;
    }

    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_PUBLIC}/${fileName}`;
};

/**
 * 2. Subida a bucket PRIVADO (KYC - Carnets/Selfies)
 * Retorna solo la KEY del objeto, ya que no hay URL pública.
 */
const uploadFilePrivate = async (file, folder = 'general') => {
    if (!file) return null;

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${crypto.randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_PRIVATE,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3Client.send(command);

    // Guardamos solo el ID (key) en la BD, no una URL completa.
    return fileName;
};

/**
 * 3. Obtener URL Firmada del bucket privado (Expira en 5 minutos)
 * Esto lo usará el controlador cuando el Admin quiera ver los documentos KYC.
 */
const getDynamicPresignedUrl = async (key) => {
    if (!key) return null;

    // Generar URL firmada solo lectura para la app o el panel Admin
    const command = new GetObjectCommand({
        Bucket: BUCKET_PRIVATE,
        Key: key,
    });

    // 300 segundos = 5 minutos de validez
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return signedUrl;
};

/**
 * 4. Eliminar archivo (Bucket Público, usado en Garajes)
 */
const deleteFilePublic = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        let keyText = fileUrl;
        if (R2_PUBLIC_URL && fileUrl.startsWith(R2_PUBLIC_URL)) {
            keyText = fileUrl.replace(`${R2_PUBLIC_URL}/`, '');
        } else {
            const r2Host = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_PUBLIC}/`;
            if (fileUrl.startsWith(r2Host)) {
                keyText = fileUrl.replace(r2Host, '');
            }
        }

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_PUBLIC,
            Key: keyText,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error("Error al eliminar el archivo de R2 Público:", error);
    }
}

/**
 * 5. Generar URL pre-firmada para SUBIDA de adjunto del Chat al bucket PRIVADO
 * El cliente hace PUT con esta URL directo a R2 PRIVADO (sin URL pública permanente).
 * Luego guarda la KEY (no la URL) y la usa para pedir acceso temporal.
 */
const getPresignedUploadUrl = async (fileName, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_PRIVATE,  // ← PRIVADO, igual que el KYC
        Key: fileName,
        ContentType: contentType,
    });

    // La URL de subida expira en 5 minutos
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Solo retornamos la KEY del objeto, no una URL pública permanente
    // Para leer la imagen después se genera una Presigned GET URL con getPresignedChatUrl
    return { uploadUrl, key: fileName };
};

/**
 * 6. Generar URL de LECTURA temporal para un adjunto privado del Chat (5 minutos)
 * Idéntico al flujo de KYC. Solo el dueño/vendedor de la reserva puede pedirla.
 */
const getPresignedChatUrl = async (key) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_PRIVATE,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 300 });
};

/**
 * 7. Eliminar archivo PRIVADO (Usado al borrar garaje o cancelar KYC)
 */
const deleteFilePrivate = async (key) => {
    try {
        if (!key) return;

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_PRIVATE,
            Key: key,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error("Error al eliminar el archivo de R2 Privado:", error);
    }
}

module.exports = {
    uploadFilePublic,
    uploadFilePrivate,
    getDynamicPresignedUrl,
    deleteFilePublic,
    deleteFilePrivate,
    getPresignedUploadUrl,
    getPresignedChatUrl
};
