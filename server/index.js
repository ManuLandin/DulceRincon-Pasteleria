import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { readConfig, createPool, checkSchema,checkOperationSchema,checkNotificationsSchema, configurationError } from './config.js';
import { createRepository } from './repository.js';
import { MysqlSessionStore } from './session-store.js';
import {createManagement} from './management.js';
import {createCommerce} from './commerce.js';
import {createCommunications} from './notifications.js';

import {reconcileReferenceFiles} from './order-references.js';

let pool;
try {
  const config = readConfig();
  pool = createPool(config);
  await checkSchema(pool);
  await checkOperationSchema(pool);
  await checkNotificationsSchema(pool);
  const store = new MysqlSessionStore(pool);
  const commerce=createCommerce(pool),referenceDir=fileURLToPath(new URL('../uploads/referencias',import.meta.url));
  await reconcileReferenceFiles(commerce,referenceDir);
  const referenceCleanup=setInterval(()=>reconcileReferenceFiles(commerce,referenceDir).catch(()=>{}),60000);referenceCleanup.unref();
  const app = createApp({ repository: createRepository(pool), sessionStore: store, sessionSecret: config.sessionSecret, uploadDir: fileURLToPath(new URL('../uploads/productos', import.meta.url)),referenceDir, production: config.production,trustProxyHops:config.trustProxyHops,operations:{management:createManagement(pool),commerce,communications:createCommunications(pool)} });
  const server = app.listen(config.port, config.host, () => console.log(`Dulce Rincón: http://${config.host}:${config.port}`));
  server.on('error', async error => { clearInterval(referenceCleanup); console.error(error.code === 'EADDRINUSE' ? 'El puerto ya está ocupado. Cambia PORT en .env.' : 'No se pudo abrir el servidor.'); store.close(); await pool.end(); process.exitCode = 1; });
  const stop = () => { clearInterval(referenceCleanup);store.close(); server.close(async () => { await pool.end(); process.exit(0); }); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) { console.error(configurationError(error)); if (pool) await pool.end(); process.exitCode = 1; }
