import test from 'node:test';
import assert from 'node:assert/strict';
import {mysqlFixture} from './mysql-fixture.js';
import {createHash,randomUUID} from 'node:crypto';
import {createManagement} from '../server/management.js';
import {createCommerce} from '../server/commerce.js';
import {migrateOperation} from '../scripts/migrate-operation.js';
import {migrateNotifications} from '../scripts/migrate-notifications.js';
import {backupDatabase} from '../scripts/backup.js';
import {readConfig} from '../server/config.js';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import mysql from 'mysql2/promise';

async function operationFixture(t){
 const db=await mysqlFixture();t.after(()=>db.close());await migrateOperation(db.pool);await migrateNotifications(db.pool);
 const actors={};
 for(const [key,role] of [['admin','Administrador'],['worker','Trabajador'],['client','Cliente'],['other','Cliente']]){
  const [result]=await db.pool.execute('INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,?,?,? FROM ROL WHERE nombre=?',[key,key+'@example.test','not-a-login-hash',role]);
  actors[key]={id_usuario:result.insertId,rol:role,nombre:key,correo:key+'@example.test',activo:1};
 }
 const management=createManagement(db.pool),commerce=createCommerce(db.pool);
 const master=(action,data,key=randomUUID())=>management.write(actors.admin,action,data,key);
 const act=(actor,action,data,key=randomUUID())=>commerce.write(actors[actor],action,data,key);
 const ingredient=await master('guardarIngrediente',{nombre:'Harina QA',unidad:'kg',existencia:'10.000',stock_minimo:'1.000'});
 const cream=await master('guardarIngrediente',{nombre:'Crema QA',unidad:'litro',existencia:'6.000',stock_minimo:'1.000'});
 const supplier=await master('guardarProveedor',{nombre:'Proveedor QA',correo:'proveedor@example.test'});
 const [[category]]=await db.pool.query("SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE nombre='Pasteles'");
 const [product]=await db.pool.execute("INSERT INTO PRODUCTO(id_categoria,nombre,precio,existencia,unidad) VALUES (?,'Pastel QA',450.00,10,'pieza')",[category.id_categoria]);
 const recipe=await master('guardarReceta',{nombre:'Receta QA',id_producto:product.insertId,detalles:[{id_ingrediente:ingredient.id,cantidad:'0.500'},{id_ingrediente:cream.id,cantidad:'0.250'}]});
 // Explicit legacy fixtures preserve the previous order policy; new checkout is tested separately.
 const legacyOrder=async(who,data)=>{
  const custom=data.tipo==='Personalizado',details=custom?[{id_producto:null,nombre:data.descripcion_personalizada,cantidad:1,precio_unitario:'0.00'}]:[];
  if(!custom)for(const line of data.detalles){const [[p]]=await db.pool.query('SELECT nombre,precio FROM PRODUCTO WHERE id_producto=?',[line.id_producto]);details.push({...line,nombre:p.nombre,precio_unitario:p.precio});}
  const total=details.reduce((sum,line)=>sum+Math.round(Number(line.precio_unitario)*100)*line.cantidad,0);
  const [result]=await db.pool.execute('INSERT INTO PEDIDO(id_cliente,tipo,descripcion_personalizada,fecha_solicitada,total,cotizacion_estado) VALUES (?,?,?,?,?,?)',[actors[who].id_usuario,custom?'Personalizado':'Catalogo',custom?data.descripcion_personalizada:null,data.fecha_solicitada.replace('T',' '),(total/100).toFixed(2),custom?'Por cotizar':'No aplica']);
  for(const line of details)await db.pool.execute('INSERT INTO DETALLE_PEDIDO(id_pedido,id_producto,nombre,cantidad,precio_unitario) VALUES (?,?,?,?,?)',[result.insertId,line.id_producto,line.nombre,line.cantidad,line.precio_unitario]);
  return {id:result.insertId,version:1,estado:'Pendiente',total:custom?null:(total/100).toFixed(2),saldo:custom?null:(total/100).toFixed(2)};
 };
 return {...db,...actors,management,commerce,master,act,legacyOrder,ingredient:ingredient.id,cream:cream.id,supplier:supplier.id,product:product.insertId,category:category.id_categoria,recipe:recipe.id};
}
const realTests={skip:process.env.RUN_MYSQL_TESTS!=='1'};

