import express from 'express';
import { reportAnimal, getAnimals, getAnimalDetails, updateAnimalLocation, addAnimalImages,getNoAssignedAnimals } from '../controladores/animalCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';
import { upload } from '../config/multer.js';


const router = express.Router();

// Rutas protegidas
router.post('/register', verifyToken, upload, reportAnimal);
router.get('/', getAnimals); // Pública para ver animales
router.get('/:id', getAnimalDetails); // Pública para ver detalles// Pública para ver detalles con ubicación
router.post('/:id/locacion', verifyToken, updateAnimalLocation);
router.post('/:id/imagenes', verifyToken, upload, addAnimalImages);
router.get('/no-asignados', getNoAssignedAnimals);

export default router;