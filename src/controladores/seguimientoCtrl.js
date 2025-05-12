import { conmysql } from '../db.js';
import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_FOLDER } from '../config.js';

// Configuración de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Función auxiliar para subir imágenes a Cloudinary
const uploadAnimalImage = async (filePathOrBase64, idAnimal) => {
    const result = await cloudinary.uploader.upload(filePathOrBase64, {
        folder: `${CLOUDINARY_FOLDER}/animales_reportados`,
        public_id: `animal_${idAnimal}_${Date.now()}`, // Nombre único
        overwrite: false,
        transformation: [{ width: 800, height: 800, crop: "limit" }],
    });
    return result.secure_url;
};

// Asumir responsabilidad de un caso (organización)
export const takeCase = async (req, res) => {
    const animalId = req.params.id;
    const userId = req.user.id;
    const { observaciones } = req.body;

    try {
        // Verificar que el usuario es una organización
        const [users] = await conmysql.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [userId]);
        if (users.length === 0 || users[0].tipo_usuario !== 'organizacion') {
            return res.status(403).json({ message: 'Solo las organizaciones pueden tomar casos' });
        }

        // Verificar que el animal existe
        const [animals] = await conmysql.query('SELECT * FROM animales WHERE id_animal = ?', [animalId]);
        if (animals.length === 0) {
            return res.status(404).json({ message: 'Animal no encontrado' });
        }

        // Verificar que el caso no está ya asignado
        const [existingCase] = await conmysql.query('SELECT * FROM seguimiento_casos WHERE id_animal = ?', [animalId]);
        if (existingCase.length > 0) {
            return res.status(400).json({ message: 'Este caso ya está siendo seguido por otra organización' });
        }

        // Asignar caso a la organización con el estado inicial 'reportado'
        await conmysql.query(
            'INSERT INTO seguimiento_casos (id_animal, id_organizacion, estado_actual, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, 'reportado', observaciones]
        );

        // Registrar en el historial el primer cambio de estado: 'reportado'
        await conmysql.query(
            'INSERT INTO historial_estados (id_animal, id_usuario, estado, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, 'reportado', observaciones]
        );

        res.json({ message: 'Caso asignado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al asignar caso' });
    }
};


// Actualizar estado de un caso
export const updateCaseStatus = async (req, res) => {
    const animalId = req.params.id;
    const userId = req.user.id;
    const { estado, observaciones } = req.body;

    try {
        // Verificar que el usuario es la organización a cargo del caso
        const [cases] = await conmysql.query(
            'SELECT * FROM seguimiento_casos WHERE id_animal = ? AND id_organizacion = ?',
            [animalId, userId]
        );
        if (cases.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para actualizar este caso' });
        }

        // Normalizar estado (eliminar espacios, convertir a minúsculas, reemplazar espacios por guiones bajos)
        const estadoNormalizado = estado?.trim().toLowerCase().replace(/\s+/g, '_');

        // Verificar que el nuevo estado sea uno de los estados permitidos
        const estadosPermitidos = [
            'reportado',
            'en_revision',
            'rescatado',
            'en_tratamiento',
            'en_adopcion',
            'adoptado',
            'fallecido'
        ];
        if (!estadoNormalizado || !estadosPermitidos.includes(estadoNormalizado)) {
            return res.status(400).json({ message: 'Estado no válido' });
        }

        // Actualizar estado en seguimiento_casos
        await conmysql.query(
            'UPDATE seguimiento_casos SET estado_actual = ?, observaciones = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_animal = ?',
            [estadoNormalizado, observaciones, animalId]
        );

        // Registrar el cambio de estado en historial_estados
        await conmysql.query(
            'INSERT INTO historial_estados (id_animal, id_usuario, estado, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, estadoNormalizado, observaciones]
        );

        res.json({ message: 'Estado del caso actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar estado del caso' });
    }
};


// Obtener casos asignados a una organización - Versión corregida
export const getOrganizationCases = async (req, res) => {
    const userId = req.user.id; // El ID viene del token JWT
    const { estado } = req.query;

    try {
        // Verificar que el usuario es una organización
        const [users] = await conmysql.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [userId]);
        if (users.length === 0 || users[0].tipo_usuario !== 'organizacion') {
            return res.status(403).json({ message: 'Acceso no autorizado' });
        }

        let query = `
            SELECT 
                a.*, 
                sc.estado_actual, 
                sc.observaciones as observaciones_seguimiento,
                sc.fecha_actualizacion,
                (SELECT url_imagen FROM imagenes_animales WHERE id_animal = a.id_animal AND es_principal = 1 LIMIT 1) as imagen_principal,
                (SELECT latitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as latitud,
                (SELECT longitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as longitud,
                (SELECT nombre FROM usuarios WHERE id_usuario = a.id_usuario_reporta) as nombre_reportante
            FROM animales a
            JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            WHERE sc.id_organizacion = ?
        `;

        const params = [userId];

        if (estado) {
            query += ' AND sc.estado_actual = ?';
            params.push(estado);
        }

        query += ' ORDER BY sc.fecha_actualizacion DESC';

        const [cases] = await conmysql.query(query, params);
        res.json(cases);
    } catch (error) {
        console.error('Error en getOrganizationCases:', error);
        res.status(500).json({ 
            message: 'Error al obtener casos',
            error: error.message 
        });
    }
};

// Nueva función (opcional) para subir varias imágenes de un animal
export const uploadAnimalImages = async (req, res) => {
    const animalId = req.params.id;
    const { images } = req.body; // Esto puede ser un array de imágenes en base64 o URLs temporales

    if (!images || images.length === 0) {
        return res.status(400).json({ message: 'No se enviaron imágenes' });
    }

    try {
        const uploadPromises = images.map(async (image, index) => {
            const imageUrl = await uploadAnimalImage(image, animalId);
            await conmysql.query(
                'INSERT INTO imagenes_animales (id_animal, url_imagen, es_principal) VALUES (?, ?, ?)',
                [animalId, imageUrl, index === 0 ? 1 : 0] // La primera imagen subida es la principal
            );
        });

        await Promise.all(uploadPromises);

        res.json({ message: 'Imágenes subidas exitosamente' });
    } catch (error) {
        console.error('Error al subir imágenes:', error);
        res.status(500).json({ message: 'Error al subir imágenes' });
    }
};
