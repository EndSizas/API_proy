import express from 'express';
import cors from 'cors';
import usuarioRoutes from './routes/usuarioRoutes.js';
import animalRoutes from './routes/animalRoutes.js';
import seguimientoRoutes from './routes/seguimientoRoutes.js';
import comentarioRoutes from './routes/comentarioRoutes.js';
import historialRoutes from './routes/historialRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Definir el módulo de ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const corsOptions = {
  origin: 'http://localhost:8100',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json()); // Para que interprete los objetos JSON
app.use(express.urlencoded({ extended: true })); // Se añade para poder receptar formularios

// Ya no necesitas esta línea porque no estás usando la carpeta 'uploads':
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/animales', animalRoutes);
app.use('/api/seguimientos', seguimientoRoutes);
app.use('/api/comentarios', comentarioRoutes);
app.use('/api/historial', historialRoutes);

// Middleware para rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    message: 'Endpoint not found',
  });
});

export default app;
