import { conmysql } from '../db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import bcrypt from 'bcryptjs';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';


// Configurar Cloudinary
cloudinary.config({
    cloud_name: 'dqxjdfncz',  // Reemplaza con tu Cloud Name
    api_key: '972776657996249',        // Reemplaza con tu API Key
    api_secret: '5F2PB9yT5_xycNG_vKyegoOoMc8'   // Reemplaza con tu API Secret
});
// Configuración de Multer para subir imágenes
const storage = multer.memoryStorage();  // Para almacenar en memoria antes de enviar a Cloudinary
const upload = multer({ storage: storage }).array('imagenes[]'); // 'imagenes[]' es la clave de los campos
export { upload };


// Registrar nuevo usuario con imagen
export const registerUser = async (req, res) => {
    const { tipo_usuario, nombre, email, contrasena, telefono, direccion } = req.body;
  
    try {
      // 1. Verificar si el email ya existe
      const [existingUser] = await conmysql.query('SELECT * FROM usuarios WHERE email = ?', [email]);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: 'El email ya está registrado' });
      }
  
      // 2. Hash de la contraseña
      const hashedPassword = await bcrypt.hash(contrasena, 10);
  
      // 3. Insertar usuario en la base de datos
      const [result] = await conmysql.query(
        'INSERT INTO usuarios (tipo_usuario, nombre, email, contrasena, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)',
        [tipo_usuario, nombre, email, hashedPassword, telefono, direccion]
      );
  
      const userId = result.insertId;
  
      // Variable para guardar las URLs de imágenes subidas (opcional)
      let imagenesSubidas = [];
  
      // 4. Verificar si se han subido imágenes
      if (req.files && req.files.length > 0) {
        try {
          for (const imagen of req.files) {
            // Subimos cada imagen a Cloudinary
            const uploadResult = await new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  folder: 'usuarios_perfiles', // Guardar en carpeta general usuarios_perfiles
                  resource_type: 'auto',
                },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result);
                }
              );
              uploadStream.end(imagen.buffer);
            });
  
            console.log('Imagen subida exitosamente:', uploadResult.secure_url);
            imagenesSubidas.push(uploadResult.secure_url);
  
            // Si quisieras guardar la imagen aparte (por ejemplo en otra tabla), aquí podrías hacer otra inserción.
            // await conmysql.query('INSERT INTO imagenes_usuarios (id_usuario, url_imagen) VALUES (?, ?)', [userId, uploadResult.secure_url]);
          }
        } catch (error) {
          console.error('Error al subir imagenes:', error);
          return res.status(500).json({ message: 'Error al subir imagenes a Cloudinary.' });
        }
      }
  
      // 5. Manejo de perfiles según tipo_usuario
      if (tipo_usuario === 'ciudadano') {
        const { fecha_nacimiento, genero, ocupacion, biografia, red_social } = req.body;
        const fotoPerfilUrl = imagenesSubidas.length > 0 ? imagenesSubidas[0] : null;
  
        // Insertar perfil de ciudadano
        await conmysql.query(
          'INSERT INTO perfiles_ciudadanos (id_usuario, fecha_nacimiento, genero, ocupacion, biografia, red_social, foto_perfil) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, fecha_nacimiento, genero, ocupacion, biografia, red_social, fotoPerfilUrl]
        );
  
      } else if (tipo_usuario === 'organizacion') {
        const { representante, mision, vision, sitio_web, redes_sociales, fecha_fundacion } = req.body;
        const logoUrl = imagenesSubidas.length > 0 ? imagenesSubidas[0] : null;
  
        // Insertar perfil de organización
        await conmysql.query(
          'INSERT INTO perfiles_organizaciones (id_usuario, logo_organizacion, representante, mision, vision, sitio_web, redes_sociales, fecha_fundacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, logoUrl, representante, mision, vision, sitio_web, redes_sociales, fecha_fundacion]
        );
      }
      
  
      res.status(201).json({ 
        message: 'Usuario registrado exitosamente', 
        id: userId,
        imagenes: imagenesSubidas // Opcional: enviar las URLs subidas para verificar
      });
  
    } catch (error) {
      console.error('Error en registerUser:', error);
      res.status(500).json({ 
        message: 'Error al registrar usuario',
        error: error.message 
      });
    }
  };
  
  // Iniciar sesión
  export const loginUser = async (req, res) => {
      const { email, contrasena } = req.body;

      try {
          const [users] = await conmysql.query('SELECT * FROM usuarios WHERE email = ?', [email]);
          if (users.length === 0) {
              return res.status(404).json({ message: 'Usuario no encontrado' });
          }

          const user = users[0];

          const isMatch = await bcrypt.compare(contrasena, user.contrasena);
          if (!isMatch) {
              return res.status(400).json({ message: 'Credenciales inválidas' });
          }

          const token = jwt.sign(
              { id: user.id_usuario, tipo: user.tipo_usuario },
              JWT_SECRET,
              { expiresIn: '24h' }
          );

          res.json({ 
              token,
              user: {
                  id_usuario: user.id_usuario,
                  tipo_usuario: user.tipo_usuario,
                  nombre: user.nombre,
                  email: user.email,    
              }
          });
      } catch (error) {
          console.error(error);
          res.status(500).json({ message: 'Error al iniciar sesión' });
      }
  };

