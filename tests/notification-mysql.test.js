import test from 'node:test';
import assert from 'node:assert/strict';
import {mysqlFixture} from './mysql-fixture.js';
import {migrateOperation} from '../scripts/migrate-operation.js';
import {migrateNotifications} from '../scripts/migrate-notifications.js';
import {createCommerce} from '../server/commerce.js';
import {createCommunications} from '../server/notifications.js';
import {randomUUID} from 'node:crypto';
const real={skip:process.env.RUN_MYSQL_TESTS!=='1'};
async function fixture(t){
 const db=await mysqlFixture();t.after(()=>db.close());await migrateOperation(db.pool);await migrateNotifications(db.pool);
 const actors={};for(const [key,role] of [['admin','Administrador'],['worker','Trabajador'],['otherworker','Trabajador'],['client','Cliente'],['other','Cliente']]){
  const [result]=await db.pool.execute('INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,?,?,? FROM ROL WHERE nombre=?',[key,key+'@example.test','not-login',role]);actors[key]={id_usuario:result.insertId,rol:role,activo:1,nombre:key};
 }
 const commerce=createCommerce(db.pool),communications=createCommunications(db.pool);
 await communications.write(actors.admin,'guardarConfiguracionBancaria',{version:0,banco:'Banco de pruebas',titular:'Destino ficticio QA',clabe:'000000000000000001',instrucciones:'Solo datos de prueba'},randomUUID());
 const [[category]]=await db.pool.query("SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE nombre='Pasteles'");
 const [product]=await db.pool.execute("INSERT INTO PRODUCTO(id_categoria,nombre,precio,existencia) VALUES (?,'Pastel QA',450,10)",[category.id_categoria]);
 const [ingredient]=await db.pool.query("INSERT INTO INGREDIENTE(nombre,unidad,existencia) VALUES ('Harina QA','kg',10)");
 const [recipe]=await db.pool.execute("INSERT INTO RECETA(id_producto,nombre) VALUES (?,'Receta QA')",[product.insertId]);
 await db.pool.execute('INSERT INTO DETALLE_RECETA(id_receta,id_ingrediente,cantidad) VALUES (?,?,0.500)',[recipe.insertId,ingredient.insertId]);
 const act=(who,action,data,key=randomUUID())=>commerce.write(actors[who],action,data,key);
 async function catalog(mode='Efectivo',ref='REF-'+randomUUID()){
  const details=[{id_producto:product.insertId,cantidad:1}],preview=await act('client','prepararPedido',{detalles:details,modalidad_pago:mode});
  const body={detalles:details,fecha_solicitada:'2026-12-15T12:00',modalidad_pago:mode,referencia:ref,config_version:preview.configuracion_bancaria.version,total_autorizado:preview.total,cotizacion_checkout:preview.cotizacion_checkout};
  const order=await act('client','crearPedido',body);return {order,preview,body};
 }
 return {...db,...actors,act,catalog,commerce,communications,product:product.insertId};
}

test('new cash order waits for verified thirty percent and creates one payment and owner',real,async t=>{
 const db=await fixture(t);const {order,preview}=await db.catalog();assert.equal(preview.importe_transferir,'135.00');assert.equal(preview.saldo_posterior,'315.00');
 let detail=await db.commerce.read(db.client,'pedidos',{id:order.id});assert.equal(detail.politica_pago,1);assert.equal(detail.anticipo,'0.00');assert.equal(detail.aceptacion_estado,'Pendiente de validación');
 await assert.rejects(()=>db.act('worker','actualizarPedido',{id:order.id,version:detail.version,estado:'En preparación'}),e=>e.status===409);
 await assert.rejects(()=>db.act('worker','cobrarPedido',{id:order.id,version:detail.version,importe:'135',metodo_pago:'Efectivo'}),e=>e.status===409);
 const payload={id:order.id,version:detail.version,id_intento:detail.intentos_transferencia[0].id_intento,decision:'Aceptar'},key=randomUUID();
 const accepted=await db.act('worker','revisarTransferencia',payload,key);assert.deepEqual(await db.act('worker','revisarTransferencia',payload,key),accepted);
 detail=await db.commerce.read(db.client,'pedidos',{id:order.id});assert.equal(detail.anticipo,'135.00');assert.equal(detail.saldo,'315.00');assert.equal(detail.id_trabajador,db.worker.id_usuario);
 assert.equal(detail.fecha_entrega,'2026-12-15 12:00:00');
 const [[counts]]=await db.pool.query('SELECT (SELECT COUNT(*) FROM PAGO) AS pagos,(SELECT COUNT(*) FROM NOTIFICACION WHERE id_destinatario=? AND tipo=?) AS avisos',[db.client.id_usuario,'Transferencia aceptada']);assert.equal(counts.pagos,1);assert.equal(counts.avisos,1);
 let current=await db.act('worker','actualizarPedido',{id:order.id,version:detail.version,estado:'En preparación'});
 current=await db.act('worker','actualizarPedido',{id:order.id,version:current.version,estado:'Listo'});
 const delivered=await db.act('worker','entregarPedido',{id:order.id,version:current.version,pago:{importe:'315.00',metodo_pago:'Efectivo'}});assert.equal(delivered.estado,'Despachado');
 const finished=await db.commerce.read(db.client,'pedidos',{id:order.id});assert.equal(finished.fecha_entrega,'2026-12-15 12:00:00');
 const summary=await db.commerce.read(db.admin,'resumen',{});assert.equal(summary.cobros,'450.00');assert.equal(summary.total_ventas,'450.00');
});

