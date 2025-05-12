import { conmysql } from '../db.js';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configurar Cloudinary
cloudinary.config({
    cloud_name: 'dqxjdfncz',  // Reemplaza con tu Cloud Name
    api_key: '972776657996249',        // Reemplaza con tu API Key
    api_secret: '5F2PB9yT5_xycNG_vKyegoOoMc8'   // Reemplaza con tu API Secret
});
// Configuración de Multer para subir imágenes
const storage = multer.memoryStorage();  // Para almacenar en memoria antes de enviar a Cloudinary
const upload = multer({ storage: storage }).array('imagenes[]'); // 'imagenes[]' es la clave de los campos
export { upload };


// Reportar un nuevo animal
export const reportAnimal = async (req, res) => {
    let {
        tipo, otro_tipo,
        estado_salud, otra_salud,
        raza, color, tamano, descripcion,
        latitud, longitud, direccion_aproximada
    } = req.body;

    const userId = req.user.id;

    // Reemplazar con lo personalizado si eligió "otro"
    if (tipo === 'otro' && otro_tipo) tipo = otro_tipo;
    if (estado_salud === 'otro' && otra_salud) estado_salud = otra_salud;

    try {
        const [animalResult] = await conmysql.query(
            'INSERT INTO animales (id_usuario_reporta, tipo, raza, color, tamano, estado_salud, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, tipo, raza, color, tamano, estado_salud, descripcion]
        );

        const animalId = animalResult.insertId;

        // 2. Insertar ubicación
        await conmysql.query(
            'INSERT INTO ubicaciones (id_animal, latitud, longitud, direccion_aproximada) VALUES (?, ?, ?, ?)',
            [animalId, parseFloat(latitud), parseFloat(longitud), direccion_aproximada]
        );

         // 3. Subir imágenes a Cloudinary si existen
         const imagenesSubidas = [];

         if (req.files && req.files.length > 0) {
             for (const [index, imagen] of req.files.entries()) {
                 const uploadResult = await new Promise((resolve, reject) => {
                     const uploadStream = cloudinary.uploader.upload_stream(
                         {
                             folder: 'animales_reportados', // Cambia si prefieres otra carpeta
                             resource_type: 'auto',
                         },
                         (error, result) => {
                             if (error) return reject(error);
                             resolve(result);
                         }
                     );
                     uploadStream.end(imagen.buffer);
                 });
 
                 console.log('Imagen subida exitosamente:', uploadResult.secure_url);
                 imagenesSubidas.push(uploadResult.secure_url);
 
                 // Guardar en base de datos
                 await conmysql.query(
                     'INSERT INTO imagenes_animales (id_animal, url_imagen, es_principal) VALUES (?, ?, ?)',
                     [animalId, uploadResult.secure_url, index === 0] // Primera imagen es principal
                 );
             }
         }

        // 4. Registrar estado inicial en historial
        await conmysql.query(
            'INSERT INTO historial_estados (id_animal, id_usuario, estado) VALUES (?, ?, ?)',
            [animalId, userId, 'reportado']
        );

        res.status(201).json({ message: 'Animal reportado exitosamente', id: animalId });
    } catch (error) {
        console.error('Error en reportAnimal:', error);
        res.status(500).json({ message: 'Error al reportar animal', error: error.message });
    }
};


// Obtener todos los animales reportados (con filtros)
export const getAnimals = async (req, res) => {
    const { tipo, estado, ubicacion, radio } = req.query;

    try {
        let query = `
            SELECT a.*, u.latitud, u.longitud, u.direccion_aproximada, 
                   sc.estado_actual as estado_seguimiento, 
                   (SELECT url_imagen FROM imagenes_animales WHERE id_animal = a.id_animal AND es_principal = 1 LIMIT 1) as imagen_principal
            FROM animales a
            LEFT JOIN (
                SELECT id_animal, latitud, longitud, direccion_aproximada 
                FROM ubicaciones 
                WHERE (id_animal, fecha_ubicacion) IN (
                    SELECT id_animal, MAX(fecha_ubicacion) 
                    FROM ubicaciones 
                    GROUP BY id_animal
                )
            ) u ON a.id_animal = u.id_animal
            LEFT JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            WHERE 1=1
        `;

        const params = [];

        // Aplicar filtros
        if (tipo) {
            query += ' AND a.tipo = ?';
            params.push(tipo);
        }
        if (estado) {
            query += ' AND sc.estado_actual = ?';
            params.push(estado);
        }

        const [animals] = await conmysql.query(query, params);

        // Filtrar por ubicación si se proporciona
        let filteredAnimals = animals;
        if (ubicacion && radio) {
            const [lat, lng] = ubicacion.split(',').map(Number);
            filteredAnimals = animals.filter(animal => {
                const distance = calculateDistance(lat, lng, animal.latitud, animal.longitud);
                return distance <= radio;
            });
        }

        res.json(filteredAnimals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener animales' });
    }
};

// Función auxiliar para calcular distancia entre coordenadas
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distancia en km
}