test('local backup restores historical dates as well as generated subtotals',realTests,async t=>{
 const source=await operationFixture(t),restored=await mysqlFixture();t.after(()=>restored.close());
 const temp=await mkdtemp(join(tmpdir(),'dulcerincon-backup-test-'));
 t.after(async()=>{if(resolve(temp).startsWith(resolve(tmpdir(),'dulcerincon-backup-test-')))await rm(temp,{recursive:true,force:true});});
 await source.pool.query("UPDATE USUARIO SET fecha_registro='2025-01-02 03:04:05' WHERE id_usuario=?",[source.client.id_usuario]);
 const path=await backupDatabase(source.pool,temp);const sql=await readFile(path,'utf8');
 const connection=await mysql.createConnection({...readConfig().database,database:restored.name,multipleStatements:true,dateStrings:true});
 try{await connection.query(sql);}finally{await connection.end();}
 const [[user]]=await restored.pool.query('SELECT fecha_registro FROM USUARIO WHERE id_usuario=?',[source.client.id_usuario]);
 assert.equal(user.fecha_registro,'2025-01-02 03:04:05');
});

test('purchase corrections are received once and closed records cannot be edited',realTests,async t=>{
 const db=await operationFixture(t);
 let purchase=await db.act('admin','guardarCompra',{id_proveedor:db.supplier,detalles:[{id_ingrediente:db.ingredient,cantidad:'5.000',precio_unitario:'20.00'}]});
 purchase=await db.act('admin','guardarCompra',{id:purchase.id,version:purchase.version,id_proveedor:db.supplier,detalles:[{id_ingrediente:db.ingredient,cantidad:'3.000',precio_unitario:'21.50'}]});
 assert.equal(purchase.total,'64.50');
 const key=randomUUID(), payload={id:purchase.id,version:purchase.version};
 const received=await db.act('admin','recibirCompra',payload,key);
 assert.deepEqual(await db.act('admin','recibirCompra',payload,key),received);
 const [[stock]]=await db.pool.query('SELECT existencia FROM INGREDIENTE WHERE id_ingrediente=?',[db.ingredient]);assert.equal(stock.existencia,'13.000');
 const [[moves]]=await db.pool.query('SELECT COUNT(*) AS total FROM MOVIMIENTO_INGREDIENTE WHERE id_compra=?',[purchase.id]);assert.equal(moves.total,1);
 await assert.rejects(()=>db.act('admin','guardarCompra',{...payload,version:received.version,detalles:[{id_ingrediente:db.ingredient,cantidad:'2',precio_unitario:'21.50'}]}),e=>e.status===409);
 await assert.rejects(()=>db.act('worker','recibirCompra',{id:purchase.id,version:received.version}),e=>e.status===403);
});