test('unverified cancellation, duplicate reference and card charges are blocked by server',real,async t=>{
 const db=await fixture(t);let {order}=await db.catalog('Transferencia','UNICA-QA');
 let detail=await db.commerce.read(db.client,'pedidos',{id:order.id});
 await assert.rejects(()=>db.act('client','cancelarPedido',{id:order.id,version:detail.version,motivo:'Cancelar mientras se revisa'}),e=>e.status===409);
 await db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:detail.intentos_transferencia[0].id_intento,decision:'Aceptar'});
 await assert.rejects(()=>db.catalog('Transferencia',' unica-qa '),e=>e.status===409);
 await assert.rejects(()=>db.act('worker','vender',{detalles:[{id_producto:db.product,cantidad:1}],total_autorizado:'450.00',metodo_pago:'Tarjeta'}),e=>e.status===400);
 await assert.rejects(()=>db.act('worker','vender',{detalles:[{id_producto:db.product,cantidad:1}],total_autorizado:'450.00',metodo_pago:'Transferencia',referencia:'SIN-REVISAR'}),e=>e.status===400);
 const before=await db.communications.read(db.client,'notificaciones',{});assert.ok(before.no_leidas>0);
 await assert.rejects(()=>db.communications.write(db.other,'leerNotificacion',{id:before.items[0].id_notificacion},randomUUID()),e=>e.status===404);
 await db.communications.write(db.client,'leerTodasNotificaciones',{},randomUUID());assert.equal((await db.communications.read(db.client,'notificaciones',{})).no_leidas,0);
});

test('incorrect reference is corrected within order and stale or competing review cannot double credit',real,async t=>{
 const db=await fixture(t);let {order}=await db.catalog('Transferencia','INVALIDA-QA');
 let detail=await db.commerce.read(db.client,'pedidos',{id:order.id}),old=detail.intentos_transferencia[0];
 await db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:old.id_intento,decision:'Corregir',motivo:'No se encontró ese ingreso'});
 detail=await db.commerce.read(db.client,'pedidos',{id:order.id});assert.equal(detail.anticipo,'0.00');assert.equal(detail.aceptacion_estado,'Por corregir');
 const authorization=await db.act('client','prepararPedido',{id:order.id,modalidad_pago:'Transferencia'});
 await db.act('client','enviarReferencia',{autorizacion_pago:authorization.autorizacion_pago,id:order.id,version:detail.version,modalidad_pago:'Transferencia',referencia:'CORRECTA-QA',config_version:1,total_autorizado:'450.00'});
 detail=await db.commerce.read(db.worker,'pedidos',{id:order.id});assert.equal(detail.intentos_transferencia.length,2);
 await assert.rejects(()=>db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:old.id_intento,decision:'Aceptar'}),e=>e.status===409);
 const latest=detail.intentos_transferencia.at(-1),payload={id:order.id,version:detail.version,id_intento:latest.id_intento,decision:'Aceptar'};
 const results=await Promise.allSettled([db.act('worker','revisarTransferencia',payload),db.act('otherworker','revisarTransferencia',payload)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const [[paid]]=await db.pool.query('SELECT COUNT(*) AS pagos,SUM(importe) AS total FROM PAGO');assert.equal(paid.pagos,1);assert.equal(paid.total,'450.00');
 await assert.rejects(()=>db.act('worker','cobrarPedido',{id:order.id,version:detail.version+1,importe:'1',metodo_pago:'Efectivo'}));
});