// Obtener detalles de un animal específico
export const getAnimalDetails = async (req, res) => {
    const animalId = req.params.id;

    try {
        // Obtener información básica del animal
        const [animals] = await conmysql.query('SELECT * FROM animales WHERE id_animal = ?', [animalId]);
        if (animals.length === 0) {
            return res.status(404).json({ message: 'Animal no encontrado' });
        }

        const animal = animals[0];

        // Obtener ubicación más reciente
        const [locations] = await conmysql.query(
            'SELECT * FROM ubicaciones WHERE id_animal = ? ORDER BY fecha_ubicacion DESC LIMIT 1',
            [animalId]
        );

        // Obtener todas las imágenes
        const [images] = await conmysql.query(
            'SELECT * FROM imagenes_animales WHERE id_animal = ? ORDER BY es_principal DESC',
            [animalId]
        );

        // Obtener estado actual si está en seguimiento
        const [tracking] = await conmysql.query(
            'SELECT * FROM seguimiento_casos WHERE id_animal = ?',
            [animalId]
        );

        // Obtener información del usuario que reportó
        const [users] = await conmysql.query(
            'SELECT id_usuario, nombre, tipo_usuario FROM usuarios WHERE id_usuario = ?',
            [animal.id_usuario_reporta]
        );

        res.json({
            ...animal,
            ubicacion: locations[0] || null,
            imagenes: images,
            seguimiento: tracking[0] || null,
            usuario_reporta: users[0] || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener detalles del animal' });
    }
};

// Actualizar ubicación de un animal
export const updateAnimalLocation = async (req, res) => {
    const animalId = req.params.id;
    const { latitud, longitud, direccion_aproximada } = req.body;

    try {
        await conmysql.query(
            'INSERT INTO ubicaciones (id_animal, latitud, longitud, direccion_aproximada) VALUES (?, ?, ?, ?)',
            [animalId, latitud, longitud, direccion_aproximada]
        );

        res.json({ message: 'Ubicación actualizada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar ubicación' });
    }
};


// Añadir imágenes para un animal
export const addAnimalImages = async (req, res) => {
    const animalId = req.params.id;

    // Verificar si se han subido imágenes para animales
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No se han subido imágenes para el animal." });
    }

    try {
        const imagenesSubidas = []; // Array para guardar las URLs de las imágenes subidas

        console.log('Archivos recibidos para el animal:', req.files); // Verifica que los archivos se estén recibiendo correctamente

        for (const imagen of req.files) {
            // Subir cada archivo buffer a Cloudinary
            const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'animales_reportados', // El folder donde se almacenará la imagen
                        resource_type: 'auto', // Detectar el tipo automáticamente (puede ser una imagen, vídeo, etc.)
                    },
                    (error, result) => {
                        if (error) {
                            console.error("Error al subir imagen:", error);
                            return reject(error); // Si ocurre un error, lo rechazamos
                        }
                        console.log("Imagen subida con éxito:", result); // Verifica el resultado de la subida
                        resolve(result); // Si todo va bien, resolvemos con el resultado
                    }
                );
                uploadStream.end(imagen.buffer); // Enviamos el buffer de la imagen
            });

            // Guardar la URL de la imagen en la base de datos para el animal
            await conmysql.query(
                'INSERT INTO imagenes_animales (id_animal, url_imagen) VALUES (?, ?)',
                [animalId, uploadResult.secure_url]
            );

            // Añadir la URL de la imagen a la lista
            imagenesSubidas.push(uploadResult.secure_url);
        }

        res.json({ message: 'Imágenes para el animal agregadas exitosamente', imagenes: imagenesSubidas });
    } catch (error) {
        console.error("Error al agregar imágenes del animal:", error);
        res.status(500).json({ message: 'Error al agregar imágenes del animal', error: error.message });
    }
};



