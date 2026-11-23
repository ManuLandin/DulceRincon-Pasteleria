import {readFile,writeFile} from 'node:fs/promises';
import {readConfig,createPool,configurationError} from '../server/config.js';
import {transaction,once} from '../server/transactions.js';
import {parseQuantity,quantity} from '../server/amounts.js';
import {backupDatabase} from './backup.js';
let pool;
try{
 if(!process.argv.includes('--apply'))throw new Error('Se requiere --apply para la carga autorizada.');
 const config=readConfig();if(config.production||config.database.database!=='pasteleria_db'||!['127.0.0.1','localhost','::1'].includes(config.database.host))throw new Error('Destino original local incorrecto.');
 const data=JSON.parse(await readFile(new URL('../docs/database/recetas-inventario-2026-11-13.json',import.meta.url),'utf8'));
 const limits={kg:[1000,25000],litro:[1000,20000],pieza:[10000,15000]};
 for(const ingredient of data.ingredientes){const n=parseQuantity(ingredient.existencia),range=limits[ingredient.unidad];if(!range||n<range[0]||n>range[1])throw new Error('Inventario fuera de rango.');}
 for(const recipe of Object.values(data.recetas))for(const [name,value] of Object.entries(recipe))if(!data.ingredientes.some(i=>i.nombre===name)||parseQuantity(value)<=0)throw new Error('Detalle de receta inválido.');
 pool=createPool(config);const [[target]]=await pool.query('SELECT DATABASE() AS name');if(target.name!=='pasteleria_db')throw new Error('Base incorrecta.');
 const [[actor]]=await pool.query("SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.activo=1 AND r.nombre='Administrador' ORDER BY u.id_usuario LIMIT 1");if(!actor)throw new Error('Falta administrador activo.');
 console.log('Respaldo privado: '+await backupDatabase(pool));
 const result=await transaction(pool,db=>once(db,actor,'altaRecetasInventario','recetas-original-20261113',data,async()=>{
  const ingredients=new Map(),created=[],restocked=[],recipes=[];
  for(const item of data.ingredientes){
   const [found]=await db.execute('SELECT * FROM INGREDIENTE WHERE nombre=? FOR UPDATE',[item.nombre]);if(found.length>1)throw new Error('Nombre de ingrediente duplicado: '+item.nombre);
   let id;
   if(found.length){
    const row=found[0];if(row.unidad!==item.unidad||!row.activo)throw new Error('Ingrediente existente incompatible: '+item.nombre);id=row.id_ingrediente;
    const current=parseQuantity(row.existencia),[min,max]=limits[item.unidad];if(current>max)throw new Error('La existencia anterior supera el rango; no se reducirá automáticamente.');
    if(current<min){
     const total=parseQuantity(item.existencia);await db.execute('UPDATE INGREDIENTE SET existencia=?,version=version+1 WHERE id_ingrediente=?',[quantity(total),id]);
     await db.execute("INSERT INTO MOVIMIENTO_INGREDIENTE(id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_usuario,motivo) VALUES (?,?,?,?,'Ajuste',?,'Reposición inicial autorizada para recetas')",[id,quantity(total-current),quantity(total),item.unidad,actor.id_usuario]);restocked.push(item.nombre);
    }
   }else{
    const [inserted]=await db.execute('INSERT INTO INGREDIENTE(nombre,unidad,existencia,stock_minimo) VALUES (?,?,?,?)',[item.nombre,item.unidad,item.existencia,item.unidad==='pieza'?'2.000':'0.500']);id=inserted.insertId;created.push(item.nombre);
    await db.execute("INSERT INTO MOVIMIENTO_INGREDIENTE(id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_usuario,motivo) VALUES (?,?,?,?,'Apertura',?,'Inventario inicial autorizado para recetas')",[id,item.existencia,item.existencia,item.unidad,actor.id_usuario]);
   }
   ingredients.set(item.nombre,id);
  }
  const [products]=await db.query('SELECT id_producto,nombre FROM PRODUCTO WHERE activo=1 FOR UPDATE');
  for(const product of products){
   const [existing]=await db.execute('SELECT r.id_receta,r.activo,COUNT(d.id_detalle_receta) AS n FROM RECETA r LEFT JOIN DETALLE_RECETA d ON d.id_receta=r.id_receta WHERE r.id_producto=? GROUP BY r.id_receta',[product.id_producto]);
   if(existing.length){if(!existing[0].activo||!Number(existing[0].n))throw new Error('Receta existente requiere revisión; no se sobrescribirá: '+product.nombre);continue;}
   const recipe=data.recetas[product.nombre];if(!recipe)throw new Error('Falta receta para '+product.nombre);
   const [saved]=await db.execute('INSERT INTO RECETA(id_producto,nombre,descripcion,rendimiento) VALUES (?,?,?,1)',[product.id_producto,'Receta base - '+product.nombre,'Ejemplo para una unidad vendible. Validar y ajustar con la receta real de la pastelería.']);
   for(const [name,value] of Object.entries(recipe))await db.execute('INSERT INTO DETALLE_RECETA(id_receta,id_ingrediente,cantidad) VALUES (?,?,?)',[saved.insertId,ingredients.get(name),value]);
   recipes.push({producto:product.nombre,id_receta:saved.insertId,ingredientes:Object.keys(recipe).length});
  }
  return {base:target.name,ingredientes_nuevos:created,ingredientes_repuestos:restocked,recetas_agregadas:recipes};
 }));
 await writeFile(new URL('../docs/database/recetas-cargadas-2026-11-13.json',import.meta.url),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify({base:result.base,ingredientes_nuevos:result.ingredientes_nuevos.length,repuestos:result.ingredientes_repuestos,recetas_agregadas:result.recetas_agregadas.length}));
}catch(error){console.error(configurationError(error));process.exitCode=1;}finally{if(pool)await pool.end();}
