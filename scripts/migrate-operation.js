import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readConfig,createPool,configurationError} from '../server/config.js';
import {backupDatabase} from './backup.js';

const definitions=[
 `CREATE TABLE IF NOT EXISTS MIGRACION_WEB(nombre VARCHAR(100) PRIMARY KEY,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS OPERACION(id_operacion BIGINT AUTO_INCREMENT PRIMARY KEY,id_usuario INT NOT NULL,clave VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,accion VARCHAR(64) NOT NULL,huella CHAR(64) NOT NULL,resultado JSON NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_operacion(id_usuario,clave),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS PAGO(id_pago BIGINT AUTO_INCREMENT PRIMARY KEY,id_pedido INT NULL,id_venta INT NULL,importe DECIMAL(10,2) NOT NULL,metodo_pago VARCHAR(30) NOT NULL,id_usuario INT NULL,referencia VARCHAR(100) NULL,devuelto BOOLEAN NOT NULL DEFAULT FALSE,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(id_venta) REFERENCES VENTA(id_venta),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),INDEX idx_pago_fecha(fecha),CHECK(importe>0),CHECK((id_pedido IS NOT NULL AND id_venta IS NULL) OR (id_pedido IS NULL AND id_venta IS NOT NULL))) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS DEVOLUCION(id_devolucion BIGINT AUTO_INCREMENT PRIMARY KEY,id_pedido INT NOT NULL,importe DECIMAL(10,2) NOT NULL,metodo_pago VARCHAR(30) NOT NULL,id_usuario INT NOT NULL,motivo VARCHAR(255) NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),CHECK(importe>0)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS MOVIMIENTO_INGREDIENTE(id_movimiento BIGINT AUTO_INCREMENT PRIMARY KEY,id_ingrediente INT NOT NULL,cantidad DECIMAL(12,3) NOT NULL,existencia_resultante DECIMAL(12,3) NOT NULL,unidad VARCHAR(20) NOT NULL,tipo VARCHAR(30) NOT NULL,id_compra INT NULL,id_venta INT NULL,id_usuario INT NULL,motivo VARCHAR(255) NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_ingrediente) REFERENCES INGREDIENTE(id_ingrediente),FOREIGN KEY(id_compra) REFERENCES COMPRA(id_compra),FOREIGN KEY(id_venta) REFERENCES VENTA(id_venta),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),INDEX idx_mov_ingrediente(id_ingrediente,fecha),CHECK(existencia_resultante>=0)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS MOVIMIENTO_PRODUCTO(id_movimiento BIGINT AUTO_INCREMENT PRIMARY KEY,id_producto INT NOT NULL,cantidad INT NOT NULL,existencia_resultante INT NOT NULL,tipo VARCHAR(30) NOT NULL,id_venta INT NULL,id_usuario INT NULL,motivo VARCHAR(255) NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_producto) REFERENCES PRODUCTO(id_producto),FOREIGN KEY(id_venta) REFERENCES VENTA(id_venta),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),INDEX idx_mov_producto(id_producto,fecha),CHECK(existencia_resultante>=0)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS HISTORIAL_PEDIDO(id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,id_pedido INT NOT NULL,id_usuario INT NULL,accion VARCHAR(50) NOT NULL,detalle JSON NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),INDEX idx_hist_pedido(id_pedido,id_historial)) ENGINE=InnoDB`
];

