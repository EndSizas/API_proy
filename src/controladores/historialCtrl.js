import { conmysql } from '../db.js';

// Obtener historial de un animal
export const getAnimalHistory = async (req, res) => {
    const animalId = req.params.id;

    try {
        const [history] = await conmysql.query(`
            SELECT h.*, u.nombre as usuario_nombre, u.tipo_usuario
            FROM historial_estados h
            JOIN usuarios u ON h.id_usuario = u.id_usuario
            WHERE h.id_animal = ?
            ORDER BY h.fecha_cambio DESC
        `, [animalId]);

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener historial del animal' });
    }
};

// Obtener historial de casos gestionados por una organización
export const getOrganizationHistory = async (req, res) => {
    const organizationId = req.user.id;

    try {
        const [history] = await conmysql.query(`
            SELECT h.*, a.tipo, a.raza, a.color, u.nombre as usuario_nombre
            FROM historial_estados h
            JOIN animales a ON h.id_animal = a.id_animal
            JOIN usuarios u ON h.id_usuario = u.id_usuario
            WHERE h.id_usuario = ? OR h.id_animal IN (
                SELECT id_animal FROM seguimiento_casos WHERE id_organizacion = ?
            )
            ORDER BY h.fecha_cambio DESC
        `, [organizationId, organizationId]);

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener historial de la organización' });
    }
};

// Obtener historial de reportes de un ciudadano
export const getCitizenHistory = async (req, res) => {
    const citizenId = req.user.id;

    try {
        const [history] = await conmysql.query(`
            SELECT h.*, a.tipo, a.raza, a.color, u.nombre as usuario_nombre, u.tipo_usuario
            FROM historial_estados h
            JOIN animales a ON h.id_animal = a.id_animal
            JOIN usuarios u ON h.id_usuario = u.id_usuario
            WHERE a.id_usuario_reporta = ?
            ORDER BY h.fecha_cambio DESC
        `, [citizenId]);

        res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener historial del ciudadano' });
    }
};