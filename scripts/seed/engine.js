import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashPassword} from '../../server/passwords.js';
import {validatePassword} from '../../server/validation.js';
import {money,quantity,parseMoney} from '../../server/amounts.js';
import {depositCents} from '../../server/order-policy.js';
import {saveImage,removeImage} from '../../server/images.js';
import {checkSchema,checkOperationSchema,checkNotificationsSchema} from '../../server/config.js';
import {transaction} from '../../server/transactions.js';
import {assertSeedEnvironment,buildDataset,SEED_KEY,SEED_ACTION,DEMO} from './data.js';

const keys={USUARIO:'id_usuario',PROVEEDOR:'id_proveedor',INGREDIENTE:'id_ingrediente',PRODUCTO:'id_producto',RECETA:'id_receta',DETALLE_RECETA:'id_detalle_receta',PEDIDO:'id_pedido',DETALLE_PEDIDO:'id_detalle_pedido',VENTA:'id_venta',DETALLE_VENTA:'id_detalle_venta',PAGO:'id_pago',TRANSFERENCIA_VALIDADA:'referencia_normalizada',MOVIMIENTO_PRODUCTO:'id_movimiento',MOVIMIENTO_INGREDIENTE:'id_movimiento',HISTORIAL_PEDIDO:'id_historial'};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const q=async(db,sql,params=[]) =>(await db.execute(sql,params))[0];
const slots=values=>values.map(()=>'?').join(',');
const ids=(manifest,table)=>manifest.entries.filter(e=>e.table===table).map(e=>e.id);
const safeIdentifier=s=>{if(!/^[a-zA-Z0-9_]+$/.test(s))throw new Error('Identificador de esquema no admitido.');return '`'+s+'`';};

