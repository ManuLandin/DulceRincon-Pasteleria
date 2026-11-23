import {readFile} from 'node:fs/promises';
import mysql from 'mysql2/promise';
import {readConfig,createPool} from '../server/config.js';

export async function mysqlFixture(){
 const config=readConfig();
 const name='dulcerincon_test_'+Date.now()+'_'+process.pid;
 if(!/^dulcerincon_test_\d+_\d+$/.test(name))throw new Error('Nombre de prueba inválido');
 const admin=await mysql.createConnection({...config.database,database:undefined,dateStrings:true});
 let created=false; let pool;
 try{
  await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');created=true;
  pool=createPool({...config,database:{...config.database,database:name}});
  const sql=await readFile(new URL('./fixtures/original-schema.sql',import.meta.url),'utf8');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(statement);
  await pool.query('ALTER TABLE PRODUCTO ADD COLUMN imagen VARCHAR(255) NULL');
  await pool.query('CREATE TABLE SESION_WEB(session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PRIMARY KEY,expires INT UNSIGNED NOT NULL,data MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,INDEX(expires)) ENGINE=InnoDB');
  return {pool,name,close:async()=>{await pool.end();if(created)await admin.query('DROP DATABASE `'+name+'`');await admin.end();}};
 }catch(error){if(pool)await pool.end();if(created)await admin.query('DROP DATABASE `'+name+'`');await admin.end();throw error;}
}