test('two cashiers competing for the final ingredients cannot oversell',realTests,async t=>{
 const db=await operationFixture(t);
 const ingredient=await db.management.read(db.admin,'ingredientes',{id:db.ingredient});
 await db.master('ajustarIngrediente',{id:db.ingredient,version:ingredient.version,existencia:'0.500',motivo:'Preparar prueba de concurrencia'});
 const sale={detalles:[{id_producto:db.product,cantidad:1}],metodo_pago:'Efectivo',recibido:'500.00',total_autorizado:'450.00'};
 const results=await Promise.allSettled([db.act('admin','vender',sale),db.act('worker','vender',sale)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const [[stock]]=await db.pool.query('SELECT existencia FROM INGREDIENTE WHERE id_ingrediente=?',[db.ingredient]);assert.equal(stock.existencia,'0.000');
 const [[counts]]=await db.pool.query('SELECT (SELECT COUNT(*) FROM VENTA) AS ventas,(SELECT COUNT(*) FROM PAGO) AS pagos');
 assert.equal(counts.ventas,1);assert.equal(counts.pagos,1);
 const [[units]]=await db.pool.query('SELECT existencia FROM PRODUCTO WHERE id_producto=?',[db.product]);assert.equal(units.existencia,9);
});

test('cash preview aggregates shared ingredients and locks the authorized total at sale',realTests,async t=>{
 const db=await operationFixture(t);
 await db.pool.query('UPDATE INGREDIENTE SET existencia=1 WHERE id_ingrediente=?',[db.ingredient]);
 await db.pool.query('UPDATE DETALLE_RECETA SET cantidad=0.600 WHERE id_receta=? AND id_ingrediente=?',[db.recipe,db.ingredient]);
 const [second]=await db.pool.execute("INSERT INTO PRODUCTO(id_categoria,nombre,precio,existencia) VALUES (?,'Segundo pastel QA',450,5)",[db.category]);
 await db.master('guardarReceta',{id_producto:second.insertId,nombre:'Segunda receta QA',detalles:[{id_ingrediente:db.ingredient,cantidad:'0.600'}]});
 const details=[{id_producto:db.product,cantidad:1},{id_producto:second.insertId,cantidad:1}];
 const preview=await db.act('worker','prepararVenta',{detalles:details});
 assert.equal(preview.total,'900.00');assert.equal(preview.puede_vender,false);assert.match(preview.faltantes.join(' '),/0.200/);
 const order=await db.legacyOrder('client',{fecha_solicitada:'2026-12-10T12:00',detalles:details});
 const viewed=await db.commerce.read(db.worker,'pedidos',{id:order.id});assert.equal(viewed.disponibilidad.puede_entregar,false);assert.match(viewed.disponibilidad.faltantes.join(' '),/0.200/);
 const single=[{id_producto:db.product,cantidad:1}];
 const quote=await db.act('worker','prepararVenta',{detalles:single});assert.equal(quote.total,'450.00');
 await db.pool.query('UPDATE PRODUCTO SET precio=500 WHERE id_producto=?',[db.product]);
 await assert.rejects(()=>db.act('worker','vender',{detalles:single,metodo_pago:'Transferencia',referencia:'QA-PRECIO-OLD',transferencia_verificada:true,total_autorizado:quote.total}),e=>e.status===409);
 const [[count]]=await db.pool.query('SELECT COUNT(*) AS total FROM VENTA');assert.equal(count.total,0);
 const fresh=await db.act('worker','prepararVenta',{detalles:single});assert.equal(fresh.total,'500.00');
 const sale=await db.act('worker','vender',{detalles:single,metodo_pago:'Transferencia',referencia:'QA-PRECIO-OLD',transferencia_verificada:true,total_autorizado:fresh.total});assert.equal(sale.total,'500.00');
});

test('migration stops historical cancelled advances and open orders already sold before DDL',realTests,async t=>{
 for(const cancelled of [true,false]){
  const db=await mysqlFixture();t.after(()=>db.close());
  await db.pool.query("INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,'Cliente QA','legacy@example.test','not-login' FROM ROL WHERE nombre='Cliente'");
  const [order]=await db.pool.execute('INSERT INTO PEDIDO(id_cliente,estado,total,anticipo) VALUES (1,?,100,?)',[cancelled?'Cancelado':'Pendiente',cancelled?'25.00':'100.00']);
  if(!cancelled)await db.pool.execute("INSERT INTO VENTA(id_usuario,id_pedido,total,metodo_pago) VALUES (1,?,100,'Efectivo')",[order.insertId]);
  await assert.rejects(()=>migrateOperation(db.pool),error=>error.message.includes('#'+order.insertId));
  const [[count]]=await db.pool.query("SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='MIGRACION_WEB'");assert.equal(count.total,0);
 }
});

test('advance on day A and delivery on day B are reported separately',realTests,async t=>{
 const db=await operationFixture(t);
 let order=await db.legacyOrder('client',{fecha_solicitada:'2026-12-10T12:00',detalles:[{id_producto:db.product,cantidad:1}]});
 order=await db.act('worker','cobrarPedido',{id:order.id,version:order.version,importe:'100.00',metodo_pago:'Efectivo'});
 await db.pool.query("UPDATE PAGO SET fecha='2026-01-10 12:00:00' WHERE id_pedido=?",[order.id]);
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'En preparación'});
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'Listo'});
 const result=await db.act('worker','entregarPedido',{id:order.id,version:order.version,pago:{importe:'350.00',metodo_pago:'Transferencia'}});
 await db.pool.query("UPDATE VENTA SET fecha='2026-01-11 12:00:00' WHERE id_venta=?",[result.id_venta]);
 await db.pool.query("UPDATE PAGO SET fecha='2026-01-11 12:00:00' WHERE id_pedido=? AND importe=350",[order.id]);
 const a=await db.commerce.read(db.admin,'resumen',{desde:'2026-01-10',hasta:'2026-01-10'}),b=await db.commerce.read(db.admin,'resumen',{desde:'2026-01-11',hasta:'2026-01-11'});
 assert.equal(a.cobros,'100.00');assert.equal(a.total_ventas,'0.00');assert.equal(b.cobros,'350.00');assert.equal(b.total_ventas,'450.00');
});