// Obtener perfil de usuario
export const getUserProfile = async (req, res) => {
    const userId = req.params.id;

    try {
        const [users] = await conmysql.query('SELECT * FROM usuarios WHERE id_usuario = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const user = users[0];
        let profile = {};

        if (user.tipo_usuario === 'ciudadano') {
            const [profiles] = await conmysql.query('SELECT * FROM perfiles_ciudadanos WHERE id_usuario = ?', [userId]);
            profile = profiles[0] || {};
        } else if (user.tipo_usuario === 'organizacion') {
            const [profiles] = await conmysql.query('SELECT * FROM perfiles_organizaciones WHERE id_usuario = ?', [userId]);
            profile = profiles[0] || {};
        }

        res.json({
          user,
          perfil: profile
          }); 

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener perfil de usuario' });
    }
};

// Actualizar perfil de usuario
export const updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { nombre, telefono, direccion, ...profileData } = req.body;

    try {
        await conmysql.query(
            'UPDATE usuarios SET nombre = ?, telefono = ?, direccion = ? WHERE id_usuario = ?',
            [nombre, telefono, direccion, userId]
        );

        const [users] = await conmysql.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [userId]);
        const tipo_usuario = users[0].tipo_usuario;

        if (tipo_usuario === 'ciudadano') {
            let { fecha_nacimiento, genero, ocupacion, biografia, red_social, foto_perfil } = profileData;

            let fotoPerfilUrl = foto_perfil;
            if (foto_perfil && foto_perfil.startsWith('data:')) { // verificar si mandan nueva imagen
                const uploadedImage = await cloudinary.uploader.upload(foto_perfil, {
                    folder: 'usuarios_perfiles/ciudadanos'
                });
                fotoPerfilUrl = uploadedImage.secure_url;
            }

            await conmysql.query(
                'UPDATE perfiles_ciudadanos SET fecha_nacimiento = ?, genero = ?, ocupacion = ?, biografia = ?, red_social = ?, foto_perfil = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_usuario = ?',
                [fecha_nacimiento, genero, ocupacion, biografia, red_social, fotoPerfilUrl, userId]
            );
        } else if (tipo_usuario === 'organizacion') {
            let { logo_organizacion, representante, mision, vision, sitio_web, redes_sociales, fecha_fundacion } = profileData;

            let logoUrl = logo_organizacion;
            if (logo_organizacion && logo_organizacion.startsWith('data:')) {
                const uploadedLogo = await cloudinary.uploader.upload(logo_organizacion, {
                    folder: 'usuarios_perfiles/organizaciones'
                });
                logoUrl = uploadedLogo.secure_url;
            }

            await conmysql.query(
                'UPDATE perfiles_organizaciones SET logo_organizacion = ?, representante = ?, mision = ?, vision = ?, sitio_web = ?, redes_sociales = ?, fecha_fundacion = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_usuario = ?',
                [logoUrl, representante, mision, vision, sitio_web, redes_sociales, fecha_fundacion, userId]
            );
        }

        res.json({ message: 'Perfil actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar perfil' });
    }
};

