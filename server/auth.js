import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';
import { validateRegistration, validateEmail } from './validation.js';
import { AppError } from './errors.js';

export const destinations = { Administrador: '/admin.html', Trabajador: '/trabajador.html', Cliente: '/cliente.html' };
const dummyHash = hashPassword(randomBytes(24).toString('hex'));
export function publicUser(user) { return { id_usuario: user.id_usuario, nombre: user.nombre, correo: user.correo, rol: user.rol }; }
export function csrfToken(req) { return req.session.csrfToken ||= randomBytes(32).toString('hex'); }
export function requireCsrf(req, res, next) {
  const supplied = req.get('X-CSRF-Token');
  const stored = req.session.csrfToken;
  if (typeof supplied !== 'string' || typeof stored !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || supplied.length !== stored.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(stored))) return next(new AppError(403, 'La sesión del formulario venció. Recarga la página e inténtalo de nuevo.'));
  next();
}
export function authMiddleware(repository) {
  async function requireUser(req, res, next) {
    if (!req.session.userId) return next(new AppError(401, 'Inicia sesión para continuar.'));
    const user = await repository.userById(req.session.userId);
    if (!user || !user.activo || !destinations[user.rol]) {
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie('dr.sid', { path: '/' });
      return next(new AppError(401, 'Inicia sesión para continuar.'));
    }
    req.user = user;
    next();
  }
  function requireAdmin(req, res, next) {
    if (req.user.rol !== 'Administrador') return next(new AppError(403, 'Esta acción requiere una cuenta de administrador.'));
    next();
  }
  return { requireUser, requireAdmin };
}
export function mountAuthRoutes(app, repository, guards, loginLimit, registerLimit) {
  app.get('/api/auth/csrf', (req, res) => res.json({ csrfToken: csrfToken(req) }));
  app.post('/api/auth/registro', registerLimit, requireCsrf, async (req, res) => {
    const data = validateRegistration(req.body);
    const hash = await hashPassword(data.contrasena);
    try {
      const id = await repository.createCustomer({ nombre: data.nombre, correo: data.correo, telefono: data.telefono, direccion: data.direccion, contrasena_hash: hash });
      const user = await repository.userById(id);
      res.status(201).json({ usuario: publicUser(user), mensaje: 'Cuenta creada. Ya puedes iniciar sesión.' });
    } catch (error) { if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'No se pudo crear la cuenta con ese correo. Intenta iniciar sesión o usa otro.'); throw error; }
  });
  app.post('/api/auth/login', loginLimit, requireCsrf, async (req, res) => {
    let correo;
    try { correo = validateEmail(req.body?.correo); } catch { throw new AppError(401, 'Correo o contraseña incorrectos.'); }
    const password = req.body?.contrasena;
    if (typeof password !== 'string' || password.length > 256) throw new AppError(401, 'Correo o contraseña incorrectos.');
    const user = await repository.userByEmail(correo);
    const valid = await verifyPassword(user?.contrasena_hash || await dummyHash, password);
    if (!user || !valid || !user.activo || !destinations[user.rol]) throw new AppError(401, 'Correo o contraseña incorrectos.');
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id_usuario;
    const token = csrfToken(req);
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ usuario: publicUser(user), destino: destinations[user.rol], csrfToken: token });
  });
  app.get('/api/auth/me', guards.requireUser, (req, res) => res.json({ usuario: publicUser(req.user), destino: destinations[req.user.rol] }));
  app.post('/api/auth/logout', requireCsrf, async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie('dr.sid', { path: '/' });
    res.json({ mensaje: 'Sesión cerrada.' });
  });
}
