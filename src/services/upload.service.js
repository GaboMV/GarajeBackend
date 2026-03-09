const supabase = require('../config/supabase');
const path = require('path');
const crypto = require('crypto');

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'garajes';

/**
 * Sube un archivo a Supabase Storage
 * @param {Object} file Objeto de archivo provisto por multer
 * @param {String} folder Carpeta destino (ej: 'fotos')
 * @returns {Promise<String>} URL del archivo subido
 */
const uploadFile = async (file, folder = 'general') => {
    if (!file) return null;

    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${crypto.randomUUID()}${fileExtension}`;

    // Subir a Supabase
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false // no sobreescribir
        });

    if (error) {
        throw new Error(`Error subiendo archivo a Supabase: ${error.message}`);
    }

    // Obtener URL Pública de la imagen subida
    const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    return publicData.publicUrl;
};

/**
 * Elimina un archivo de Supabase Storage
 * @param {String} fileUrl URL completa del archivo público
 */
const deleteFile = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        // Extraer el Key desde la URL pública
        // Ejemplo: https://xyz.supabase.co/storage/v1/object/public/garajes/fotos/123.jpg
        // Queremos "fotos/123.jpg" si el bucket es "garajes"

        const urlParts = fileUrl.split(`/public/${BUCKET_NAME}/`);
        if (urlParts.length !== 2) return; // No es una URL válida

        const filePath = urlParts[1];

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.error("Error al eliminar archivo de Supabase:", error.message);
        }
    } catch (error) {
        console.error("Excepción en deleteFile:", error);
    }
}

module.exports = {
    uploadFile,
    deleteFile
};
