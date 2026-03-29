const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

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

/**
 * Ejecuta la transferencia de flujo de bytes orientados a buckets de dominio público (Public).
 * 
 * @param {Object} file - Estructura estandarizada Multer (File).
 * @param {string} folder - Estructura organizativa base (prefijo).
 * @returns {Promise<string|null>} Ruta URI absoluta del recurso expuesto públicamente.
 */
const uploadFilePublic = async (file, folder = 'general') => {
    if (!file) return null;

    const fileExtension = path.extname(file.originalname);
    const fileName = (folder === BUCKET_PUBLIC || folder === 'general') 
        ? `${crypto.randomUUID()}${fileExtension}`
        : `${folder}/${crypto.randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET_PUBLIC,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    try {
        await s3Client.send(command);
        
        const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-ea90bddb9761482cada6720de6b9e634.r2.dev';
        const publicUrlBase = R2_PUBLIC_URL.replace(/\/+$/, '');

        logger.info('UploadService', `Inyección de objeto público materializada satisfactoriamente. Key asociada: ${fileName}`);
        return `${publicUrlBase}/${fileName}`;
    } catch (error) {
        logger.error('UploadService', 'Inviabilidad de inyección binaria sobre R2 Público', error);
        throw error;
    }
};

/**
 * Traslada elementos probatorios al segmento privado y reservado de la integración S3 (Private).
 * 
 * @param {Object} file - Estructura estandarizada Multer (File).
 * @param {string} folder - Prefijo de clasificación interna.
 * @returns {Promise<string|null>} Referencia lógica privada (Key).
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

    try {
        await s3Client.send(command);
        logger.info('UploadService', `Archivado interno consumado en segmento privativo S3. Key asociada: ${fileName}`);
        return fileName;
    } catch (error) {
        logger.error('UploadService', 'Interrupción fatal en tránsito documental KYC haca el bucket cerrado', error);
        throw error;
    }
};

/**
 * Ensambla una URL firmada dinámicamente sobre la cual recae vigencia criptográfica limitada (5m).
 * Utilizado por paneles de supervisión administrativa.
 * 
 * @param {string} key - Identificador interno del objeto.
 * @returns {Promise<string|null>} Enlace presigned de disponibilidad acotada.
 */
const getDynamicPresignedUrl = async (key) => {
    if (!key) return null;

    const command = new GetObjectCommand({
        Bucket: BUCKET_PRIVATE,
        Key: key,
    });

    try {
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
        return signedUrl;
    } catch (error) {
        logger.error('UploadService', `Generación imposibilitada para firma asincrónica sobre clave S3: ${key}`, error);
        throw error;
    }
};

/**
 * Ejecuta destrucción lógica permanente de un objeto contenido en almacenamiento público.
 * 
 * @param {string} fileUrl - URI del objeto pasible de purga.
 */
const deleteFilePublic = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        let keyText = fileUrl;
        const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
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
        logger.info('UploadService', `Destrucción consumada en cuadrante público. Key borrada: ${keyText}`);
    } catch (error) {
        logger.error("UploadService", "Fallo inherente a la ordenanza de barrido sobre R2 Público", error);
    }
}

/**
 * Tramita un manifiesto (URL presigned) que reviste permisos asimétricos para la inyección (PUT) directa por parte del cliente.
 * 
 * @param {string} fileName - Disposición del archivo en bucket.
 * @param {string} contentType - Tipo nativo de contenido MIME.
 * @returns {Promise<Object>} URL y Key mapeada.
 */
const getPresignedUploadUrl = async (fileName, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_PRIVATE,
            Key: fileName,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        return { uploadUrl, key: fileName };
    } catch (error) {
        logger.error('UploadService', 'Fallo al despachar pasarela criptográfica POST hacia servidor S3 privativo', error);
        throw error;
    }
};

/**
 * Equivalente transaccional que faculta la extracción temporal restringida a un anexo de red virtual (Chat).
 * 
 * @param {string} key - Identificador interno del objeto privado.
 * @returns {Promise<string>} Enlace de recolección GET prefirmada.
 */
const getPresignedChatUrl = async (key) => {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_PRIVATE,
            Key: key,
        });
        return await getSignedUrl(s3Client, command, { expiresIn: 300 });
    } catch (error) {
        logger.error('UploadService', 'Falla de emisión para permiso eventual en nodo privado adjunto', error);
        throw error;
    }
};

/**
 * Instrucción de alta jerarquía ordenando el vaciado terminal de información contenida bajo llave privativa.
 * 
 * @param {string} key - Clave del elemento objeto de baja.
 */
const deleteFilePrivate = async (key) => {
    try {
        if (!key) return;

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_PRIVATE,
            Key: key,
        });

        await s3Client.send(command);
        logger.info('UploadService', `Liquidación total verificada bajo sector privado (KYC/Files). Key extinguida: ${key}`);
    } catch (error) {
        logger.error("UploadService", "Rechazo del protocolo de purgado confidencial (R2 Privado)", error);
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
