// SOLO QA: repositorio temporal en memoria. Nunca conecta a la BD del usuario.
import { context } from './helpers.js';
const cleanup=[];
const {app}=await context({after:fn=>cleanup.push(fn)});
const server=app.listen(3001,'127.0.0.1',()=>console.log('QA aislado, sin MySQL: http://127.0.0.1:3001'));
const stop=()=>server.close(async()=>{for(const fn of cleanup)await fn();process.exit(0);});
process.once('SIGINT',stop);process.once('SIGTERM',stop);
