// Exportación de solo lectura. Importar únicamente en una base vacía.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { readConfig, createPool } from '../server/config.js';

const config = readConfig();
if (config.production || config.database.database !== 'pasteleria_db' || !['localhost', '127.0.0.1'].includes(config.database.host)) {
  throw new Error('Esta exportación solo admite la base original local pasteleria_db.');
}
const pool = createPool(config);
let connection;
try {
  connection = await pool.getConnection();
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
  const [records] = await connection.query('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE']);
  const names = records.map(record => Object.values(record)[0]);
  if (names.some(name => !/^[a-z0-9_]+$/i.test(name)) || new Set(names.map(name => name.toUpperCase())).size !== names.length) {
    throw new Error('Nombres de tablas no admitidos.');
  }
  const quote = name => '`' + name + '`';
  const [foreignKeys] = await connection.execute(
    'SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'
  );
  const ordered = [], pending = new Set(names);
  while (pending.size) {
    const ready = [...pending].filter(name => foreignKeys.every(fk => fk.TABLE_NAME !== name || fk.REFERENCED_TABLE_NAME === name || ordered.includes(fk.REFERENCED_TABLE_NAME)));
    if (!ready.length) throw new Error('Hay dependencias circulares: revisar antes de exportar.');
    for (const name of ready) { ordered.push(name); pending.delete(name); }
  }
  const sql = [
    '-- Dulce Rincón: copia privada para importar UNA VEZ en una base VACÍA.',
    '-- Contiene cuentas y datos privados. No publicar ni subir como archivo web.',
    '-- No crea ni selecciona bases, no elimina tablas y no desactiva claves foráneas.',
    'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
    "SET time_zone='-06:00';",
    "SET SESSION sql_mode='NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';"
  ];
  const counts = {};
  for (const name of ordered) {
    const [definition] = await connection.query('SHOW CREATE TABLE ' + quote(name));
    let ddl = definition[0]['Create Table'];
    for (const table of names) ddl = ddl.replaceAll(quote(table), quote(table.toUpperCase()));
    sql.push(ddl + ';');
    const [columns] = await connection.query('SHOW COLUMNS FROM ' + quote(name));
    const writable = columns.filter(column => !/(?:VIRTUAL|STORED) GENERATED/i.test(String(column.Extra))).map(column => column.Field);
    // Las cookies locales no deben funcionar como sesiones en el alojamiento.
    const [rows] = name.toUpperCase() === 'SESION_WEB' ? [[]] : await connection.query('SELECT * FROM ' + quote(name));
    counts[name.toUpperCase()] = rows.length;
    for (const row of rows) {
      const values = writable.map(column => {
        let value = row[column];
        if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) value = JSON.stringify(value);
        return mysql.escape(value);
      });
      sql.push('INSERT INTO ' + quote(name.toUpperCase()) + ' (' + writable.map(quote).join(',') + ') VALUES (' + values.join(',') + ');');
    }
  }
  await connection.commit();
  const directory = fileURLToPath(new URL('../backups/', import.meta.url));
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = directory + 'alwaysdata-importar-' + stamp + '.sql';
  const body = sql.join('\n') + '\n';
  if (/\b(?:DROP TABLE|CREATE DATABASE|USE `|FOREIGN_KEY_CHECKS)\b/i.test(sql.filter(line => !line.startsWith('INSERT') && !line.startsWith('--')).join('\n'))) throw new Error('Instrucción no permitida.');
  await writeFile(path, body, { encoding: 'utf8', flag: 'wx' });
  await writeFile(path + '.resumen.json', JSON.stringify({ created: new Date().toISOString(), tables: counts, bytes: Buffer.byteLength(body), sessionsExcluded: true }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ archivo: path, tablas: ordered.length, registros: Object.values(counts).reduce((a, b) => a + b, 0), bytes: Buffer.byteLength(body), sesionesExportadas: counts.SESION_WEB }));
} catch (error) {
  if (connection) await connection.rollback().catch(() => {});
  console.error('No se pudo exportar. Código: ' + (error.code || 'VALIDACION') + (error.code ? '' : ' ' + error.message));
  process.exitCode = 1;
} finally {
  connection?.release();
  await pool.end();
}
