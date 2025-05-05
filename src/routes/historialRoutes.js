import express from 'express';
import { 
    getAnimalHistory, 
    getOrganizationHistory, 
    getCitizenHistory 
} from '../controladores/historialCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Rutas protegidas
router.get('/animal/:id', verifyToken, getAnimalHistory);
router.get('/organizacion', verifyToken, getOrganizationHistory);
router.get('/tipousuario', verifyToken, getCitizenHistory);

export default router;