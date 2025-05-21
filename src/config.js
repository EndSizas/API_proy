import { config } from 'dotenv'
config()

export const BD_HOST = process.env.BD_HOST || "bqmae0grsr8nx2sksvwk-mysql.services.clever-cloud.com";
export const BD_DATABASE = process.env.BD_DATABASE || "bqmae0grsr8nx2sksvwk";
export const DB_USER = process.env.DB_USER || "uocdeptssztnhmoq";
export const DB_PASSWORD = process.env.DB_PASSWORD || "ONVAXdfAqKVRp1f91X09";
export const DB_PORT = process.env.DB_PORT || 3306;
export const PORT = process.env.PORT || 3000;
export const JWT_SECRET = process.env.JWT_SECRET || "proyecto123";
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dqxjdfncz";
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "972776657996249";
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "5F2PB9yT5_xycNG_vKyegoOoMc8";
export const CLOUDINARY_FOLDER = 'animales_reportados';
export const CLOUDINARY_FOLDER_PERFILES = 'usuarios_perfiles'; // Para las imágenes de perfil
export const CLOUDINARY_FOLDER_ANIMALES = 'animales_reportados'; // Para las imágenes de animales