test('personalized images, acceptance and payment stay separate; foreign access denied',real,async t=>{
 const db=await fixture(t);const key=randomUUID(),file={archivo:randomUUID()+'.webp',hash_original:'a'.repeat(64)};
 let order=await db.commerce.createWithReferences(db.client,{tipo:'Personalizado',descripcion_personalizada:'Un pastel rosa QA',fecha_solicitada:'2026-12-15T12:00'},key,[file]);
 assert.equal(order.referencias.length,1);
 const repeated=await db.commerce.createWithReferences(db.client,{tipo:'Personalizado',descripcion_personalizada:'Un pastel rosa QA',fecha_solicitada:'2026-12-15T12:00'},key,[{...file,archivo:randomUUID()+'.webp'}]);assert.equal(repeated.id,order.id);
 await assert.rejects(()=>db.commerce.referenceById(db.other,order.id,order.referencias[0].id_referencia),e=>[403,404].includes(e.status));
 order=await db.act('worker','cotizarPedido',{id:order.id,version:order.version,total:'900.00',fecha_entrega:'2026-12-15T12:00'});
 order=await db.act('client','aceptarCotizacion',{id:order.id,version:order.version,cotizacion_version:order.cotizacion_version});
 await assert.rejects(()=>db.act('worker','actualizarPedido',{id:order.id,version:order.version,estado:'En preparación'}),e=>e.status===409);
 const quote=await db.act('client','prepararPedido',{id:order.id,modalidad_pago:'Efectivo'});assert.equal(quote.importe_transferir,'270.00');
 order=await db.act('client','enviarReferencia',{autorizacion_pago:quote.autorizacion_pago,id:order.id,version:order.version,modalidad_pago:'Efectivo',referencia:'PERS-QA',config_version:1,total_autorizado:'900.00'});
 const detail=await db.commerce.read(db.worker,'pedidos',{id:order.id});
 await db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:detail.intentos_transferencia[0].id_intento,decision:'Aceptar'});
});

test('quoted catalog amount and bank destination survive changes while customer transfers',real,async t=>{
 const db=await fixture(t),details=[{id_producto:db.product,cantidad:1}];
 const quote=await db.act('client','prepararPedido',{detalles:details,modalidad_pago:'Transferencia'});
 await db.pool.query('UPDATE PRODUCTO SET precio=500 WHERE id_producto=?',[db.product]);
 await db.communications.write(db.admin,'guardarConfiguracionBancaria',{version:1,banco:'Segundo banco QA',titular:'Otro destino QA',clabe:'000000000000000002'},randomUUID());
 const data={detalles:details,fecha_solicitada:'2026-12-15T12:00',modalidad_pago:'Transferencia',referencia:'PRECIO-QA',config_version:1,total_autorizado:quote.total,cotizacion_checkout:quote.cotizacion_checkout};
 const order=await db.act('client','crearPedido',data),detail=await db.commerce.read(db.client,'pedidos',{id:order.id});
 assert.equal(detail.total,'450.00');assert.equal(detail.intentos_transferencia[0].config_version,1);
 await assert.rejects(()=>db.act('client','crearPedido',{...data,referencia:'REUTILIZADO'}),e=>e.status===409);
});
test('notification migration preserves old orders, historical card and is repeatable',real,async t=>{
 const {migrateNotifications}=await import('../scripts/migrate-notifications.js');
 const db=await mysqlFixture();t.after(()=>db.close());await migrateOperation(db.pool);
 await db.pool.query("INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,'QA','old@example.test','not-login' FROM ROL WHERE nombre='Cliente'");
 await db.pool.query("INSERT INTO PEDIDO(id_cliente,total,anticipo,fecha_entrega) VALUES (1,900,100,'2026-12-12 12:00:00')");
 await db.pool.query("INSERT INTO VENTA(id_usuario,total,metodo_pago) VALUES (1,50,'Tarjeta')");
 await db.pool.query("INSERT INTO PAGO(id_pedido,importe,metodo_pago,id_usuario,referencia,devuelto) VALUES (1,100,'Transferencia',1,'REEMBOLSADA-QA',1)");
 await migrateNotifications(db.pool);await migrateNotifications(db.pool);
 const [[reserved]]=await db.pool.query("SELECT COUNT(*) AS total FROM TRANSFERENCIA_VALIDADA WHERE referencia_normalizada='REEMBOLSADA-QA'");assert.equal(reserved.total,1);
 const [[order]]=await db.pool.query('SELECT politica_pago,total,anticipo,aceptacion_estado FROM PEDIDO');
 assert.equal(order.politica_pago,0);assert.equal(order.anticipo,'100.00');assert.equal(order.aceptacion_estado,'Aceptado');
 const [[sale]]=await db.pool.query('SELECT metodo_pago FROM VENTA');assert.equal(sale.metodo_pago,'Tarjeta');
 const [[count]]=await db.pool.query('SELECT COUNT(*) AS total FROM NOTIFICACION');assert.equal(count.total,0);
});

