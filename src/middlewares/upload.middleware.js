const multer = require('multer');

// Usamos almacenamiento en memoria para procesar el buffer y enviarlo a R2 sin guardarlo en disco
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Filtro para aceptar únicamente imágenes
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato de archivo no soportado. Solo se permiten imágenes.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // Límite de 5MB por archivo
    },
    fileFilter: fileFilter
});

module.exports = upload;
