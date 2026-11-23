import test from 'node:test';
import assert from 'node:assert/strict';
import {context,login,csrf} from './helpers.js';

const services=()=>({
 management:{read:async(actor,recurso)=>recurso==='clientes'?{items:[{id:actor.id_usuario}],total:1}:undefined,write:async(actor,accion,datos)=>accion==='guardarCliente'?{operador:actor.id_usuario,nombre:datos.nombre}:undefined},
 commerce:{read:async(actor,recurso)=>recurso==='resumen'?{rol:actor.rol}:undefined,write:async()=>undefined}
});
test('operation endpoints require session and protect all writes with CSRF',async t=>{
 const {agent}=await context(t,{operations:services()});
 await agent.get('/api/operacion?recurso=resumen').expect(401);
 await login(agent,'admin@example.test');
 await agent.post('/api/operacion').send({accion:'guardarCliente',datos:{nombre:'Ana'}}).expect(403);
 const response=await agent.get('/api/operacion?recurso=resumen').expect(200);
 assert.equal(response.body.datos.rol,'Administrador');
});
test('operation actor always comes from the authenticated account',async t=>{
 const {agent}=await context(t,{operations:services()});const token=await login(agent,'cliente@example.test');
 const response=await agent.post('/api/operacion').set('X-CSRF-Token',token).send({accion:'guardarCliente',datos:{nombre:'Ana'},actor:{id_usuario:101,rol:'Administrador'},clave:'0123456789abcdef'}).expect(200);
 assert.equal(response.body.datos.operador,102);
 await agent.get('/api/operacion?recurso=archivoPrivado').expect(404);
 await agent.get('/api/operacion?recurso=clientes&buscar[x]=mal').expect(400);
 const freshToken=await csrf(agent);
 await agent.post('/api/operacion').set('X-CSRF-Token',freshToken).send({accion:'guardarCliente',datos:[]}).expect(400);
});
