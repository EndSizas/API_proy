import express from 'express';
import { registerUser, loginUser, getUserProfile, updateUserProfile,deleteUser} from '../controladores/usuarioCtrl.js';
import { verifyToken } from '../jwt/verifyToken.js';
import { upload } from '../config/multer.js';
const router = express.Router();

// Rutas públicas
router.post('/register',upload, registerUser);
router.post('/login', loginUser);

// Rutas protegidas
router.get('/:id', verifyToken, getUserProfile);
router.put('/perfil', verifyToken, updateUserProfile);
router.delete('/:id', verifyToken, deleteUser);

export default router;