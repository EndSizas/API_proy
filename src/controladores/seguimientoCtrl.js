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
        public_id: `animal_${idAnimal}_${Date.now()}`,
        overwrite: false,
        transformation: [{ width: 800, height: 800, crop: "limit" }],
    });
    return result.secure_url;
};

// Obtener animales reportados sin asignar
export const getReportedAnimals = async (req, res) => {
    try {
        const query = `
            SELECT a.*, 
                   (SELECT url_imagen FROM imagenes_animales WHERE id_animal = a.id_animal AND es_principal = 1 LIMIT 1) as imagen_principal,
                   (SELECT latitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as latitud,
                   (SELECT longitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as longitud,
                   (SELECT nombre FROM usuarios WHERE id_usuario = a.id_usuario_reporta) as nombre_reportante
            FROM animales a
            LEFT JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            WHERE sc.id_animal IS NULL
            ORDER BY a.fecha_reporte DESC
        `;

        const [animals] = await conmysql.query(query);
        res.json(animals);
    } catch (error) {
        console.error('Error al obtener animales reportados:', error);
        res.status(500).json({ message: 'Error al obtener animales reportados' });
    }
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
            return res.status(400).json({ 
                message: 'Este caso ya está siendo seguido por otra organización',
                organizacion: existingCase[0].id_organizacion
            });
        }

        // Asignar caso a la organización con estado inicial 'en_revision'
        await conmysql.query(
            'INSERT INTO seguimiento_casos (id_animal, id_organizacion, estado_actual, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, 'en_revision', observaciones]
        );

        // Registrar en el historial
        await conmysql.query(
            'INSERT INTO historial_estados (id_animal, id_usuario, estado, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, 'en_revision', observaciones]
        );

        // Obtener detalles completos del caso asignado
        const [newCase] = await conmysql.query(`
            SELECT a.*, sc.*, 
                   (SELECT nombre FROM usuarios WHERE id_usuario = ?) as nombre_organizacion
            FROM animales a
            JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            WHERE a.id_animal = ?
        `, [userId, animalId]);

        res.json({
            message: 'Caso asignado exitosamente',
            caso: newCase[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: 'Error al asignar caso',
            error: error.message
        });
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
            return res.status(403).json({ 
                message: 'No tienes permiso para actualizar este caso',
                detalles: 'Solo la organización asignada puede actualizar el estado'
            });
        }

        // Normalizar estado
        const estadoNormalizado = estado?.trim().toLowerCase().replace(/\s+/g, '_');
        const estadosPermitidos = [
            'reportado', 'en_revision', 'rescatado', 
            'en_tratamiento', 'en_adopcion', 'adoptado', 'fallecido'
        ];

        if (!estadoNormalizado || !estadosPermitidos.includes(estadoNormalizado)) {
            return res.status(400).json({ 
                message: 'Estado no válido',
                estados_permitidos: estadosPermitidos
            });
        }

        // Validar transiciones de estado
        const estadoActual = cases[0].estado_actual;
        if (estadoActual === 'fallecido' || estadoActual === 'adoptado') {
            return res.status(400).json({ 
                message: 'No se puede modificar un caso finalizado',
                estado_actual: estadoActual
            });
        }

        // Actualizar estado
        await conmysql.query(
            'UPDATE seguimiento_casos SET estado_actual = ?, observaciones = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_animal = ?',
            [estadoNormalizado, observaciones, animalId]
        );

        // Registrar en historial
        await conmysql.query(
            'INSERT INTO historial_estados (id_animal, id_usuario, estado, observaciones) VALUES (?, ?, ?, ?)',
            [animalId, userId, estadoNormalizado, observaciones]
        );

        // Obtener caso actualizado
        const [updatedCase] = await conmysql.query(`
            SELECT a.*, sc.*, 
                   (SELECT nombre FROM usuarios WHERE id_usuario = ?) as nombre_organizacion
            FROM animales a
            JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            WHERE a.id_animal = ?
        `, [userId, animalId]);

        res.json({
            message: 'Estado del caso actualizado exitosamente',
            caso: updatedCase[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: 'Error al actualizar estado del caso',
            error: error.message
        });
    }
};

