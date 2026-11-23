import mysql from 'mysql2/promise';

export function readConfig(env = process.env) {
  if (env.DB_PASSWORD === undefined || env.DB_PASSWORD === 'CONFIGURAR_LOCALMENTE') throw new Error('Completa DB_PASSWORD en el archivo .env de esta carpeta. No envíes tu contraseña al chat.');
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.startsWith('GENERAR_')) throw new Error('Ejecuta npm run configurar para generar la configuración local.');
  const port = Number(env.PORT || 3000);
  const databasePort = Number(env.DB_PORT || 3306);
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (![0, 1].includes(trustProxyHops)) throw new Error('TRUST_PROXY_HOPS debe ser 0 o 1. Usa 1 únicamente detrás de un proxy que controle las cabeceras reenviadas.');
  if (![port, databasePort].every(n => Number.isInteger(n) && n > 0 && n <= 65535)) throw new Error('Revisa PORT y DB_PORT en .env.');
  return {
    host: env.HOST || '127.0.0.1', port, production: env.NODE_ENV === 'production', sessionSecret: env.SESSION_SECRET, trustProxyHops,
    database: { host: env.DB_HOST || '127.0.0.1', port: databasePort, user: env.DB_USER || 'root', password: env.DB_PASSWORD, database: env.DB_NAME || 'pasteleria_db', charset: 'utf8mb4', connectionLimit: 5, waitForConnections: true, queueLimit: 50, connectTimeout: 8000, multipleStatements: false }
  };
}
export function createPool(config) {
 const pool=mysql.createPool({...config.database,dateStrings:true,timezone:'-06:00'});
 pool.on('connection',connection=>connection.query("SET time_zone='-06:00'"));
 return pool;
}
export function configurationError(error) {
  if (error.code === 'ER_ACCESS_DENIED_ERROR') return 'MySQL rechazó la conexión. Revisa DB_USER y DB_PASSWORD en .env.';
  if (['ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) return 'No se pudo conectar a MySQL. Verifica que el servidor esté iniciado y revisa DB_HOST y DB_PORT.';
  if (error.code === 'ER_BAD_DB_ERROR') return 'La base indicada en DB_NAME no existe en ese servidor MySQL.';
  if (error.code === 'ER_DUP_ENTRY') return 'Ya existe una cuenta con ese correo. No se modificó la cuenta anterior.';
  if (error.status || !error.code) return error.message;
  return 'No se pudo completar la configuración. Revisa la conexión y las tablas del esquema compartido.';
}
export async function checkSchema(pool, { migrated = true } = {}) {
  const [tables] = await pool.execute("SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ROL','USUARIO','PRODUCTO','CATEGORIA_PRODUCTO')");
  if (tables.length !== 4) throw new Error('Faltan tablas del esquema original. Comprueba ROL, USUARIO, PRODUCTO y CATEGORIA_PRODUCTO.');
  const [roles] = await pool.execute('SELECT nombre FROM ROL WHERE nombre IN (?, ?, ?)', ['Administrador', 'Trabajador', 'Cliente']);
  if (roles.length !== 3) throw new Error('Faltan los roles Administrador, Trabajador o Cliente del SQL original.');
  const [columns] = await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PRODUCTO' AND COLUMN_NAME = 'imagen'");
  const [sessions] = await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SESION_WEB'");
  if (migrated && (!columns.length || !sessions.length)) throw new Error('La conexión funciona, pero falta la migración. Ejecuta npm run db:migrate.');
  return { imagen: columns.length > 0, sesiones: sessions.length > 0 };
}

export async function checkOperationSchema(pool){
 const [tables]=await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('OPERACION','PAGO','DEVOLUCION','MOVIMIENTO_INGREDIENTE','MOVIMIENTO_PRODUCTO','HISTORIAL_PEDIDO','MIGRACION_WEB')");
 if(tables.length!==7)throw new Error('Falta la preparación de operación integral. Ejecuta npm.cmd run db:operacion.');
 const [journal]=await pool.execute('SELECT nombre FROM MIGRACION_WEB WHERE nombre=?',['operacion-integral-2026-11-06']);
 if(!journal.length)throw new Error('La migración de operación no terminó. Ejecuta npm.cmd run db:operacion.');
}
export async function checkNotificationsSchema(pool){
 const [tables]=await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('CONFIG_BANCARIA','INTENTO_TRANSFERENCIA','TRANSFERENCIA_VALIDADA','NOTIFICACION','REFERENCIA_PEDIDO')");
 if(tables.length!==5)throw new Error('Falta preparar notificaciones y transferencias. Ejecuta npm.cmd run db:notificaciones.');
 const [journal]=await pool.execute('SELECT nombre FROM MIGRACION_WEB WHERE nombre=?',['notificaciones-roles-2026-11-12']);
 if(!journal.length)throw new Error('La preparación de notificaciones no terminó. Ejecuta npm.cmd run db:notificaciones.');
}