test('order can lack stock, then deliver with final payment atomically and keep historical recipe',realTests,async t=>{
 const db=await operationFixture(t);
 const ingredient=await db.management.read(db.admin,'ingredientes',{id:db.ingredient});
 await db.master('ajustarIngrediente',{id:db.ingredient,version:ingredient.version,existencia:'0',motivo:'Prueba sin existencias'});
 let order=await db.legacyOrder('client',{tipo:'Catalogo',fecha_solicitada:'2026-12-10T12:00',detalles:[{id_producto:db.product,cantidad:1}]});
 order=await db.act('worker','cobrarPedido',{id:order.id,version:order.version,importe:'100.00',metodo_pago:'Efectivo'});
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'En preparación',fecha_entrega:'2026-12-13T12:00',motivo_retraso:'En espera de harina'});
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'Listo'});
 const delivery={id:order.id,version:order.version,pago:{importe:'350.00',metodo_pago:'Transferencia'}};const key=randomUUID();
 await assert.rejects(()=>db.act('worker','entregarPedido',delivery,key),e=>e.status===409);
 const [[payments]]=await db.pool.query('SELECT COUNT(*) AS total,SUM(importe) AS importe FROM PAGO');assert.equal(payments.total,1);assert.equal(payments.importe,'100.00');
 const visible=await db.commerce.read(db.client,'pedidos',{id:order.id});assert.equal(visible.motivo_retraso,'En espera de harina');assert.equal(visible.fecha_entrega,'2026-12-13 12:00:00');
 const latest=await db.management.read(db.admin,'ingredientes',{id:db.ingredient});
 await db.master('ajustarIngrediente',{id:db.ingredient,version:latest.version,existencia:'5.000',motivo:'Reponer para entrega de prueba'});
 const final=await db.act('worker','entregarPedido',delivery,key);assert.equal(final.estado,'Despachado');
 assert.deepEqual(await db.act('worker','entregarPedido',delivery,key),final);
 const sale=await db.commerce.read(db.admin,'ventas',{id:final.id_venta});assert.equal(sale.total,'450.00');assert.equal(sale.metodo_pago,'Mixto');assert.equal(sale.pagos.length,2);
 const recipe=await db.management.read(db.admin,'recetas',{id:db.recipe});
 await db.master('guardarReceta',{id:db.recipe,version:recipe.version,id_producto:db.product,nombre:'Nueva receta QA',detalles:[{id_ingrediente:db.ingredient,cantidad:'0.750'}]});
 const oldSale=await db.commerce.read(db.admin,'ventas',{id:final.id_venta});assert.equal(oldSale.movimientos.find(m=>m.id_ingrediente===db.ingredient).cantidad,'-0.500');
 const file=await db.management.read(db.admin,'cliente',{id:db.client.id_usuario});assert.equal(file.resumen.compras_completadas,1);assert.equal(file.resumen.importe_comprado,'450.00');assert.equal(file.resumen.saldo_pendiente,'0.00');
 const summary=await db.commerce.read(db.admin,'resumen',{});assert.equal(summary.total_ventas,'450.00');assert.equal(summary.cobros,'450.00');
 await assert.rejects(()=>db.commerce.read(db.other,'pedidos',{id:order.id}),e=>e.status===404);
});

test('personalized order accepts only its current owner quote and consumes actual ingredients at delivery',realTests,async t=>{
 const db=await operationFixture(t);
 let order=await db.legacyOrder('client',{tipo:'Personalizado',descripcion_personalizada:'Pastel de cumpleaños personalizado QA',fecha_solicitada:'2026-12-11T16:00'});
 assert.equal(order.total,null);
 order=await db.act('worker','cotizarPedido',{id:order.id,version:order.version,total:'650.00',fecha_entrega:'2026-12-12T16:00'});
 const stale={id:order.id,version:order.version,cotizacion_version:order.cotizacion_version};
 order=await db.act('worker','cotizarPedido',{id:order.id,version:order.version,total:'700.00',fecha_entrega:'2026-12-12T16:00'});
 await assert.rejects(()=>db.act('client','aceptarCotizacion',stale),e=>e.status===409);
 await assert.rejects(()=>db.act('other','aceptarCotizacion',{id:order.id,version:order.version,cotizacion_version:order.cotizacion_version}),e=>e.status===403);
 await assert.rejects(()=>db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'En preparación'}),e=>e.status===409);
 order=await db.act('client','aceptarCotizacion',{id:order.id,version:order.version,cotizacion_version:order.cotizacion_version});
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'En preparación'});
 order=await db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'Listo'});
 await assert.rejects(()=>db.act('worker','entregarPedido',{id:order.id,version:order.version,pago:{importe:'700',metodo_pago:'Efectivo'}}),e=>e.status===400);
 const data={id:order.id,version:order.version,detalles:[{id_ingrediente:db.ingredient,cantidad:'0.400'},{id_ingrediente:db.cream,cantidad:'0.200'}],pago:{importe:'700.00',metodo_pago:'Efectivo'}};
 const result=await db.act('worker','entregarPedido',data);
 const sale=await db.commerce.read(db.admin,'ventas',{id:result.id_venta});assert.equal(sale.detalles[0].id_producto,null);assert.equal(sale.total,'700.00');assert.equal(sale.movimientos.length,2);
 const [[flour]]=await db.pool.query('SELECT existencia FROM INGREDIENTE WHERE id_ingrediente=?',[db.ingredient]);assert.equal(flour.existencia,'9.600');
 const [[catalog]]=await db.pool.query('SELECT COUNT(*) AS total FROM PRODUCTO');assert.equal(catalog.total,1);
});