// Actualización parcial del perfil de usuario (solo campos enviados)
export const updatePartialUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { nombre, telefono, direccion, ...profileData } = req.body;

    try {
        // Actualizar solo campos enviados del usuario
        if (nombre || telefono || direccion) {
            const camposUsuario = [];
            const valoresUsuario = [];

            if (nombre !== undefined) {
                camposUsuario.push('nombre = ?');
                valoresUsuario.push(nombre);
            }
            if (telefono !== undefined) {
                camposUsuario.push('telefono = ?');
                valoresUsuario.push(telefono);
            }
            if (direccion !== undefined) {
                camposUsuario.push('direccion = ?');
                valoresUsuario.push(direccion);
            }

            if (camposUsuario.length > 0) {
                await conmysql.query(
                    `UPDATE usuarios SET ${camposUsuario.join(', ')} WHERE id_usuario = ?`,
                    [...valoresUsuario, userId]
                );
            }
        }

        const [users] = await conmysql.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [userId]);
        const tipo_usuario = users[0].tipo_usuario;

        // Ciudadano
        if (tipo_usuario === 'ciudadano') {
            const camposCiudadano = [];
            const valoresCiudadano = [];

            for (const campo of ['fecha_nacimiento', 'genero', 'ocupacion', 'biografia', 'red_social']) {
                if (profileData[campo] !== undefined) {
                    camposCiudadano.push(`${campo} = ?`);
                    valoresCiudadano.push(profileData[campo]);
                }
            }

            if (profileData.foto_perfil && profileData.foto_perfil.startsWith('data:')) {
                const uploadedImage = await cloudinary.uploader.upload(profileData.foto_perfil, {
                    folder: 'usuarios_perfiles/ciudadanos',
                });
                camposCiudadano.push(`foto_perfil = ?`);
                valoresCiudadano.push(uploadedImage.secure_url);
            }

            if (camposCiudadano.length > 0) {
                camposCiudadano.push('fecha_actualizacion = CURRENT_TIMESTAMP');
                await conmysql.query(
                    `UPDATE perfiles_ciudadanos SET ${camposCiudadano.join(', ')} WHERE id_usuario = ?`,
                    [...valoresCiudadano, userId]
                );
            }
        }

        // Organización
        else if (tipo_usuario === 'organizacion') {
            const camposOrg = [];
            const valoresOrg = [];

            for (const campo of ['representante', 'mision', 'vision', 'sitio_web', 'redes_sociales', 'fecha_fundacion']) {
                if (profileData[campo] !== undefined) {
                    camposOrg.push(`${campo} = ?`);
                    valoresOrg.push(profileData[campo]);
                }
            }

            if (profileData.logo_organizacion && profileData.logo_organizacion.startsWith('data:')) {
                const uploadedLogo = await cloudinary.uploader.upload(profileData.logo_organizacion, {
                    folder: 'usuarios_perfiles/organizaciones',
                });
                camposOrg.push(`logo_organizacion = ?`);
                valoresOrg.push(uploadedLogo.secure_url);
            }

            if (camposOrg.length > 0) {
                camposOrg.push('fecha_actualizacion = CURRENT_TIMESTAMP');
                await conmysql.query(
                    `UPDATE perfiles_organizaciones SET ${camposOrg.join(', ')} WHERE id_usuario = ?`,
                    [...valoresOrg, userId]
                );
            }
        }

        res.json({ message: 'Perfil actualizado parcialmente con éxito' });
    } catch (error) {
        console.error('Error en actualización parcial:', error);
        res.status(500).json({ message: 'Error al actualizar perfil parcialmente' });
    }
};


// Eliminar usuario
export const deleteUser = async (req, res) => {
    const userId = req.params.id;
  
    try {
      const [user] = await conmysql.query('SELECT * FROM usuarios WHERE id_usuario = ?', [userId]);
      if (user.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
  
      if (user[0].tipo_usuario === 'ciudadano') {
        await conmysql.query('DELETE FROM perfiles_ciudadanos WHERE id_usuario = ?', [userId]);
      } else if (user[0].tipo_usuario === 'organizacion') {
        await conmysql.query('DELETE FROM perfiles_organizaciones WHERE id_usuario = ?', [userId]);
      }
  
      await conmysql.query('DELETE FROM usuarios WHERE id_usuario = ?', [userId]);
  
      // Reiniciar AUTO_INCREMENT de usuarios
      const [maxIdUsuario] = await conmysql.query('SELECT MAX(id_usuario) AS max_id FROM usuarios');
      const newAutoIncrementUsuario = maxIdUsuario[0].max_id ? maxIdUsuario[0].max_id + 1 : 1;
      await conmysql.query(`ALTER TABLE usuarios AUTO_INCREMENT = ${newAutoIncrementUsuario}`);
  
      // Reiniciar AUTO_INCREMENT de perfiles_ciudadanos
      const [maxIdPerfilCiudadano] = await conmysql.query('SELECT MAX(id_perfil_ciudadano) AS max_id FROM perfiles_ciudadanos');
      const newAutoIncrementPerfilCiudadano = maxIdPerfilCiudadano[0].max_id ? maxIdPerfilCiudadano[0].max_id + 1 : 1;
      await conmysql.query(`ALTER TABLE perfiles_ciudadanos AUTO_INCREMENT = ${newAutoIncrementPerfilCiudadano}`);
  
      // Reiniciar AUTO_INCREMENT de perfiles_organizaciones
      const [maxIdPerfilOrganizacion] = await conmysql.query('SELECT MAX(id_perfil_organizacion) AS max_id FROM perfiles_organizaciones');
      const newAutoIncrementPerfilOrganizacion = maxIdPerfilOrganizacion[0].max_id ? maxIdPerfilOrganizacion[0].max_id + 1 : 1;
      await conmysql.query(`ALTER TABLE perfiles_organizaciones AUTO_INCREMENT = ${newAutoIncrementPerfilOrganizacion}`);
  
      res.json({
        message: 'Usuario eliminado exitosamente',
        newAutoIncrementValues: {
          usuarios: newAutoIncrementUsuario,
          perfiles_ciudadanos: newAutoIncrementPerfilCiudadano,
          perfiles_organizaciones: newAutoIncrementPerfilOrganizacion
        }
      });
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({
        message: 'Error al eliminar usuario',
        error: error.message
      });
    }




  };
  