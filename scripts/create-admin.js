import { readConfig, createPool, checkSchema, configurationError } from '../server/config.js';
import { createRepository } from '../server/repository.js';
import { validateRegistration } from '../server/validation.js';
import { hashPassword } from '../server/passwords.js';
import { ask, askSecret } from './prompt.js';

let pool;
try {
  pool = createPool(readConfig());
  await checkSchema(pool);
  const nombre = await ask('Nombre del administrador: ');
  const correo = await ask('Correo del administrador: ');
  const contrasena = await askSecret('Contraseña (12 a 25 caracteres): ');
  const confirmacion = await askSecret('Confirma la contraseña: ');
  const data = validateRegistration({ nombre, correo, contrasena, confirmacion }, {requireContact:false});
  await createRepository(pool).createInitialAdmin({ nombre: data.nombre, correo: data.correo, contrasena_hash: await hashPassword(data.contrasena) });
  console.log('Administrador inicial creado. Ya puedes iniciar sesión con la cuenta que elegiste.');
} catch (error) { console.error(configurationError(error)); process.exitCode = 1; }
finally { if (pool) await pool.end(); }