test('checkout binds bank version and payment mode; review queue filters globally without leaking clients',real,async t=>{
 const db=await fixture(t),details=[{id_producto:db.product,cantidad:1}];
 const quote=await db.act('client','prepararPedido',{detalles:details,modalidad_pago:'Transferencia'});
 await db.communications.write(db.admin,'guardarConfiguracionBancaria',{version:1,banco:'Banco nuevo QA',titular:'Destino QA',clabe:'000000000000000002'},randomUUID());
 const payload={detalles:details,fecha_solicitada:'2026-12-15T12:00',modalidad_pago:'Transferencia',referencia:'AUTH-QA',config_version:1,total_autorizado:quote.total,cotizacion_checkout:quote.cotizacion_checkout};
 await assert.rejects(()=>db.act('client','crearPedido',{...payload,config_version:2}),e=>e.status===409);
 await assert.rejects(()=>db.act('client','crearPedido',{...payload,modalidad_pago:'Efectivo'}),e=>e.status===409);
 const order=await db.act('client','crearPedido',payload);
 assert.equal((await db.commerce.read(db.worker,'pedidos',{aceptacion_estado:'Pendiente de validación'})).total,1);
 assert.equal((await db.commerce.read(db.worker,'pedidos',{aceptacion_estado:'Aceptado'})).total,0);
 assert.equal((await db.commerce.read(db.other,'pedidos',{aceptacion_estado:'Pendiente de validación'})).total,0);
 let detail=await db.commerce.read(db.worker,'pedidos',{id:order.id});
 await db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:detail.intentos_transferencia[0].id_intento,decision:'Corregir',motivo:'Revisar referencia QA'});
 detail=await db.commerce.read(db.client,'pedidos',{id:order.id});
 const auth=await db.act('client','prepararPedido',{id:order.id,modalidad_pago:'Transferencia'});
 const correction={id:order.id,version:detail.version,modalidad_pago:'Transferencia',referencia:'AUTH-CORREGIDA',config_version:1,total_autorizado:auth.total,autorizacion_pago:auth.autorizacion_pago};
 await assert.rejects(()=>db.act('client','enviarReferencia',{...correction,config_version:2}),e=>e.status===409);
 await assert.rejects(()=>db.act('client','enviarReferencia',{...correction,modalidad_pago:'Efectivo'}),e=>e.status===409);
 await db.act('client','enviarReferencia',correction);
});

test('a committed order survives a lost MySQL acknowledgement and retains its private metadata on retry',real,async t=>{
 const db=await fixture(t),original=db.pool.getConnection.bind(db.pool),key=randomUUID();let inject=true;
 db.pool.getConnection=async()=>{const connection=await original();if(inject){inject=false;const commit=connection.commit.bind(connection);connection.commit=async()=>{await commit();connection.commit=commit;throw new Error('Simulated lost commit acknowledgement');};}return connection;};
 const data={tipo:'Personalizado',descripcion_personalizada:'Commit incierto QA',fecha_solicitada:'2026-12-15T12:00'},file={archivo:randomUUID()+'.webp',hash_original:'b'.repeat(64)};
 await assert.rejects(()=>db.commerce.createWithReferences(db.client,data,key,[file]),error=>error.commitUncertain===true);
 const retained=await db.commerce.referenceFilesInUse([file]);assert.equal(retained[0].archivo,file.archivo);
 const recovered=await db.commerce.createWithReferences(db.client,data,key,[{...file,archivo:randomUUID()+'.webp'}]);assert.equal(recovered.referencias[0].archivo,file.archivo);
 const [[count]]=await db.pool.query('SELECT COUNT(*) AS total FROM PEDIDO');assert.equal(count.total,1);
});

