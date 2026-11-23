import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { authMiddleware, mountAuthRoutes, destinations } from './auth.js';
import { mountProductRoutes } from './products.js';
import { mountOperations } from './operations.js';
import {mountReferenceRoutes} from './order-references.js';
import { AppError } from './errors.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export function createApp({ repository, sessionStore, sessionSecret, uploadDir, referenceDir = join(root,'uploads','referencias'), production = false, trustProxyHops = 0, rateLimits = true, logger = console, operations }) {
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.');
  const app = express();
  if (![0, 1].includes(trustProxyHops)) throw new Error('Configuración de proxy no admitida.');
  // Alwaysdata elimina las cabeceras entrantes y las establece en su proxy frontal.
  // Activar explícitamente solo cuando el servidor esté detrás de ese proxy.
  if (trustProxyHops) app.set('trust proxy', trustProxyHops);
  app.disable('x-powered-by');
  app.use(helmet({
    strictTransportSecurity: production ? undefined : false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'"], connectSrc: ["'self'"],
      objectSrc: ["'none'"], formAction: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: production ? [] : null
    } }
  }));
  app.use('/assets', express.static(join(root, 'assets'), { dotfiles: 'deny', index: false }));
  app.use('/uploads/productos', (req, res, next) => /^\/[a-f0-9-]{36}\.webp$/.test(req.path) ? next() : res.sendStatus(404), express.static(uploadDir, { dotfiles: 'deny', index: false, immutable: true, maxAge: '1y' }));
  app.use(express.json({ limit: '16kb' }));
  app.use(session({
    name: 'dr.sid', secret: sessionSecret, store: sessionStore,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 8 * 60 * 60 * 1000 }
  }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = (limit, windowMs, skipSuccessfulRequests = false) => rateLimits ? rateLimit({
    windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests,
    handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' })
  }) : (req, res, next) => next();
  const guards = authMiddleware(repository);
  mountAuthRoutes(app, repository, guards, limiter(10, 15 * 60 * 1000, true), limiter(5, 60 * 60 * 1000));
  mountProductRoutes(app, repository, guards, uploadDir, limiter(30, 15 * 60 * 1000));
  if(operations)mountOperations(app,operations,guards,limiter(300,15*60*1000));
  if(typeof operations?.commerce?.createWithReferences==='function')mountReferenceRoutes(app,operations.commerce,guards,referenceDir,limiter(30,15*60*1000));
  const page = name => (req, res) => res.sendFile(join(root, name));
  app.get('/', page('index.html'));
  app.get('/index.html', page('index.html'));
  for (const name of ['login.html', 'registro.html']) app.get('/' + name, page(name));
  for (const [role, destination] of Object.entries(destinations)) {
    app.get(destination, async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const user = req.session.userId ? await repository.userById(req.session.userId) : null;
      if (!user || !user.activo || !destinations[user.rol]) return res.redirect('/login.html');
      if (user.rol !== role) return res.redirect(destinations[user.rol]);
      res.sendFile(join(root, destination.slice(1)));
    });
  }
  app.use((req, res) => res.status(404).json({ error: 'No se encontró este recurso.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) {
      const large = error.code === 'LIMIT_FILE_SIZE';
      return res.status(large ? 413 : 400).json({ error: large ? 'La fotografía supera el límite de 5 MB.' : 'Sube una sola fotografía y revisa los campos del formulario.' });
    }
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message,...(error.priceChanged?{reconfirmar_importe:true}:{}) });
    if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Ya existe un registro con esos datos. Revisa el correo o la operación antes de continuar.'});
    if(['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(error.code))return res.status(409).json({error:'El registro está relacionado con otros datos. Actualiza la lista y vuelve a intentarlo.'});
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'El formulario supera el tamaño permitido.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'El formulario contiene datos inválidos.' });
    const code = typeof error.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'UNAVAILABLE';
    logger.error(`[backend] No se pudo completar una operación (${code}).`);
    res.status(503).json({ error: 'No pudimos completar la operación. Inténtalo de nuevo; si persiste, revisa la conexión del servidor.' });
  });
  return app;
}