// Obtener casos asignados a una organización
export const getOrganizationCases = async (req, res) => {
    const userId = req.user.id;
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

// Obtener detalles de un caso específico
export const getCaseDetails = async (req, res) => {
    const caseId = req.params.id;
    const userId = req.user.id;

    try {
        const [caseData] = await conmysql.query(`
            SELECT 
                a.*, 
                sc.*,
                u.nombre as nombre_organizacion,
                ur.nombre as nombre_reportante,
                (SELECT url_imagen FROM imagenes_animales WHERE id_animal = a.id_animal AND es_principal = 1 LIMIT 1) as imagen_principal,
                (SELECT GROUP_CONCAT(url_imagen) FROM imagenes_animales WHERE id_animal = a.id_animal) as imagenes,
                (SELECT latitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as latitud,
                (SELECT longitud FROM ubicaciones WHERE id_animal = a.id_animal ORDER BY fecha_ubicacion DESC LIMIT 1) as longitud
            FROM animales a
            JOIN seguimiento_casos sc ON a.id_animal = sc.id_animal
            JOIN usuarios u ON sc.id_organizacion = u.id_usuario
            JOIN usuarios ur ON a.id_usuario_reporta = ur.id_usuario
            WHERE sc.id_animal = ?
        `, [caseId]);

        if (caseData.length === 0) {
            return res.status(404).json({ message: 'Caso no encontrado' });
        }

        // Verificar permisos (solo organización asignada o el reportante)
        const caso = caseData[0];
        if (caso.id_organizacion !== userId && caso.id_usuario_reporta !== userId) {
            return res.status(403).json({ message: 'No autorizado para ver este caso' });
        }

        // Obtener historial
        const [historial] = await conmysql.query(`
            SELECT h.*, u.nombre as usuario_nombre
            FROM historial_estados h
            JOIN usuarios u ON h.id_usuario = u.id_usuario
            WHERE h.id_animal = ?
            ORDER BY h.fecha_cambio DESC
        `, [caseId]);

        // Obtener comentarios
        const [comentarios] = await conmysql.query(`
            SELECT c.*, u.nombre as usuario_nombre, u.tipo_usuario
            FROM comentarios c
            JOIN usuarios u ON c.id_usuario = u.id_usuario
            WHERE c.id_animal = ?
            ORDER BY c.fecha_comentario DESC
        `, [caseId]);

        res.json({
            ...caso,
            imagenes: caso.imagenes ? caso.imagenes.split(',') : [],
            historial,
            comentarios
        });
    } catch (error) {
        console.error('Error en getCaseDetails:', error);
        res.status(500).json({ 
            message: 'Error al obtener detalles del caso',
            error: error.message
        });
    }
};

// Subir imágenes de un animal
export const uploadAnimalImages = async (req, res) => {
    const animalId = req.params.id;
    const { images } = req.body;

    if (!images || images.length === 0) {
        return res.status(400).json({ message: 'No se enviaron imágenes' });
    }

    try {
        // Verificar que el animal existe
        const [animal] = await conmysql.query('SELECT * FROM animales WHERE id_animal = ?', [animalId]);
        if (animal.length === 0) {
            return res.status(404).json({ message: 'Animal no encontrado' });
        }

        const uploadPromises = images.map(async (image, index) => {
            const imageUrl = await uploadAnimalImage(image, animalId);
            await conmysql.query(
                'INSERT INTO imagenes_animales (id_animal, url_imagen, es_principal) VALUES (?, ?, ?)',
                [animalId, imageUrl, index === 0 ? 1 : 0]
            );
        });

        await Promise.all(uploadPromises);

        res.json({ message: 'Imágenes subidas exitosamente' });
    } catch (error) {
        console.error('Error al subir imágenes:', error);
        res.status(500).json({ 
            message: 'Error al subir imágenes',
            error: error.message
        });
    }
};