test('only admin cancels a paid order with a recorded full manual refund',realTests,async t=>{
 const db=await operationFixture(t);
 let order=await db.legacyOrder('client',{fecha_solicitada:'2026-12-10T12:00',detalles:[{id_producto:db.product,cantidad:1}]});
 order=await db.act('worker','cobrarPedido',{id:order.id,version:order.version,importe:'125.00',metodo_pago:'Transferencia'});
 const data={id:order.id,version:order.version,motivo:'Cancelación solicitada QA',metodo_pago:'Efectivo'};
 await assert.rejects(()=>db.act('worker','cancelarPedido',data),e=>e.status===403);
 const result=await db.act('admin','cancelarPedido',data);assert.equal(result.estado,'Cancelado');assert.equal(result.devolucion,'125.00');
 const summary=await db.commerce.read(db.admin,'resumen',{});assert.equal(summary.cobros,'125.00');assert.equal(summary.devoluciones,'125.00');assert.equal(summary.total_ventas,'0.00');
 const [[stock]]=await db.pool.query('SELECT existencia FROM INGREDIENTE WHERE id_ingrediente=?',[db.ingredient]);assert.equal(stock.existencia,'10.000');
});

test('isolated migration preserves stock and opening movements on repeat',{skip:process.env.RUN_MYSQL_TESTS!=='1'},async t=>{
 const {migrateOperation}=await import('../scripts/migrate-operation.js');
 const db=await mysqlFixture();t.after(()=>db.close());
 await db.pool.execute("INSERT INTO INGREDIENTE(nombre,unidad,existencia,stock_minimo) VALUES ('Harina QA','kg',7.125,1)");
 await migrateOperation(db.pool);await migrateOperation(db.pool);
 const [stock]=await db.pool.query('SELECT existencia FROM INGREDIENTE');
 const [moves]=await db.pool.query('SELECT cantidad,existencia_resultante FROM MOVIMIENTO_INGREDIENTE');
 assert.equal(stock[0].existencia,'7.125');assert.equal(moves.length,1);assert.equal(moves[0].cantidad,'7.125');
});

test('persisted operation retries produce exactly one movement and reject key tampering',{skip:process.env.RUN_MYSQL_TESTS!=='1'},async t=>{
 const {migrateOperation}=await import('../scripts/migrate-operation.js');
 const {transaction,once}=await import('../server/transactions.js');
 const db=await mysqlFixture();t.after(()=>db.close());await migrateOperation(db.pool);
 await db.pool.query("INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,'QA','qa@example.test','hash-no-login' FROM ROL WHERE nombre='Administrador'");
 const actor={id_usuario:1,rol:'Administrador'};let effects=0;
 const action=data=>transaction(db.pool,conn=>once(conn,actor,'prueba','01234567-0123-4567-8901-012345678901',data,async()=>{effects++;return {folio:71};}));
 const [first,second]=await Promise.all([action({cantidad:'1'}),action({cantidad:'1'})]);
 assert.deepEqual(first,{folio:71});assert.deepEqual(second,first);assert.equal(effects,1);
 await assert.rejects(()=>action({cantidad:'2'}),error=>error.status===409);
 const sensitive={contrasena:'Una prueba privada 2026'};
 await transaction(db.pool,conn=>once(conn,actor,'credencial',randomUUID(),sensitive,async()=>({ok:true})));
 const [fingerprints]=await db.pool.query("SELECT huella FROM OPERACION WHERE accion='credencial'");
 const unkeyed=createHash('sha256').update(JSON.stringify({accion:'credencial',datos:sensitive})).digest('hex');
 assert.notEqual(fingerprints[0].huella,unkeyed,'No persistir un verificador rápido de la contraseña');
});