async function marker(db){
 const found=await q(db,'SELECT id_operacion,id_usuario,resultado FROM OPERACION WHERE clave=? AND accion=? FOR UPDATE',[SEED_KEY,SEED_ACTION]);
 if(found.length>1)throw new Error('Hay marcadores duplicados del seeder. Requieren revisión.');
 if(!found.length)return null;
 let manifest=found[0].resultado;if(typeof manifest==='string')manifest=JSON.parse(manifest);
 if(manifest?.version!==1||!Array.isArray(manifest.entries)||manifest.entries.some(e=>!keys[e.table]||!e.id||!/^[a-f0-9]{64}$/.test(e.hash)))throw new Error('Manifiesto del seeder inválido. No se modificó ningún registro.');
 return {...found[0],manifest};
}
async function verify(db,manifest){
 for(const entry of manifest.entries){
  const [row]=await q(db,`SELECT * FROM ${entry.table} WHERE ${keys[entry.table]}=? FOR UPDATE`,[entry.id]);
  if(!row||hash(row)!==entry.hash)throw new Error(`Registro ${entry.table} modificado o ausente. Se detuvo la operación para conservar actividad posterior.`);
 }
 const users=ids(manifest,'USUARIO');
 const roles=await q(db,`SELECT r.nombre,COUNT(*) AS n FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario IN (${slots(users)}) GROUP BY r.nombre`,users);
 const roleCounts=Object.fromEntries(roles.map(row=>[row.nombre,Number(row.n)]));
 if(roleCounts.Administrador!==1||roleCounts.Trabajador!==3||roleCounts.Cliente!==5)throw new Error('Roles del lote inconsistentes.');
 for(const [header,detail,key] of [['VENTA','DETALLE_VENTA','id_venta'],['PEDIDO','DETALLE_PEDIDO','id_pedido']]){
  const values=ids(manifest,header);
  const mismatches=await q(db,`SELECT h.${key} FROM ${header} h LEFT JOIN ${detail} d ON d.${key}=h.${key} WHERE h.${key} IN (${slots(values)}) GROUP BY h.${key},h.total HAVING COUNT(d.${key})=0 OR SUM(d.subtotal)<>h.total`,values);
  if(mismatches.length)throw new Error('Totales inconsistentes en '+header);
 }
 for(const [table,movement,key] of [['PRODUCTO','MOVIMIENTO_PRODUCTO','id_producto'],['INGREDIENTE','MOVIMIENTO_INGREDIENTE','id_ingrediente']]){
  const values=ids(manifest,table);
  const invalid=await q(db,`SELECT p.${key} FROM ${table} p LEFT JOIN ${movement} m ON m.${key}=p.${key} WHERE p.${key} IN (${slots(values)}) GROUP BY p.${key},p.existencia HAVING COALESCE(SUM(m.cantidad),0)<>p.existencia`,values);
  if(invalid.length)throw new Error('Inventario y movimientos no coinciden en '+table);
 }
 const orders=ids(manifest,'PEDIDO');
 const invalid=await q(db,`SELECT p.id_pedido FROM PEDIDO p LEFT JOIN PAGO a ON a.id_pedido=p.id_pedido AND a.devuelto=0 WHERE p.id_pedido IN (${slots(orders)}) GROUP BY p.id_pedido,p.anticipo HAVING COALESCE(SUM(a.importe),0)<>p.anticipo`,orders);
 if(invalid.length)throw new Error('Pagos y anticipos no coinciden.');
 return {valid:true,counts:manifest.counts,anchor:manifest.anchor};
}
async function checkExternalDependencies(db,record){
 const {manifest}=record,owned=new Map(Object.keys(keys).map(table=>[table,new Set(ids(manifest,table).map(String))]));
 owned.set('OPERACION',new Set([String(record.id_operacion)]));
 const references=await q(db,"SELECT TABLE_NAME AS child,COLUMN_NAME AS field,REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
 for(const ref of references){
  // MySQL on Windows reports lower-case table names even for upper-case DDL.
  const child=ref.child.toUpperCase(),parentIds=ids(manifest,ref.parent.toUpperCase());if(!parentIds.length)continue;
  const rows=await q(db,`SELECT * FROM ${safeIdentifier(ref.child)} WHERE ${safeIdentifier(ref.field)} IN (${slots(parentIds)}) FOR UPDATE`,parentIds);
  const key=child==='OPERACION'?'id_operacion':keys[child];
  if(rows.some(row=>!key||!owned.get(child)?.has(String(row[key]))))throw new Error('Dependencia posterior en '+ref.child+'. No se puede revertir sin afectar actividad ajena.');
 }
 const users=ids(manifest,'USUARIO');
 const sessions=await q(db,`SELECT session_id FROM SESION_WEB WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(data),data,'{}'),'$.userId')) IN (${slots(users)}) LIMIT 1 FOR UPDATE`,users.map(String));
 if(sessions.length)throw new Error('Dependencia de sesión activa: cierra las sesiones de las cuentas de prueba antes de revertir.');
 // Generic notification origins deliberately have no FK. Never leave one dangling.
 const sales=ids(manifest,'VENTA');
 const notices=await q(db,`SELECT id_notificacion FROM NOTIFICACION WHERE entidad='Venta' AND id_origen IN (${slots(sales)}) LIMIT 1 FOR UPDATE`,sales);
 if(notices.length)throw new Error('Dependencia de notificación posterior. No se revirtió el lote.');
}

async function load(db,dataset,photo,password){
 const entries=[],counts={},roles=new Map((await q(db,'SELECT id_rol,nombre FROM ROL')).map(r=>[r.nombre,r.id_rol]));
 const [category]=await q(db,"SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE nombre='Pasteles' AND activo=1 FOR SHARE");
 if(!category||['Administrador','Trabajador','Cliente'].some(role=>!roles.has(role)))throw new Error('Faltan roles o categoría Pasteles activa; no se crearán ni cambiarán catálogos existentes.');
 const insert=async(table,data)=>{
  const columns=Object.keys(data),result=await q(db,`INSERT INTO ${table} (${columns.join(',')}) VALUES (${slots(columns)})`,Object.values(data));
  const id=table==='TRANSFERENCIA_VALIDADA'?data.referencia_normalizada:result.insertId;
  entries.push({table,id});counts[table]=(counts[table]||0)+1;return id;
 };
 const users=[],products=[],ingredients=[],orders=[];
 const start=[...dataset.orders.map(o=>o.date),...dataset.sales.map(s=>s.date)].sort()[0].slice(0,10)+' 08:00:00';
 for(const user of dataset.users){
  if((await q(db,'SELECT id_usuario FROM USUARIO WHERE correo=? FOR UPDATE',[user.email])).length)throw new Error('Colisión con una cuenta existente. No se sobrescriben usuarios.');
  users.push(await insert('USUARIO',{id_rol:roles.get(user.role),nombre:user.name,correo:user.email,contrasena_hash:await hashPassword(password),telefono:'0000000000',direccion:'Cuenta ficticia de demostración',fecha_registro:start}));
 }
 const admin=users[0];
 for(const supplier of dataset.suppliers){
  if((await q(db,'SELECT id_proveedor FROM PROVEEDOR WHERE nombre=? OR correo=? FOR UPDATE',[supplier.name,supplier.email])).length)throw new Error('Colisión con proveedor de demostración existente.');
  await insert('PROVEEDOR',{nombre:supplier.name,correo:supplier.email,telefono:supplier.phone,direccion:supplier.address});
 }
 for(const ingredient of dataset.ingredients){
  if((await q(db,'SELECT id_ingrediente FROM INGREDIENTE WHERE nombre=? FOR UPDATE',[ingredient.name])).length)throw new Error('Colisión con ingrediente existente.');
  const id=await insert('INGREDIENTE',{nombre:ingredient.name,unidad:ingredient.unit,existencia:quantity(ingredient.opening),stock_minimo:quantity(ingredient.minimum)});ingredients.push({id,balance:ingredient.opening,unit:ingredient.unit});
  await insert('MOVIMIENTO_INGREDIENTE',{id_ingrediente:id,cantidad:quantity(ingredient.opening),existencia_resultante:quantity(ingredient.opening),unidad:ingredient.unit,tipo:'Apertura',id_usuario:admin,motivo:DEMO+'Apertura de inventario',fecha:start});
 }
 for(const product of dataset.products){
  if((await q(db,'SELECT id_producto FROM PRODUCTO WHERE nombre=? FOR UPDATE',[product.name])).length)throw new Error('Colisión con producto existente.');
  const id=await insert('PRODUCTO',{id_categoria:category.id_categoria,nombre:product.name,descripcion:product.description,precio:money(product.price),existencia:product.opening,stock_minimo:2,unidad:'pieza',imagen:photo});products.push({id,balance:product.opening});
  await insert('MOVIMIENTO_PRODUCTO',{id_producto:id,cantidad:product.opening,existencia_resultante:product.opening,tipo:'Apertura',id_usuario:admin,motivo:DEMO+'Apertura de inventario',fecha:start});
  const recipe=await insert('RECETA',{id_producto:id,nombre:DEMO+'Receta '+product.name.slice(DEMO.length),descripcion:'Receta simplificada de demostración; validar cantidades para producción.',rendimiento:1});
  for(const [index,mills] of [[0,250],[1,180],[2,3000],[product.flavor,150]])await insert('DETALLE_RECETA',{id_receta:recipe,id_ingrediente:ingredients[index].id,cantidad:quantity(mills)});
 }
 const details=async(table,key,id,lines)=>{for(const line of lines)await insert(table,{[key]:id,id_producto:products[line.product].id,nombre:dataset.products[line.product].name,cantidad:line.quantity,precio_unitario:money(line.price)});};
 const payment=async(data)=>{const id=await insert('PAGO',data);if(data.metodo_pago==='Transferencia')await insert('TRANSFERENCIA_VALIDADA',{referencia_normalizada:data.referencia,id_pago:id,fecha:data.fecha});return id;};
 for(const order of dataset.orders){
  const deposit=depositCents(order.total,'Efectivo'),paid=order.state==='Despachado'?order.total:deposit;
  const id=await insert('PEDIDO',{id_cliente:users[order.client],id_trabajador:users[order.worker],fecha_pedido:order.date,fecha_solicitada:order.pickup,fecha_entrega:order.pickup,estado:order.state,total:money(order.total),anticipo:money(paid),observaciones:DEMO+'Importación histórica con transferencia verificada; sin validación bancaria pendiente.',politica_pago:0,aceptacion_estado:'Aceptado',modalidad_pago:'Efectivo'});orders.push(id);
  await details('DETALLE_PEDIDO','id_pedido',id,order.lines);
  await payment({id_pedido:id,importe:money(deposit),metodo_pago:'Transferencia',id_usuario:users[order.worker],referencia:'SEED-V1-PEDIDO-'+order.key,fecha:order.date});
  await insert('HISTORIAL_PEDIDO',{id_pedido:id,id_usuario:users[order.worker],accion:'Creación',detalle:JSON.stringify({origen:SEED_KEY,importacion_historica:true,estado:'Pendiente'}),fecha:order.date});
  if(order.state!=='Pendiente')await insert('HISTORIAL_PEDIDO',{id_pedido:id,id_usuario:users[order.worker],accion:'Actualización',detalle:JSON.stringify({estado:'En progreso'}),fecha:order.date.slice(0,10)+' 13:00:00'});
  if(order.state==='Despachado'){
   await insert('HISTORIAL_PEDIDO',{id_pedido:id,id_usuario:users[order.worker],accion:'Actualización',detalle:JSON.stringify({estado:'Listo'}),fecha:order.pickup.slice(0,10)+' 10:00:00'});
   await payment({id_pedido:id,importe:money(order.total-deposit),metodo_pago:'Efectivo',id_usuario:users[order.worker],fecha:order.pickup});
  }
 }
 for(const sale of dataset.sales){
  const id=await insert('VENTA',{id_usuario:users[sale.worker],id_cliente:sale.client===null?null:users[sale.client],id_pedido:sale.order===null?null:orders[sale.order],fecha:sale.date,total:money(sale.total),metodo_pago:sale.order===null?'Efectivo':'Mixto'});
  await details('DETALLE_VENTA','id_venta',id,sale.lines);
  if(sale.order===null)await payment({id_venta:id,importe:money(sale.total),metodo_pago:'Efectivo',id_usuario:users[sale.worker],fecha:sale.date});
  else await insert('HISTORIAL_PEDIDO',{id_pedido:orders[sale.order],id_usuario:users[sale.worker],accion:'Entrega',detalle:JSON.stringify({id_venta:id}),fecha:sale.date});
  const consumed=new Map();
  for(const line of sale.lines){
   const product=products[line.product];product.balance-=line.quantity;if(product.balance<0)throw new Error('Stock de demostración insuficiente.');
   await q(db,'UPDATE PRODUCTO SET existencia=? WHERE id_producto=?',[product.balance,product.id]);
   await insert('MOVIMIENTO_PRODUCTO',{id_producto:product.id,cantidad:-line.quantity,existencia_resultante:product.balance,tipo:'Venta',id_venta:id,id_usuario:users[sale.worker],motivo:DEMO+'Consumo de venta',fecha:sale.date});
   for(const [index,mills] of [[0,250],[1,180],[2,3000],[dataset.products[line.product].flavor,150]])consumed.set(index,(consumed.get(index)||0)+mills*line.quantity);
  }
  for(const [index,mills] of consumed){const ingredient=ingredients[index];ingredient.balance-=mills;if(ingredient.balance<0)throw new Error('Ingrediente insuficiente.');
   await q(db,'UPDATE INGREDIENTE SET existencia=? WHERE id_ingrediente=?',[quantity(ingredient.balance),ingredient.id]);
   await insert('MOVIMIENTO_INGREDIENTE',{id_ingrediente:ingredient.id,cantidad:quantity(-mills),existencia_resultante:quantity(ingredient.balance),unidad:ingredient.unit,tipo:'Venta',id_venta:id,id_usuario:users[sale.worker],motivo:DEMO+'Consumo de receta',fecha:sale.date});
  }
 }
 for(const entry of entries){const [row]=await q(db,`SELECT * FROM ${entry.table} WHERE ${keys[entry.table]}=?`,[entry.id]);entry.hash=hash(row);}
 const manifest={version:1,anchor:dataset.anchor,photo,entries,counts:{...counts,OPERACION:1}};
 await verify(db,manifest);
 await q(db,'INSERT INTO OPERACION(id_usuario,clave,accion,huella,resultado) VALUES (?,?,?,?,?)',[admin,SEED_KEY,SEED_ACTION,hash(SEED_KEY),JSON.stringify(manifest)]);
 return manifest;
}

const cleanupName=/^\.seed-cleanup-[a-f0-9-]{36}\.json$/;
async function reconcileImages(pool,database,directory){
 let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const file of files.filter(name=>cleanupName.test(name))){
  const path=join(directory,file),task=JSON.parse(await readFile(path,'utf8'));
  if(task.database!==database)continue;
  if(!/^\/uploads\/productos\/[a-f0-9-]{36}\.webp$/.test(task.photo))throw new Error('Manifiesto de limpieza inválido.');
  // If the database cannot confirm the result, both the file and task survive.
  const [remaining]=await q(pool,'SELECT COUNT(*) AS n FROM PRODUCTO WHERE imagen=?',[task.photo]);
  if(!Number(remaining.n))await removeImage(task.photo,directory);
  await unlink(path);
 }
}
export async function runSeed({pool,config,env,action='seed',anchor,uploadDir=fileURLToPath(new URL('../../uploads/productos',import.meta.url))}){
 const database=assertSeedEnvironment(config,env);
 if(!['seed','verify','undo'].includes(action))throw new Error('Acción de seeder no válida.');
 if(action==='seed')validatePassword(env.SEED_PASSWORD);
 const [[connected]]=await pool.query('SELECT DATABASE() AS name');if(connected.name!==database)throw new Error('La base conectada no coincide con el entorno de desarrollo confirmado.');
 await checkSchema(pool);await checkOperationSchema(pool);await checkNotificationsSchema(pool);
 const lock=await pool.getConnection();let photo,committed=false,ownsLock=false;
 const schedule=async image=>writeFile(join(uploadDir,'.seed-cleanup-'+randomUUID()+'.json'),JSON.stringify({database,photo:image}),{flag:'wx'});
 try{
  const [[locked]]=await lock.query('SELECT GET_LOCK(?,10) AS ok',['seed:'+database]);if(locked.ok!==1)throw new Error('Otra carga o reversión está en curso.');
  ownsLock=true;
  await reconcileImages(pool,database,uploadDir);
  const result=await transaction(pool,async db=>{
   const previous=await marker(db);
   if(previous){
    const verified=await verify(db,previous.manifest);
    if(action!=='undo')return {...verified,alreadySeeded:true,inserted:{}};
    await checkExternalDependencies(db,previous);
    const outside=await q(db,`SELECT id_producto FROM PRODUCTO WHERE imagen=? AND id_producto NOT IN (${slots(ids(previous.manifest,'PRODUCTO'))}) LIMIT 1 FOR UPDATE`,[previous.manifest.photo,...ids(previous.manifest,'PRODUCTO')]);
    if(outside.length)throw new Error('Dependencia de fotografía reutilizada por otro producto.');
    await schedule(previous.manifest.photo);
    await q(db,'DELETE FROM OPERACION WHERE id_operacion=?',[previous.id_operacion]);
    for(const entry of [...previous.manifest.entries].reverse())await q(db,`DELETE FROM ${entry.table} WHERE ${keys[entry.table]}=?`,[entry.id]);
    photo=previous.manifest.photo;return {removed:previous.manifest.counts};
   }
   if(action==='undo'){
    const suspicious=await q(db,"SELECT id_usuario FROM USUARIO WHERE correo LIKE '%.seed-v1@example.test' LIMIT 1");
    const products=await q(db,'SELECT id_producto FROM PRODUCTO WHERE nombre LIKE ? LIMIT 1',[DEMO+'%']);
    if(suspicious.length||products.length)throw new Error('Falta el manifiesto y hay registros con identidad de demostración. No se eliminarán por nombre ni por prefijo.');
    return {alreadyRemoved:true};
   }
   if(action==='verify')throw new Error('No hay un lote de demostración instalado en esta base.');
   photo=await saveImage({buffer:await readFile(new URL('../../assets/images/pink-cake.jpg',import.meta.url)),mimetype:'image/jpeg'},uploadDir);
   await schedule(photo);
   const manifest=await load(db,buildDataset(anchor),photo,env.SEED_PASSWORD);
   return {inserted:manifest.counts,anchor:manifest.anchor,valid:true};
  });
  committed=true;
  await reconcileImages(pool,database,uploadDir);
  return result;
 }catch(error){
  if(ownsLock&&!committed&&!error.commitUncertain){
   if(photo&&action==='seed')await removeImage(photo,uploadDir);
   await reconcileImages(pool,database,uploadDir);
  }
  // An uncertain COMMIT retains its image: the durable manifest resolves retries.
  throw error;
 }finally{if(ownsLock)await lock.query('SELECT RELEASE_LOCK(?)',['seed:'+database]).catch(()=>{});lock.release();}
}
