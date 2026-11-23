import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {mysqlFixture} from './mysql-fixture.js';
import {migrateOperation} from '../scripts/migrate-operation.js';
import {migrateNotifications} from '../scripts/migrate-notifications.js';
import {runSeed} from '../scripts/seed/engine.js';
import {verifyPassword} from '../server/passwords.js';
import {createCommerce} from '../server/commerce.js';
import {randomUUID} from 'node:crypto';
import {parseQuantity,quantity} from '../server/amounts.js';
const real={skip:process.env.RUN_MYSQL_TESTS!=='1'};
async function fixture(t){
 const db=await mysqlFixture();t.after(()=>db.close());await migrateOperation(db.pool);await migrateNotifications(db.pool);
 const uploadDir=await mkdtemp(join(tmpdir(),'dulce-seed-test-'));t.after(async()=>{
  assert.equal(dirname(resolve(uploadDir)),resolve(tmpdir()));assert.ok(basename(uploadDir).startsWith('dulce-seed-test-'));
  await rm(uploadDir,{recursive:true,force:true});
 });
 const env={NODE_ENV:'test',SEED_CONFIRM_DB:db.name,SEED_PASSWORD:'Password ficticio para QA 2026'};
 const config={production:false,database:{host:'127.0.0.1',database:db.name}};
 return {...db,env,config,uploadDir,run:(action='seed')=>runSeed({pool:db.pool,config,env,uploadDir,action,anchor:'2026-11-12'})};
}
test('seed loads exact counts, salted hashes, coherent stock and money; reruns and undo preserve preexisting data',real,async t=>{
 const db=await fixture(t);
 const [existing]=await db.pool.query("INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,'Cuenta anterior','anterior@example.test','untouched' FROM ROL WHERE nombre='Cliente'");
 const first=await db.run();assert.equal(first.inserted.USUARIO,9);assert.equal(first.inserted.PRODUCTO,25);assert.equal(first.inserted.PEDIDO,15);assert.equal(first.inserted.VENTA,20);assert.equal(first.inserted.DETALLE_VENTA,40);
 assert.equal(Object.values(first.inserted).reduce((sum,count)=>sum+count,0),550);assert.equal(first.inserted.MOVIMIENTO_INGREDIENTE,115);
 const [[chronology]]=await db.pool.query('SELECT MIN(fecha_registro) AS registro FROM USUARIO WHERE id_usuario<>?',[existing.insertId]);
 const [[earliest]]=await db.pool.query('SELECT MIN(fecha_pedido) AS pedido FROM PEDIDO');assert.ok(chronology.registro<earliest.pedido);
 const [consumption]=await db.pool.query('SELECT d.id_venta,r.id_ingrediente,CAST(SUM(d.cantidad*r.cantidad/c.rendimiento) AS DECIMAL(12,3)) AS esperado FROM DETALLE_VENTA d JOIN RECETA c ON c.id_producto=d.id_producto JOIN DETALLE_RECETA r ON r.id_receta=c.id_receta GROUP BY d.id_venta,r.id_ingrediente');
 const [movements]=await db.pool.query("SELECT id_venta,id_ingrediente,cantidad FROM MOVIMIENTO_INGREDIENTE WHERE tipo='Venta'");
 const actual=new Map(movements.map(row=>[row.id_venta+':'+row.id_ingrediente,row.cantidad]));
 for(const row of consumption)assert.equal(actual.get(row.id_venta+':'+row.id_ingrediente),quantity(-parseQuantity(row.esperado)));
 const [users]=await db.pool.query("SELECT contrasena_hash FROM USUARIO WHERE correo LIKE '%.seed-v1@example.test'");assert.equal(new Set(users.map(u=>u.contrasena_hash)).size,9);assert.ok(await verifyPassword(users[0].contrasena_hash,db.env.SEED_PASSWORD));
 const second=await db.run();assert.equal(second.alreadySeeded,true);assert.deepEqual(second.inserted,{});assert.equal((await readdir(db.uploadDir)).length,1);
 assert.equal((await db.run('verify')).valid,true);
 await db.run('undo');assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM PRODUCTO'))[0][0].n,0);
 assert.equal((await db.pool.query('SELECT correo,contrasena_hash FROM USUARIO WHERE id_usuario=?',[existing.insertId]))[0][0].contrasena_hash,'untouched');
 assert.equal((await readdir(db.uploadDir)).length,0);assert.equal((await db.run('undo')).alreadyRemoved,true);
});
test('colliding user is never overwritten and unsuccessful seeding rolls back all rows/files',real,async t=>{
 const db=await fixture(t);await db.pool.query("INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,'Cuenta previa','diego.seed-v1@example.test','untouched' FROM ROL WHERE nombre='Cliente'");
 await assert.rejects(()=>db.run(),/colisión/i);
 assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM USUARIO'))[0][0].n,1);assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM PRODUCTO'))[0][0].n,0);assert.deepEqual(await readdir(db.uploadDir),[]);
});
test('undo refuses changed rows and external references instead of deleting real activity',real,async t=>{
 const db=await fixture(t);await db.run();
 const [[product]]=await db.pool.query('SELECT id_producto,precio FROM PRODUCTO LIMIT 1');await db.pool.query('UPDATE PRODUCTO SET precio=precio+1 WHERE id_producto=?',[product.id_producto]);
 await assert.rejects(()=>db.run('undo'),/modificad/i);assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM VENTA'))[0][0].n,20);
 await db.pool.query('UPDATE PRODUCTO SET precio=? WHERE id_producto=?',[product.precio,product.id_producto]);
 const [[user]]=await db.pool.query("SELECT id_usuario FROM USUARIO WHERE correo='ana.seed-v1@example.test'");
 await db.pool.query("INSERT INTO OPERACION(id_usuario,clave,accion,huella,resultado) VALUES (?,'actividad-ajena-0001','real',REPEAT('a',64),'{}')",[user.id_usuario]);
 await assert.rejects(()=>db.run('undo'),/dependencia/i);assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM PRODUCTO'))[0][0].n,25);
});
test('environment or connected database mismatch stops before writes',real,async t=>{
 const db=await fixture(t);await assert.rejects(()=>runSeed({...db,action:'seed',config:{...db.config,database:{...db.config.database,database:'otro_test'}},env:{...db.env,SEED_CONFIRM_DB:'otro_test'}}),/base conectada/i);
 assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM USUARIO'))[0][0].n,0);
});
test('seeded workers can sell seeded products using recipes and current business services',real,async t=>{
 const db=await fixture(t);await db.run();
 const [[worker]]=await db.pool.query("SELECT id_usuario,activo FROM USUARIO WHERE correo='emiliano.seed-v1@example.test'");
 const [[product]]=await db.pool.query('SELECT id_producto,precio FROM PRODUCTO LIMIT 1');
 const result=await createCommerce(db.pool).write({...worker,rol:'Trabajador'},'vender',{detalles:[{id_producto:product.id_producto,cantidad:1}],total_autorizado:product.precio,metodo_pago:'Efectivo'},randomUUID());
 assert.equal(result.estado,'Pagada');await assert.rejects(()=>db.run('undo'),/modificad/i);
});
test('lost commit acknowledgement keeps images recoverable for seed and undo',real,async t=>{
 const db=await fixture(t),original=db.pool.getConnection.bind(db.pool);let fail=true;
 db.pool.getConnection=async()=>{const connection=await original();const commit=connection.commit.bind(connection);connection.commit=async()=>{await commit();if(fail){fail=false;throw new Error('Lost COMMIT acknowledgement');}};return connection;};
 await assert.rejects(()=>db.run(),error=>error.commitUncertain===true);
 assert.ok((await readdir(db.uploadDir)).some(name=>name.endsWith('.webp')));
 assert.equal((await db.run()).alreadySeeded,true);assert.equal((await readdir(db.uploadDir)).length,1);
 fail=true;await assert.rejects(()=>db.run('undo'),error=>error.commitUncertain===true);
 assert.ok((await readdir(db.uploadDir)).some(name=>name.endsWith('.webp')));
 assert.equal((await db.run('undo')).alreadyRemoved,true);assert.deepEqual(await readdir(db.uploadDir),[]);
});
test('concurrent seeds serialize and create only one dataset',real,async t=>{
 const db=await fixture(t),results=await Promise.all([db.run(),db.run()]);
 assert.equal(results.filter(result=>result.alreadySeeded).length,1);
 assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM USUARIO'))[0][0].n,9);assert.equal((await readdir(db.uploadDir)).length,1);
});
test('a process that did not acquire the lock never cleans another in-flight photo',real,async t=>{
 const db=await fixture(t),photo=randomUUID()+'.webp',queue='.seed-cleanup-'+randomUUID()+'.json';
 await writeFile(join(db.uploadDir,photo),'pending photo');await writeFile(join(db.uploadDir,queue),JSON.stringify({database:db.name,photo:'/uploads/productos/'+photo}));
 const original=db.pool.getConnection.bind(db.pool);
 db.pool.getConnection=async()=>{const connection=await original(),query=connection.query.bind(connection);connection.query=async(sql,...args)=>sql.includes('GET_LOCK')?[[{ok:0}]]:query(sql,...args);return connection;};
 await assert.rejects(()=>db.run(),/en curso/);assert.equal((await readdir(db.uploadDir)).length,2);
});
