// SOLO QA: base y archivos temporales exclusivos. Nunca usa los registros del negocio.
import {mysqlFixture} from './mysql-fixture.js';
import {migrateOperation} from '../scripts/migrate-operation.js';
import {migrateNotifications} from '../scripts/migrate-notifications.js';
import {createCommunications} from '../server/notifications.js';
import {createServer} from 'node:http';
import {createManagement} from '../server/management.js';
import {createCommerce} from '../server/commerce.js';
import {createRepository} from '../server/repository.js';
import {createApp} from '../server/app.js';
import {hashPassword} from '../server/passwords.js';
import {saveImage} from '../server/images.js';
import session from 'express-session';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const db=await mysqlFixture();await migrateOperation(db.pool);await migrateNotifications(db.pool);
const qaRoot=await mkdtemp(join(tmpdir(),'dulcerincon-operation-preview-'));
const uploads=join(qaRoot,'productos'),references=join(qaRoot,'referencias');
const encoded=await hashPassword('Solo pruebas locales 2026');const actors={};
for(const [key,nombre,rol] of [['admin','Administración de pruebas','Administrador'],['worker','Trabajadora de pruebas','Trabajador'],['client','Cliente de pruebas','Cliente']]){
 const [result]=await db.pool.execute('INSERT INTO USUARIO(id_rol,nombre,correo,contrasena_hash) SELECT id_rol,?,?,? FROM ROL WHERE nombre=?',[nombre,key+'@example.test',encoded,rol]);
 actors[key]={id_usuario:result.insertId,rol,activo:1,nombre};
}
const management=createManagement(db.pool),commerce=createCommerce(db.pool);
const communications=createCommunications(db.pool);
await communications.write(actors.admin,'guardarConfiguracionBancaria',{version:0,banco:'Banco de pruebas QA',titular:'Datos ficticios para comprobar la interfaz',clabe:'000000000000000001',instrucciones:'Solo QA; no realizar transferencias reales'},randomUUID());
const master=(accion,datos)=>management.write(actors.admin,accion,datos,randomUUID());
const flour=await master('guardarIngrediente',{nombre:'Harina de trigo · QA',unidad:'kg',existencia:'20.000',stock_minimo:'5.000'});
const cream=await master('guardarIngrediente',{nombre:'Crema para batir · QA',unidad:'litro',existencia:'8.000',stock_minimo:'2.000'});
const provider=await master('guardarProveedor',{nombre:'Insumos del obrador · QA',correo:'proveedor@example.test',telefono:'5500000000'});
const [[category]]=await db.pool.query("SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE nombre='Pasteles'");
const photo=await saveImage({buffer:await readFile(new URL('../assets/images/pink-cake.jpg',import.meta.url)),mimetype:'image/jpeg'},uploads);
const [product]=await db.pool.execute("INSERT INTO PRODUCTO(id_categoria,nombre,descripcion,precio,existencia,stock_minimo,unidad,imagen) VALUES (?,'Pastel de fresa · QA','Producto exclusivo para comprobar la interfaz',450.00,12,2,'pieza',?)",[category.id_categoria,photo]);
await master('guardarReceta',{id_producto:product.insertId,nombre:'Receta de fresa · QA',detalles:[{id_ingrediente:flour.id,cantidad:'0.500'},{id_ingrediente:cream.id,cantidad:'0.250'}]});
await commerce.write(actors.admin,'guardarCompra',{id_proveedor:provider.id,detalles:[{id_ingrediente:flour.id,cantidad:'5.000',precio_unitario:'25.00'}]},randomUUID());
await commerce.write(actors.client,'crearPedido',{tipo:'Personalizado',descripcion_personalizada:'Pastel de cumpleaños con flores rosas · QA',fecha_solicitada:'2026-12-15T12:00'},randomUUID());
const app=createApp({repository:createRepository(db.pool),sessionStore:new session.MemoryStore(),sessionSecret:'qa-operation-secret-'.repeat(4),uploadDir:uploads,referenceDir:references,rateLimits:false,operations:{management,commerce,communications}});
const server=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/__qa/cerrar'){res.end('QA cerrado');setImmediate(stop);}else app(req,res);}).listen(3002,'127.0.0.1',()=>console.log('QA de operación, base temporal: http://127.0.0.1:3002'));
const stop=()=>server.close(async()=>{await db.close();if(resolve(qaRoot).startsWith(resolve(tmpdir(),'dulcerincon-operation-preview-')))await rm(qaRoot,{recursive:true,force:true});process.exit(0);});
process.once('SIGINT',stop);process.once('SIGTERM',stop);
