import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {readConfig} from '../server/config.js';
import {assertSeedEnvironment} from './seed/data.js';

try{
 const local=parseEnv(await readFile(new URL('../.env.seed.local',import.meta.url),'utf8'));
 if(local.DB_NAME!=='pasteleria_dev'||local.NODE_ENV!=='development')throw new Error('La configuración de demostración debe apuntar a pasteleria_dev en desarrollo.');
 Object.assign(process.env,local);
 assertSeedEnvironment(readConfig(),process.env);
 await import('../server/index.js');
}catch(error){console.error(error.code==='ENOENT'?'Falta la configuración local .env.seed.local de la demostración.':error.message);process.exitCode=1;}
