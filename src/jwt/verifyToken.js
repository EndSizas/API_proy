import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js'; // Asegúrate de que la variable JWT_SECRET esté definida en tu archivo de configuración

export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']; // Obtiene el token del encabezado de autorización
    if (!token) return res.status(403).send({ message: 'Token no proporcionado' }); // Si no hay token, devuelve un error

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send({ message: 'Token no válido' }); // Si el token no es válido, devuelve un error
        //req.userId = decoded.id; // Guarda el ID del usuario en la solicitud
        //req.user = decoded.id; // Guarda el ID del usuario en la solicitud
        req.user = { id: decoded.id }; // Asegúrate de que aquí esté el ID del usuario
        console.log('Usuario autenticado:', req.user); // Depuración
        console.log('Contenido del token decodificado:', decoded);
        next(); // Continúa con el siguiente middleware o ruta
    });
};
