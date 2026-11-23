import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import mysql from 'mysql2/promise';
import {readConfig,createPool,configurationError} from '../server/config.js';

export async function backupDatabase(pool,directory=fileURLToPath(new URL('../backups/',import.meta.url))){
 const connection=await pool.getConnection();
 try{
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const [tables]=await connection.query('SHOW FULL TABLES WHERE Table_type = ?', ['BASE TABLE']);
  const sql=['-- Respaldo local Dulce Rincón. Contiene datos privados; no compartir.','SET FOREIGN_KEY_CHECKS=0;'];
  for(const record of tables){
   const name=Object.values(record)[0];if(!/^[a-z0-9_]+$/i.test(name))throw new Error('Nombre de tabla no admitido para respaldo.');
   const quoted='`'+name+'`';
   const [definition]=await connection.query('SHOW CREATE TABLE '+quoted);
   sql.push('DROP TABLE IF EXISTS '+quoted+';',definition[0]['Create Table']+';');
   const [columns]=await connection.query('SHOW COLUMNS FROM '+quoted);
   const writable=columns.filter(c=>!/(?:VIRTUAL|STORED) GENERATED/i.test(String(c.Extra))).map(c=>c.Field);
   const [rows]=await connection.query('SELECT * FROM '+quoted);
   for(const row of rows)sql.push('INSERT INTO '+quoted+' ('+writable.map(c=>'`'+c+'`').join(',')+') VALUES ('+writable.map(c=>mysql.escape(row[c]!==null&&typeof row[c]==='object'&&!Buffer.isBuffer(row[c])?JSON.stringify(row[c]):row[c])).join(',')+');');
  }
  sql.push('SET FOREIGN_KEY_CHECKS=1;');
  await connection.commit();await mkdir(directory,{recursive:true});
  const path=join(directory,'antes-operacion-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql');
  await writeFile(path,sql.join('\n'),{encoding:'utf8',flag:'wx'});return path;
 }catch(error){await connection.rollback().catch(()=>{});throw error;}
 finally{connection.release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let pool;try{pool=createPool(readConfig());console.log('Respaldo guardado: '+await backupDatabase(pool));}catch(error){console.error(configurationError(error));process.exitCode=1;}finally{if(pool)await pool.end();}
}
