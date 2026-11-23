import { AppError } from './errors.js';

function text(value, label, max, min = 1) {
  if (typeof value !== 'string') throw new AppError(400, `${label}: escribe un valor válido.`);
  const result = value.trim();
  if ([...result].length < min || [...result].length > max) throw new AppError(400, `${label}: usa entre ${min} y ${max} caracteres.`);
  return result;
}
export function integer(value, label, { min = 0, max = 2147483647, fallback } = {}) {
  if ((value === undefined || value === '') && fallback !== undefined) return fallback;
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) throw new AppError(400, `${label}: usa un número entero válido.`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new AppError(400, `${label}: valor fuera del rango permitido.`);
  return result;
}
export function validateEmail(value) {
  const correo = text(value, 'Correo electrónico', 100).toLowerCase();
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(correo)) throw new AppError(400, 'Escribe un correo electrónico válido.');
  return correo;
}
export function validatePassword(value) {
  if (typeof value !== 'string' || [...value].length < 12 || [...value].length > 128 || value.includes('\0')) throw new AppError(400, 'La contraseña debe tener entre 12 y 128 caracteres.');
  return value;
}
export function validatePersonName(value) {
  const nombre = text(value, 'Nombre', 100).normalize('NFC');
  if (!/^(?:\p{L}\p{M}*)+(?: +(?:\p{L}\p{M}*)+)*$/u.test(nombre)) throw new AppError(400, 'Nombre: utiliza solo letras y espacios, sin números ni símbolos.');
  return nombre;
}
export function validateContact(body = {}) {
  const telefono = text(body.telefono, 'Teléfono', 20);
  if (!/^\+?[0-9 ()-]+$/.test(telefono) || !/[0-9]/.test(telefono)) throw new AppError(400, 'Teléfono: escribe un número válido, sin letras.');
  return { telefono, direccion: text(body.direccion, 'Dirección', 255) };
}
export function validateRegistration(body = {}, { requireContact = true } = {}) {
  const nombre = validatePersonName(body.nombre);
  const correo = validateEmail(body.correo);
  if (typeof body.contrasena !== 'string' || [...body.contrasena].length < 12 || [...body.contrasena].length > 25 || body.contrasena.includes('\0')) throw new AppError(400, 'La contraseña debe tener entre 12 y 25 caracteres.');
  const contrasena = validatePassword(body.contrasena);
  if (contrasena !== body.confirmacion) throw new AppError(400, 'Las contraseñas no coinciden.');
  return { nombre, correo, contrasena, ...(requireContact ? validateContact(body) : {}) };
}
export function validateProduct(body = {}) {
  const nombre = text(body.nombre, 'Nombre', 100);
  const id_categoria = integer(body.id_categoria, 'Categoría', { min: 1 });
  if (!['string', 'number'].includes(typeof body.precio) || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(body.precio))) throw new AppError(400, 'Precio: usa un importe entre 0 y 99999999.99, con hasta dos decimales.');
  const precio = Number(body.precio).toFixed(2);
  const descripcion = body.descripcion === undefined ? '' : text(body.descripcion, 'Descripción', 255, 0);
  const existencia = integer(body.existencia, 'Existencia', { fallback: 0 });
  const stock_minimo = integer(body.stock_minimo, 'Stock mínimo', { fallback: 0 });
  const unidad = body.unidad === undefined || body.unidad === '' ? 'pieza' : text(body.unidad, 'Unidad', 20);
  return { nombre, id_categoria, precio, descripcion, existencia, stock_minimo, unidad };
}
export function validateCatalogQuery(query) {
  const buscar = query.buscar === undefined ? '' : text(query.buscar, 'Búsqueda', 100, 0);
  const categoria = query.categoria === undefined || query.categoria === null || query.categoria === '' ? null : integer(query.categoria, 'Categoría', { min: 1 });
  const pagina = integer(query.pagina, 'Página', { min: 1, max: 1000000, fallback: 1 });
  const limite = integer(query.limite, 'Límite', { min: 1, max: 48, fallback: 12 });
  return { buscar, categoria, pagina, limite };
}
