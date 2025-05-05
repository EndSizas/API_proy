import multer from 'multer';

// Configuración de Multer para almacenar archivos en memoria
const storage = multer.memoryStorage();

// Filtro para aceptar solo imágenes PNG y JPEG
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PNG o JPEG'), false);
    }
};

// Exportar el middleware correctamente
const upload = multer({ storage, fileFilter }).array('imagenes[]');
export { upload };
