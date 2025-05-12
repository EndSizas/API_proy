import express from 'express';
import { getReportedAnimals,takeCase, updateCaseStatus, getOrganizationCases,getCaseDetails,uploadAnimalImages} from '../controladores/seguimientoCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Animales reportados sin asignar (público)
router.get('/animales/reportados', getReportedAnimals);

// Rutas protegidas (solo para organizaciones)
router.post('/:id/caso', verifyToken, takeCase);
router.put('/:id/estado', verifyToken, updateCaseStatus);
router.get('/organizacion', verifyToken, getOrganizationCases);

// Detalles de caso (protegido, para organizaciones o reportante)
router.get('/caso/:id', verifyToken, getCaseDetails);

// Subida de imágenes (protegido)
router.post('/:id/imagenes', verifyToken, uploadAnimalImages);

export default router;