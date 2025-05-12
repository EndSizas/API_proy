import express from 'express';
import { 
  takeCase, 
  updateCaseStatus, 
  getOrganizationCases 
} from '../controladores/seguimientoCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Ruta corregida para obtener casos de organización
router.get('/organizacion', verifyToken, getOrganizationCases);

// Resto de rutas permanecen igual
router.post('/:id/caso', verifyToken, takeCase);
router.put('/:id/estado', verifyToken, updateCaseStatus);

export default router;