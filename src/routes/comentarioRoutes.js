import express from 'express';
import { 
    addComment, 
    replyToComment, 
    getAnimalComments 
} from '../controladores/comentarioCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';

const router = express.Router();

// Rutas públicas
router.get('/animal/:id', getAnimalComments);

// Rutas protegidas
router.post('/animal/:id', verifyToken, addComment);
router.post('/:id/reply', verifyToken, replyToComment);

export default router;