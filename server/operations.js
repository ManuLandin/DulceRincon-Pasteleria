import {requireCsrf} from './auth.js';
import {AppError} from './errors.js';

export function mountOperations(app,services,guards,writeLimit){
 const available=[services.management,services.commerce,services.communications].filter(Boolean);
 app.get('/api/operacion',guards.requireUser,async(req,res)=>{
  for(const [key,value] of Object.entries(req.query))if(!/^[a-z_]+$/i.test(key)||typeof value!=='string'||value.length>200)throw new AppError(400,'Los filtros contienen datos inválidos.');
  if(typeof req.query.recurso!=='string'||!req.query.recurso)throw new AppError(400,'Indica la sección que deseas consultar.');
  for(const service of available){const datos=await service.read(req.user,req.query.recurso,req.query);if(datos!==undefined)return res.json({datos});}
  throw new AppError(404,'No se encontró esta sección.');
 });
 app.post('/api/operacion',guards.requireUser,requireCsrf,(req,res,next)=>['prepararVenta','prepararPedido'].includes(req.body?.accion)?next():writeLimit(req,res,next),async(req,res)=>{
  const {accion,datos,clave}=req.body||{};
  if(typeof accion!=='string'||!/^[a-zA-Z]{1,64}$/.test(accion)||!datos||typeof datos!=='object'||Array.isArray(datos))throw new AppError(400,'Revisa los datos del formulario.');
  for(const service of available){const result=await service.write(req.user,accion,datos,clave);if(result!==undefined)return res.json({datos:result});}
  throw new AppError(404,'No se encontró esta operación.');
 });
}