test('admin receives general events once while clients and workers stay isolated',real,async t=>{
 const db=await fixture(t),key=randomUUID();
 const sale={detalles:[{id_producto:db.product,cantidad:1}],total_autorizado:'450.00',metodo_pago:'Efectivo'};
 const sold=await db.act('worker','vender',sale,key);await db.act('worker','vender',sale,key);
 let notices=await db.communications.read(db.admin,'notificaciones',{});
 assert.equal(notices.items.filter(n=>n.tipo==='Venta completada').length,1);
 assert.equal(notices.items.find(n=>n.tipo==='Venta completada').id_origen,sold.id);
 assert.equal((await db.communications.read(db.client,'notificaciones',{})).total,0);
 assert.equal((await db.communications.read(db.worker,'notificaciones',{})).total,0);
 const [supplier]=await db.pool.query("INSERT INTO PROVEEDOR(nombre) VALUES ('Proveedor QA')");
 const [[ingredient]]=await db.pool.query('SELECT id_ingrediente FROM INGREDIENTE LIMIT 1');
 const data={id_proveedor:supplier.insertId,detalles:[{id_ingrediente:ingredient.id_ingrediente,cantidad:'1.000',precio_unitario:'20.00'}]};
 let purchase=await db.act('admin','guardarCompra',data);
 const receiveKey=randomUUID(),receive={id:purchase.id,version:purchase.version};
 await db.act('admin','recibirCompra',receive,receiveKey);await db.act('admin','recibirCompra',receive,receiveKey);
 purchase=await db.act('admin','guardarCompra',data);await db.act('admin','cancelarCompra',{id:purchase.id,version:purchase.version});
 const {order}=await db.catalog();let detail=await db.commerce.read(db.worker,'pedidos',{id:order.id});
 await db.act('worker','revisarTransferencia',{id:order.id,version:detail.version,id_intento:detail.intentos_transferencia[0].id_intento,decision:'Aceptar'});
 detail=await db.commerce.read(db.worker,'pedidos',{id:order.id});
 let updated=await db.act('worker','actualizarPedido',{id:order.id,version:detail.version,estado:'En preparación'});
 updated=await db.act('worker','actualizarPedido',{id:order.id,version:updated.version,estado:'Listo'});
 const beforeEdit=(await db.communications.read(db.admin,'notificaciones',{})).total;
 updated=await db.act('worker','actualizarPedido',{id:order.id,version:updated.version,estado:'Listo',id_trabajador:db.worker.id_usuario});
 assert.equal((await db.communications.read(db.admin,'notificaciones',{})).total,beforeEdit);
 await db.act('worker','entregarPedido',{id:order.id,version:updated.version,pago:{importe:'315.00',metodo_pago:'Efectivo'}});
 notices=await db.communications.read(db.admin,'notificaciones',{});
 for(const type of ['Creación','Actualización','Entrega','Venta completada','Compra creada','Compra recibida','Compra cancelada'])assert.ok(notices.items.some(n=>n.tipo===type),type);
 assert.equal(notices.items.filter(n=>n.tipo==='Venta completada').length,2);
 assert.equal(notices.items.filter(n=>n.tipo==='Compra recibida').length,1);
 assert.ok(!(await db.communications.read(db.client,'notificaciones',{})).items.some(n=>n.entidad==='Compra'||n.entidad==='Venta'));
 assert.ok(!(await db.communications.read(db.worker,'notificaciones',{})).items.some(n=>n.entidad==='Compra'||n.entidad==='Venta'));
 await migrateNotifications(db.pool);assert.equal((await db.communications.read(db.admin,'notificaciones',{})).total,notices.total);
});
