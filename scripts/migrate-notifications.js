import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createPool,readConfig,configurationError} from '../server/config.js';
import {backupDatabase} from './backup.js';
import {normalizeReference} from '../server/order-policy.js';

const definitions=[
 `CREATE TABLE IF NOT EXISTS CONFIG_BANCARIA(id_config INT AUTO_INCREMENT PRIMARY KEY,version INT NOT NULL UNIQUE,banco VARCHAR(100) NOT NULL,titular VARCHAR(100) NOT NULL,clabe CHAR(18) NOT NULL,instrucciones VARCHAR(255) NOT NULL DEFAULT '',id_usuario INT NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS INTENTO_TRANSFERENCIA(id_intento BIGINT AUTO_INCREMENT PRIMARY KEY,id_pedido INT NOT NULL,referencia VARCHAR(100) NOT NULL,referencia_normalizada VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,importe DECIMAL(10,2) NOT NULL,modalidad_pago VARCHAR(20) NOT NULL,config_version INT NOT NULL,destino_snapshot JSON NOT NULL,cotizacion_version INT NOT NULL DEFAULT 0,estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',motivo VARCHAR(255) NULL,id_revisor INT NULL,id_pago BIGINT NULL UNIQUE,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,fecha_revision DATETIME NULL,FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(config_version) REFERENCES CONFIG_BANCARIA(version),FOREIGN KEY(id_revisor) REFERENCES USUARIO(id_usuario),FOREIGN KEY(id_pago) REFERENCES PAGO(id_pago),INDEX idx_intento_pedido(id_pedido,id_intento),CHECK(importe>0)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS TRANSFERENCIA_VALIDADA(referencia_normalizada VARCHAR(100) COLLATE utf8mb4_bin PRIMARY KEY,id_pago BIGINT NOT NULL UNIQUE,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_pago) REFERENCES PAGO(id_pago)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS NOTIFICACION(id_notificacion BIGINT AUTO_INCREMENT PRIMARY KEY,id_destinatario INT NOT NULL,id_pedido INT NOT NULL,id_evento BIGINT NOT NULL,tipo VARCHAR(50) NOT NULL,titulo VARCHAR(120) NOT NULL,texto VARCHAR(500) NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,leida BOOLEAN NOT NULL DEFAULT FALSE,fecha_lectura DATETIME NULL,UNIQUE KEY uk_notificacion_evento(id_evento,id_destinatario),INDEX idx_notif_usuario(id_destinatario,leida,fecha),FOREIGN KEY(id_destinatario) REFERENCES USUARIO(id_usuario),FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(id_evento) REFERENCES HISTORIAL_PEDIDO(id_historial)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS REFERENCIA_PEDIDO(id_referencia BIGINT AUTO_INCREMENT PRIMARY KEY,id_pedido INT NOT NULL,archivo VARCHAR(100) NOT NULL,hash_original CHAR(64) NOT NULL,activo BOOLEAN NOT NULL DEFAULT TRUE,id_usuario INT NOT NULL,fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(id_pedido) REFERENCES PEDIDO(id_pedido),FOREIGN KEY(id_usuario) REFERENCES USUARIO(id_usuario),INDEX idx_referencia_pedido(id_pedido,activo)) ENGINE=InnoDB`
];
export async function migrateNotifications(pool){
 const connection=await pool.getConnection();let locked=false;
 try{
  const [[lock]]=await connection.query("SELECT GET_LOCK('dulcerincon_notifications_migration',15) AS obtenido");
  if(lock.obtenido!==1)throw new Error('Hay otra preparación de notificaciones en curso.');locked=true;
  const [base]=await connection.execute('SELECT nombre FROM MIGRACION_WEB WHERE nombre=?',['operacion-integral-2026-11-06']);
  if(!base.length)throw new Error('Prepara primero la operación integral con npm.cmd run db:operacion.');
  for(const sql of definitions)await connection.query(sql);
  for(const [name,definition] of [['politica_pago','INT NOT NULL DEFAULT 0'],['modalidad_pago','VARCHAR(20) NULL'],['aceptacion_estado',"VARCHAR(40) NOT NULL DEFAULT 'Aceptado'"],['aceptado_por','INT NULL'],['aceptado_fecha','DATETIME NULL']]){
   const [found]=await connection.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='PEDIDO' AND COLUMN_NAME=?",[name]);
   if(!found.length)await connection.query('ALTER TABLE PEDIDO ADD COLUMN '+name+' '+definition);
  }
  const [quoteColumn]=await connection.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='PEDIDO' AND COLUMN_NAME='cotizacion_checkout_hash'");
  if(!quoteColumn.length)await connection.query('ALTER TABLE PEDIDO ADD COLUMN cotizacion_checkout_hash CHAR(64) NULL,ADD UNIQUE KEY uk_checkout_hash(cotizacion_checkout_hash)');
  const [journal]=await connection.execute('SELECT nombre FROM MIGRACION_WEB WHERE nombre=?',['notificaciones-transferencias-2026-11-07']);
  if(!journal.length){
   await connection.beginTransaction();
   try{
    const [payments]=await connection.query("SELECT id_pago,referencia FROM PAGO WHERE metodo_pago='Transferencia' AND referencia IS NOT NULL AND TRIM(referencia)<>'' ORDER BY id_pago");
    for(const payment of payments){let reference;try{reference=normalizeReference(payment.referencia);}catch{continue;}
     await connection.execute('INSERT IGNORE INTO TRANSFERENCIA_VALIDADA(referencia_normalizada,id_pago) VALUES (?,?)',[reference,payment.id_pago]);
    }
    await connection.execute('INSERT INTO MIGRACION_WEB(nombre) VALUES (?)',['notificaciones-transferencias-2026-11-07']);
    await connection.commit();
   }catch(error){await connection.rollback();throw error;}
  }
  // Extend existing notices without replaying historical operations.
  await connection.query('ALTER TABLE NOTIFICACION MODIFY id_pedido INT NULL, MODIFY id_evento BIGINT NULL');
  for(const [name,definition] of [['entidad',"VARCHAR(20) NOT NULL DEFAULT 'Pedido'"],['id_origen','INT NULL'],['clave_evento','VARCHAR(100) NULL']]){
   const [found]=await connection.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='NOTIFICACION' AND COLUMN_NAME=?",[name]);
   if(!found.length)await connection.query('ALTER TABLE NOTIFICACION ADD COLUMN '+name+' '+definition);
  }
  const [noticeIndex]=await connection.query("SHOW INDEX FROM NOTIFICACION WHERE Key_name='uk_notificacion_origen'");
  if(!noticeIndex.length)await connection.query('ALTER TABLE NOTIFICACION ADD UNIQUE KEY uk_notificacion_origen(id_destinatario,clave_evento)');
  await connection.execute('INSERT IGNORE INTO MIGRACION_WEB(nombre) VALUES (?)',['notificaciones-roles-2026-11-12']);
 }finally{if(locked)await connection.query("SELECT RELEASE_LOCK('dulcerincon_notifications_migration')").catch(()=>{});connection.release();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let pool;try{pool=createPool(readConfig());console.log('Respaldo previo: '+await backupDatabase(pool));await migrateNotifications(pool);console.log('Notificaciones y transferencias preparadas. Datos existentes conservados.');}
 catch(error){console.error(configurationError(error));process.exitCode=1;}finally{if(pool)await pool.end();}
}
