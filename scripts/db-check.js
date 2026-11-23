import { readConfig, createPool, checkSchema, configurationError } from '../server/config.js';
let pool;
try {
  pool = createPool(readConfig());
  const result = await checkSchema(pool, { migrated: false });
  console.log('Conexión a MySQL correcta. Tablas y roles del esquema verificados.');
  console.log(result.imagen && result.sesiones ? 'La migración está lista.' : 'Siguiente paso: npm run db:migrate.');
} catch (error) { console.error(configurationError(error)); process.exitCode = 1; }
finally { if (pool) await pool.end(); }
