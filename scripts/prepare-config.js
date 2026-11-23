import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

try {
  const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  await writeFile(new URL('../.env', import.meta.url), template.replace('GENERAR_CON_NPM_RUN_CONFIGURAR', randomBytes(48).toString('hex')), { flag: 'wx', mode: 0o600 });
  console.log('Archivo .env creado con secreto de sesión generado. Abre .env y sustituye CONFIGURAR_LOCALMENTE por tu contraseña de MySQL.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('Ya existe .env; se conserva sin cambios.');
  else { console.error('No se pudo preparar .env. Revisa los permisos de esta carpeta.'); process.exitCode = 1; }
}
