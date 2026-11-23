import { readConfig, createPool, checkSchema, configurationError } from '../server/config.js';
let pool;
try {
  pool = createPool(readConfig());
  const schema = await checkSchema(pool, { migrated: false });
  if (!schema.imagen) await pool.execute('ALTER TABLE PRODUCTO ADD COLUMN imagen VARCHAR(255) NULL');
  await pool.execute('CREATE TABLE IF NOT EXISTS SESION_WEB (session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY, expires INT UNSIGNED NOT NULL, data MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, INDEX idx_sesion_expires (expires)) ENGINE=InnoDB');
  await checkSchema(pool);
  console.log('Migración completa: campo imagen y tabla SESION_WEB disponibles. No se eliminaron productos ni usuarios.');
} catch (error) { console.error(configurationError(error)); process.exitCode = 1; }
finally { if (pool) await pool.end(); }
