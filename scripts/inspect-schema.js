// Read-only metadata inspection. No application rows, passwords or connection secrets.
import {writeFile,mkdir} from 'node:fs/promises';
import {readConfig,createPool,configurationError} from '../server/config.js';
let pool;
try{
 pool=createPool(readConfig());
 const queries={
  tables:"SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME",
  columns:"SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_KEY,EXTRA,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
  keys:"SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,ORDINAL_POSITION,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION",
  checks:"SELECT t.TABLE_NAME,c.CONSTRAINT_NAME,c.CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON t.CONSTRAINT_SCHEMA=c.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME=c.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA=DATABASE() ORDER BY t.TABLE_NAME,c.CONSTRAINT_NAME",
  references:"SELECT TABLE_NAME,CONSTRAINT_NAME,UPDATE_RULE,DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME"
 };
 const result={};for(const [name,query] of Object.entries(queries))result[name]=(await pool.query(query))[0];
 const directory=new URL('../docs/database/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('schema-inspected.json',directory),JSON.stringify(result,null,2),'utf8');
 console.log('Esquema inspeccionado en modo de solo lectura: '+result.tables.length+' tablas, '+result.columns.length+' campos. Resultado: docs/database/schema-inspected.json');
}catch(error){console.error(configurationError(error));process.exitCode=1;}finally{if(pool)await pool.end();}
