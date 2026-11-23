import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../server/repository.js';

test('unfiltered public query accepts the normalized null category from the route',async()=>{
  const pool={execute:async sql=>[sql.includes('COUNT(')?[{total:0}]:[]]};
  const result=await createRepository(pool).productsPage({buscar:'',categoria:null,pagina:1,limite:12});
  assert.deepEqual(result,{rows:[],total:0});
});

test('search keeps SQL-looking text and wildcard characters as escaped parameter data',async()=>{
  const calls=[];
  const pool={execute:async(sql,params)=>{calls.push({sql,params});return [sql.includes('COUNT(')?[{total:0}]:[]];}};
  const repository=createRepository(pool);
  await repository.productsPage({buscar:"x%' OR 1=1 --_!",categoria:47,pagina:2,limite:12});
  assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.sql.includes('OR 1=1'),false);assert.ok(call.params.includes("%x!%' OR 1=1 --!_!!%"));assert.ok(call.params.includes(47));assert.match(call.sql,/p\.activo/);assert.match(call.sql,/c\.activo/);}
});
test('customer insertion resolves the Cliente role by name instead of trusting an ID',async()=>{
  let recorded;
  const pool={execute:async(sql,params)=>{recorded={sql,params};return [{insertId:88,affectedRows:1}];}};
  const id=await createRepository(pool).createCustomer({nombre:'Ana',correo:'ana@example.test',contrasena_hash:'encoded',telefono:'5512345678',direccion:'Calle de prueba 123',id_rol:1});
  assert.equal(id,88);assert.ok(recorded.params.includes('Cliente'));assert.equal(recorded.params.includes(1),false);
  assert.match(recorded.sql,/telefono,direccion/);assert.ok(recorded.params.includes('5512345678'));assert.ok(recorded.params.includes('Calle de prueba 123'));
});

test('new product opening stock is audited with its administrator in the same transaction',async()=>{
 const calls=[];const connection={execute:async(sql,params)=>{calls.push({sql,params});return [{insertId:72,affectedRows:1}];},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}};
 const pool={...connection,getConnection:async()=>connection};
 const id=await createRepository(pool).createProduct({nombre:'Pastel',descripcion:'',precio:'450.00',existencia:2,stock_minimo:0,unidad:'pieza',id_categoria:1},'/uploads/productos/00000000-0000-4000-8000-000000000000.webp',7);
 assert.equal(id,72);const move=calls.find(c=>c.sql.includes('INSERT INTO MOVIMIENTO_PRODUCTO'));
 assert.ok(move,'Existencia inicial requiere movimiento de apertura');assert.ok(move.params.includes(7));assert.ok(move.params.includes(2));
});
