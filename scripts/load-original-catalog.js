// One authorized catalog update. Does not run the large development seeder.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readConfig,createPool,configurationError} from '../server/config.js';
import {transaction,once} from '../server/transactions.js';
import {validateProduct,validateEmail} from '../server/validation.js';
import {saveImage,removeImage} from '../server/images.js';
import {backupDatabase} from './backup.js';

let pool,committed=false;const saved=[],directory=fileURLToPath(new URL('../uploads/productos/',import.meta.url));
try{
 if(!process.argv.includes('--apply'))throw new Error('Esta carga requiere --apply y autorización para el catálogo original.');
 const config=readConfig();
 if(config.production||config.database.database!=='pasteleria_db'||!['localhost','127.0.0.1','::1'].includes(config.database.host))throw new Error('La carga está limitada a la base original local pasteleria_db, fuera de producción.');
 const data=JSON.parse(await readFile(new URL('../docs/database/catalogo-original-2026-11-13.json',import.meta.url),'utf8'));
 const sources=JSON.parse(await readFile(new URL('../docs/database/catalogo-imagenes-2026-11-13.json',import.meta.url),'utf8'));
 if(data.base!=='pasteleria_db'||data.productos.length!==20||data.proveedores.length!==7)throw new Error('Cantidades de catálogo incorrectas.');
 for(const [category,min,max] of [['Pasteles',450,1500],['Galletas',50,125],['Cupcakes',35,85],['Postres',25,200]]){
  const items=data.productos.filter(p=>p.categoria===category);
  if(items.length!==5||items.some(p=>Number(p.precio)<min||Number(p.precio)>max)||items.map(p=>p.existencia).sort((a,b)=>a-b).join(',')!=='0,1,5,10,15')throw new Error('Rangos o existencias incorrectos en '+category);
 }
 if(new Set(data.productos.map(p=>p.fuente)).size!==20)throw new Error('Se requieren 20 imágenes distintas.');
 pool=createPool(config);
 const [[target]]=await pool.query('SELECT DATABASE() AS name');if(target.name!=='pasteleria_db')throw new Error('Base conectada incorrecta.');
 const [[admin]]=await pool.query("SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.activo=1 AND r.nombre='Administrador' ORDER BY u.id_usuario LIMIT 1");
 if(!admin)throw new Error('Se requiere un administrador activo para registrar las aperturas.');
 console.log('Respaldo privado: '+await backupDatabase(pool));
 const result=await transaction(pool,db=>once(db,admin,'altaCatalogoYProveedores','catalogo-original-20261113',data,async()=>{
  const [categories]=await db.query('SELECT id_categoria,nombre FROM CATEGORIA_PRODUCTO WHERE activo=1 FOR SHARE');
  const products=[],suppliers=[];
  for(const product of data.productos){
   const category=categories.find(c=>c.nombre===product.categoria);if(!category)throw new Error('Categoría no disponible: '+product.categoria);
   const valid=validateProduct({...product,id_categoria:category.id_categoria});
   const [existing]=await db.execute('SELECT id_producto FROM PRODUCTO WHERE nombre=? FOR UPDATE',[valid.nombre]);if(existing.length)throw new Error('Ya existe el producto '+valid.nombre+'. No se modificó.');
   const path=sources[product.fuente];if(!path)throw new Error('Falta fotografía: '+product.fuente);
   const image=await saveImage({buffer:await readFile(path),mimetype:path.toLowerCase().endsWith('.png')?'image/png':'image/jpeg'},directory);saved.push(image);
   const [created]=await db.execute('INSERT INTO PRODUCTO(id_categoria,nombre,descripcion,precio,existencia,stock_minimo,unidad,imagen) VALUES (?,?,?,?,?,?,?,?)',[valid.id_categoria,valid.nombre,valid.descripcion,valid.precio,valid.existencia,valid.stock_minimo,valid.unidad,image]);
   if(valid.existencia>0)await db.execute("INSERT INTO MOVIMIENTO_PRODUCTO(id_producto,cantidad,existencia_resultante,tipo,id_usuario,motivo) VALUES (?,?,?,'Apertura',?,'Existencia inicial autorizada del catálogo')",[created.insertId,valid.existencia,valid.existencia,admin.id_usuario]);
   products.push({id:created.insertId,nombre:valid.nombre,categoria:product.categoria,precio:valid.precio,existencia:valid.existencia,imagen:image});
  }
  for(const supplier of data.proveedores){
   const email=validateEmail(supplier.correo);
   const [existing]=await db.execute('SELECT id_proveedor FROM PROVEEDOR WHERE nombre=? OR correo=? FOR UPDATE',[supplier.nombre,email]);if(existing.length)throw new Error('Proveedor de ejemplo existente; no se duplicó.');
   const [created]=await db.execute('INSERT INTO PROVEEDOR(nombre,correo,telefono,direccion) VALUES (?,?,?,?)',[supplier.nombre,email,supplier.telefono,supplier.direccion]);
   suppliers.push({id:created.insertId,nombre:supplier.nombre});
  }
  return {base:target.name,productos:products,proveedores:suppliers};
 }));
 committed=true;
 await writeFile(new URL('../docs/database/catalogo-cargado-2026-11-13.json',import.meta.url),JSON.stringify(result,null,2),'utf8');
 console.log(JSON.stringify(result,null,2));
}catch(error){
 if(!committed&&!error.commitUncertain)for(const image of saved)await removeImage(image,directory).catch(()=>{});
 console.error(configurationError(error));process.exitCode=1;
}finally{if(pool)await pool.end();}
