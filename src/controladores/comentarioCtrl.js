import { conmysql } from '../db.js';

// Agregar comentario a un animal
export const addComment = async (req, res) => {
    const animalId = req.params.id;
    const userId = req.user.id;
    const { comentario } = req.body;

    try {
        // Verificar que el animal existe
        const [animals] = await conmysql.query('SELECT * FROM animales WHERE id_animal = ?', [animalId]);
        if (animals.length === 0) {
            return res.status(404).json({ message: 'Animal no encontrado' });
        }

        // Insertar comentario
        const [result] = await conmysql.query(
            'INSERT INTO comentarios (id_animal, id_usuario, comentario) VALUES (?, ?, ?)',
            [animalId, userId, comentario]
        );

        res.status(201).json({ 
            message: 'Comentario agregado exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al agregar comentario' });
    }
};

// Responder a un comentario (solo organizaciones)
export const replyToComment = async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.id;
    const { respuesta } = req.body;

    try {
        // Verificar que el usuario es una organización
        const [users] = await conmysql.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [userId]);
        if (users.length === 0 || users[0].tipo_usuario !== 'organizacion') {
            return res.status(403).json({ message: 'Solo las organizaciones pueden responder comentarios' });
        }

        // Verificar que el comentario existe
        const [comments] = await conmysql.query('SELECT * FROM comentarios WHERE id_comentario = ?', [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ message: 'Comentario no encontrado' });
        }

        // Actualizar respuesta
        await conmysql.query(
            'UPDATE comentarios SET respuesta_organizacion = ?, fecha_respuesta = CURRENT_TIMESTAMP WHERE id_comentario = ?',
            [respuesta, commentId]
        );

        res.json({ message: 'Respuesta agregada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al responder al comentario' });
    }
};

// Obtener comentarios de un animal
export const getAnimalComments = async (req, res) => {
    const animalId = req.params.id;

    try {
        const [comments] = await conmysql.query(`
            SELECT c.*, u.nombre as usuario_nombre, u.tipo_usuario,
                   (SELECT nombre FROM usuarios WHERE id_usuario = (
                       SELECT id_organizacion FROM seguimiento_casos WHERE id_animal = c.id_animal
                   )) as organizacion_nombre
            FROM comentarios c
            JOIN usuarios u ON c.id_usuario = u.id_usuario
            WHERE c.id_animal = ?
            ORDER BY c.fecha_comentario DESC
        `, [animalId]);

        res.json(comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener comentarios' });
    }
};