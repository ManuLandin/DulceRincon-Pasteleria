import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readConfig,createPool,configurationError} from '../server/config.js';
import {assertSeedEnvironment} from './seed/data.js';
import {runSeed} from './seed/engine.js';

export async function main(args=process.argv.slice(2),env=process.env){
 const action=args[0]||'seed';if(args.length>1||!['seed','verify','undo'].includes(action))throw new Error('Uso: node scripts/seed.js [seed|verify|undo]');
 const config=readConfig(env);assertSeedEnvironment(config,env);
 const pool=createPool(config);
 try{const result=await runSeed({pool,config,env,action});console.log(JSON.stringify(result,null,2));}
 finally{await pool.end();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(configurationError(error));process.exitCode=1;});