export async function migrateOperation(pool){
 const connection=await pool.getConnection();let locked=false;
 try{
  const [locks]=await connection.query("SELECT GET_LOCK('dulcerincon_operacion_migration',15) AS obtenido");
  if(locks[0].obtenido!==1)throw new Error('Hay otra migración en curso.');locked=true;
  const [duplicate]=await connection.query('SELECT id_pedido FROM VENTA WHERE id_pedido IS NOT NULL GROUP BY id_pedido HAVING COUNT(*)>1 LIMIT 1');
  if(duplicate.length)throw new Error('Hay pedidos con varias ventas previas. Requieren revisión antes de migrar; no se modificaron.');
  const [inconsistent]=await connection.query("SELECT p.id_pedido FROM PEDIDO p LEFT JOIN VENTA v ON v.id_pedido=p.id_pedido AND v.estado='Pagada' WHERE (p.estado='Cancelado' AND p.anticipo>0) OR (v.id_venta IS NOT NULL AND (p.estado<>'Despachado' OR p.anticipo<>p.total)) LIMIT 25");
  if(inconsistent.length)throw new Error('Hay pedidos históricos por conciliar: '+inconsistent.map(row=>'#'+row.id_pedido).join(', ')+'. Revisa sus estados y anticipos antes de migrar; no se modificaron esos registros.');
  const column=async(table,name,definition)=>{
   const [found]=await connection.execute('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,name]);
   if(!found.length)await connection.query('ALTER TABLE '+table+' ADD COLUMN '+name+' '+definition);
  };
  for(const sql of definitions)await connection.query(sql);
  for(const table of ['PRODUCTO','CATEGORIA_PRODUCTO','INGREDIENTE','PROVEEDOR','RECETA','USUARIO','PEDIDO','COMPRA'])await column(table,'version','INT NOT NULL DEFAULT 1');
  await column('VENTA','id_cliente','INT NULL');
  for(const [name,type] of [
   ['tipo',"VARCHAR(20) NOT NULL DEFAULT 'Catalogo'"],['descripcion_personalizada','TEXT NULL'],['fecha_solicitada','DATETIME NULL'],
   ['motivo_retraso','VARCHAR(255) NULL'],['cotizacion_estado',"VARCHAR(30) NOT NULL DEFAULT 'No aplica'"],['cotizacion_version','INT NOT NULL DEFAULT 0'],['aceptada_version','INT NULL'],['aceptada_fecha','DATETIME NULL']
  ])await column('PEDIDO',name,type);
  for(const table of ['DETALLE_PEDIDO','DETALLE_VENTA']){
   await column(table,'nombre','VARCHAR(100) NULL');
   await connection.query('ALTER TABLE '+table+' MODIFY COLUMN id_producto INT NULL');
   await connection.query('UPDATE '+table+' d JOIN PRODUCTO p ON p.id_producto=d.id_producto SET d.nombre=p.nombre WHERE d.nombre IS NULL');
  }
  const [method]=await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='VENTA' AND COLUMN_NAME='metodo_pago'");
  if(!method[0].COLUMN_TYPE.includes('Mixto'))await connection.query("ALTER TABLE VENTA MODIFY COLUMN metodo_pago ENUM('Efectivo','Tarjeta','Transferencia','Mixto') NOT NULL");
  const [index]=await connection.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='VENTA' AND INDEX_NAME='uk_venta_pedido'");
  if(!index.length)await connection.query('ALTER TABLE VENTA ADD UNIQUE KEY uk_venta_pedido(id_pedido)');
  const [fk]=await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='VENTA' AND COLUMN_NAME='id_cliente' AND REFERENCED_TABLE_NAME IS NOT NULL");
  if(!fk.length)await connection.query('ALTER TABLE VENTA ADD CONSTRAINT fk_venta_cliente FOREIGN KEY(id_cliente) REFERENCES USUARIO(id_usuario)');
  const [journal]=await connection.execute('SELECT nombre FROM MIGRACION_WEB WHERE nombre=?',['operacion-integral-2026-11-06']);
  if(!journal.length){
   const [unknown]=await connection.query("SELECT p.id_pedido FROM PEDIDO p JOIN VENTA v ON v.id_pedido=p.id_pedido WHERE v.estado='Pagada' AND p.anticipo<>p.total LIMIT 1");
   if(unknown.length)throw new Error('Hay pedidos antiguos entregados con pagos desconocidos. El respaldo está disponible; hay que conciliar esos pagos antes de continuar.');
   await connection.beginTransaction();
   try{
    await connection.query("INSERT INTO MOVIMIENTO_INGREDIENTE(id_ingrediente,cantidad,existencia_resultante,unidad,tipo,motivo) SELECT id_ingrediente,existencia,existencia,unidad,'Apertura','Saldo anterior a la operación integral' FROM INGREDIENTE WHERE existencia>0");
    await connection.query("INSERT INTO MOVIMIENTO_PRODUCTO(id_producto,cantidad,existencia_resultante,tipo,motivo) SELECT id_producto,existencia,existencia,'Apertura','Saldo anterior a la operación integral' FROM PRODUCTO WHERE existencia>0");
    await connection.query("INSERT INTO PAGO(id_pedido,importe,metodo_pago,fecha) SELECT id_pedido,anticipo,'Saldo inicial',fecha_pedido FROM PEDIDO WHERE anticipo>0 AND estado<>'Cancelado'");
    await connection.query("INSERT INTO PAGO(id_venta,importe,metodo_pago,id_usuario,fecha) SELECT id_venta,total,metodo_pago,id_usuario,fecha FROM VENTA WHERE id_pedido IS NULL AND estado='Pagada' AND total>0");
    await connection.execute('INSERT INTO MIGRACION_WEB(nombre) VALUES (?)',['operacion-integral-2026-11-06']);
    await connection.commit();
   }catch(error){await connection.rollback();throw error;}
  }
 }finally{if(locked)await connection.query("SELECT RELEASE_LOCK('dulcerincon_operacion_migration')").catch(()=>{});connection.release();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let pool;try{
  pool=createPool(readConfig());console.log('Respaldo previo: '+await backupDatabase(pool));
  await migrateOperation(pool);console.log('Operación integral preparada. Registros anteriores conservados.');
 }catch(error){console.error(configurationError(error));process.exitCode=1;}finally{if(pool)await pool.end();}
}
