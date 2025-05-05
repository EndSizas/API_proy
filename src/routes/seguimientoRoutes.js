import express from 'express';
import { 
    takeCase, 
    updateCaseStatus, 
    getOrganizationCases 
} from '../controladores/seguimientoCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Rutas protegidas (solo para organizaciones)
router.post('/:id/caso', verifyToken, takeCase);
router.put('/:id/estado', verifyToken, updateCaseStatus);
router.get('/organizacion', verifyToken, getOrganizationCases);

export default router;