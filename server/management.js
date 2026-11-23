import { AppError } from './errors.js';
import { integer, validateEmail, validatePassword, validateContact, validatePersonName } from './validation.js';
import { hashPassword } from './passwords.js';
import { parseMoney, parseQuantity, money, quantity } from './amounts.js';
import { transaction, once } from './transactions.js';

const resources = new Set(['productos', 'categorias', 'ingredientes', 'recetas', 'proveedores', 'trabajadores', 'clientes', 'cliente', 'movimientos']);
const actions = new Set(['guardarProducto', 'guardarCategoria', 'guardarIngrediente', 'ajustarIngrediente', 'ajustarProducto', 'guardarReceta', 'guardarProveedor', 'guardarTrabajador', 'guardarCliente']);
const userColumns = 'u.id_usuario,u.nombre,u.correo,u.telefono,u.direccion,u.activo,u.fecha_registro,u.version,r.nombre AS rol';
const config = {
  productos: { table: 'PRODUCTO', alias: 'p', id: 'id_producto', columns: 'p.id_producto,p.id_categoria,p.nombre,p.descripcion,p.precio,p.existencia,p.stock_minimo,p.unidad,p.imagen,p.activo,p.version,c.nombre AS categoria', join: ' JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria' },
  categorias: { table: 'CATEGORIA_PRODUCTO', alias: 'c', id: 'id_categoria', columns: 'c.id_categoria,c.nombre,c.descripcion,c.activo,c.version' },
  ingredientes: { table: 'INGREDIENTE', alias: 'i', id: 'id_ingrediente', columns: 'i.id_ingrediente,i.nombre,i.unidad,i.existencia,i.stock_minimo,i.activo,i.version' },
  recetas: { table: 'RECETA', alias: 'r', id: 'id_receta', columns: 'r.id_receta,r.id_producto,r.nombre,r.descripcion,r.rendimiento,r.activo,r.version,p.nombre AS producto', join: ' JOIN PRODUCTO p ON p.id_producto=r.id_producto' },
  proveedores: { table: 'PROVEEDOR', alias: 'p', id: 'id_proveedor', columns: 'p.id_proveedor,p.nombre,p.telefono,p.correo,p.direccion,p.activo,p.version' },
  trabajadores: { table: 'USUARIO', alias: 'u', id: 'id_usuario', columns: userColumns, join: ' JOIN ROL r ON r.id_rol=u.id_rol', role: 'Trabajador' },
  clientes: { table: 'USUARIO', alias: 'u', id: 'id_usuario', columns: userColumns, join: ' JOIN ROL r ON r.id_rol=u.id_rol', role: 'Cliente' }
};
function text(value, label, max = 100, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.includes('\0') || [...value.trim()].length > max || (!optional && !value.trim())) throw new AppError(400, `${label}: escribe un valor válido de hasta ${max} caracteres.`);
  return value.trim();
}
function active(value, fallback = 1) {
  if (value === undefined) return fallback;
  if (![true, false, 0, 1, '0', '1'].includes(value)) throw new AppError(400, 'Activo: selecciona un estado válido.');
  return value === true || value === 1 || value === '1' ? 1 : 0;
}
const idValue = value => integer(value, 'Identificador', { min: 1 });
function checkVersion(row, data) {
  if (integer(data.version, 'Versión', { min: 1 }) !== row.version) throw new AppError(409, 'El registro cambió. Recarga los datos antes de guardar.');
}
function authorized(actor) {
  if (!actor || !['Administrador', 'Trabajador', 'Cliente'].includes(actor.rol) || actor.activo === false || actor.activo === 0) throw new AppError(401, 'Inicia sesión para continuar.');
}
function adminOnly(actor) { if (actor.rol !== 'Administrador') throw new AppError(403, 'Esta acción requiere una cuenta de administrador.'); }
async function rows(db, sql, values = []) { return (await db.execute(sql, values))[0]; }
async function locked(db, table, idName, id) {
  // table/idName are internal constants, never request values.
  const found = await rows(db, `SELECT ${idName},version,activo${table === 'INGREDIENTE' ? ',existencia,unidad' : table === 'PRODUCTO' ? ',existencia' : ''} FROM ${table} WHERE ${idName}=? FOR UPDATE`, [id]);
  if (!found.length) throw new AppError(404, 'No se encontró el registro.');
  return found[0];
}
function pageOptions(query) {
  return { pagina: integer(query.pagina, 'Página', { min: 1, max: 1000000, fallback: 1 }), limite: integer(query.limite, 'Límite', { min: 1, max: 100, fallback: 20 }) };
}
function like(value) { return '%' + value.replace(/[!%_]/g, '!$&') + '%'; }
function signedQuantity(value) { return value < 0 ? '-' + quantity(-value) : quantity(value); }

export function createManagement(pool) {
  async function recipeDetails(db, recipe) {
    recipe.detalles = await rows(db, 'SELECT d.id_ingrediente,d.cantidad,i.nombre,i.unidad,i.existencia,i.activo FROM DETALLE_RECETA d JOIN INGREDIENTE i ON i.id_ingrediente=d.id_ingrediente WHERE d.id_receta=? ORDER BY d.id_ingrediente', [recipe.id_receta]);
    return recipe;
  }
  async function productDetails(product) {
    const recipes = await rows(pool, 'SELECT id_receta,id_producto,nombre,descripcion,rendimiento,activo,version FROM RECETA WHERE id_producto=?', [product.id_producto]);
    product.receta = recipes[0] ? await recipeDetails(pool, recipes[0]) : null;
    let available = product.existencia;
    let reason = '';
    if (!product.receta || !product.receta.activo || !product.receta.detalles.length) { available = 0; reason = 'Falta configurar una receta activa.'; }
    else for (const detail of product.receta.detalles) {
      if (!detail.activo) { available = 0; reason = 'La receta contiene un ingrediente inactivo.'; break; }
      const stock = BigInt(parseQuantity(detail.existencia));
      const use = BigInt(parseQuantity(detail.cantidad));
      // Same commercial rounding used by commerce, per ingredient and operation.
      const yieldCount = BigInt(product.receta.rendimiento);
      const maxForIngredient = Number(((stock + 1n) * yieldCount - (yieldCount / 2n) - 1n) / use);
      available = Math.min(available, Math.max(0, maxForIngredient));
    }
    if (!reason && available === 0) reason = 'Existencias insuficientes.';
    product.disponibilidad = { unidades: available, puede_vender: available > 0, motivo: reason };
    return product;
  }
  async function customerFile(actor, query) {
    const id = idValue(query.id ?? actor.id_usuario);
    if (actor.rol === 'Cliente' && id !== actor.id_usuario) throw new AppError(403, 'Solo puedes consultar tu propia cuenta.');
    if (actor.rol === 'Trabajador') throw new AppError(403, 'La ficha completa requiere una cuenta de administrador.');
    const users = await rows(pool, `SELECT ${userColumns} FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? AND r.nombre=?`, [id, 'Cliente']);
    if (!users.length) throw new AppError(404, 'No se encontró el cliente.');
    // Independent queries deliberately avoid multiplying sales by orders or payments.
    const ventas = await rows(pool, 'SELECT id_venta,id_pedido,fecha,total,metodo_pago,estado FROM VENTA WHERE id_cliente=? ORDER BY fecha DESC,id_venta DESC', [id]);
    const pedidos = await rows(pool, 'SELECT id_pedido,tipo,descripcion_personalizada,fecha_pedido,fecha_solicitada,fecha_entrega,estado,total,anticipo,cotizacion_estado,cotizacion_version,motivo_retraso,observaciones,version FROM PEDIDO WHERE id_cliente=? ORDER BY fecha_pedido DESC,id_pedido DESC', [id]);
    const pagos = await rows(pool, 'SELECT pg.id_pago,pg.id_pedido,pg.id_venta,pg.importe,pg.metodo_pago,pg.referencia,pg.devuelto,pg.fecha FROM PAGO pg WHERE pg.id_pedido IN (SELECT id_pedido FROM PEDIDO WHERE id_cliente=?) OR pg.id_venta IN (SELECT id_venta FROM VENTA WHERE id_cliente=?) ORDER BY pg.fecha DESC,pg.id_pago DESC', [id, id]);
    const paidSales = ventas.filter(sale => sale.estado === 'Pagada');
    const openOrders = pedidos.filter(order => !['Despachado', 'Cancelado'].includes(order.estado));
    let purchased = 0n; let balance = 0n;
    for (const sale of paidSales) purchased += BigInt(parseMoney(sale.total));
    for (const order of openOrders) balance += BigInt(parseMoney(order.total)) - BigInt(parseMoney(order.anticipo));
    for (const [items, table, idName] of [[ventas, 'VENTA', 'id_venta'], [pedidos, 'PEDIDO', 'id_pedido']]) {
      if (!items.length) continue;
      const ids = items.map(item => item[idName]);
      const details = await rows(pool, `SELECT d.${idName},d.id_producto,COALESCE(d.nombre,p.nombre) AS nombre,d.cantidad,d.precio_unitario,d.subtotal FROM DETALLE_${table} d LEFT JOIN PRODUCTO p ON p.id_producto=d.id_producto WHERE d.${idName} IN (${ids.map(() => '?').join(',')}) ORDER BY d.${idName}`, ids);
      for (const item of items) {
        item.detalles = details.filter(detail => detail[idName] === item[idName]);
        item.pagos = pagos.filter(payment => payment[idName] === item[idName] || (table === 'VENTA' && item.id_pedido && payment.id_pedido === item.id_pedido));
        if (table === 'PEDIDO') {
          item.saldo = item.estado==='Cancelado'?'0.00':money(parseMoney(item.total) - parseMoney(item.anticipo));
          if(item.tipo==='Personalizado'&&item.cotizacion_estado==='Por cotizar'){item.total=null;item.saldo=null;}
        }
      }
    }
    return { ...users[0], resumen: { compras_completadas: paidSales.length, importe_comprado: money(Number(purchased)), ultima_compra: paidSales[0]?.fecha ?? null, pedidos_abiertos: openOrders.length, saldo_pendiente: money(Number(balance)) }, ventas, pedidos, pagos };
  }
  async function movements(query) {
    const { pagina, limite } = pageOptions(query);
    const params = []; const filters = [];
    if (query.id_ingrediente) { filters.push("inventario='Ingrediente' AND id_recurso=?"); params.push(idValue(query.id_ingrediente)); }
    if (query.id_producto) { filters.push("inventario='Producto' AND id_recurso=?"); params.push(idValue(query.id_producto)); }
    if (query.id) { filters.push('id_movimiento=?'); params.push(idValue(query.id)); }
    const buscar = text(query.buscar, 'Búsqueda', 100, true);
    if (buscar) { filters.push("nombre LIKE ? ESCAPE '!'"); params.push(like(buscar)); }
    for (const [field, comparison] of [['desde', '>='], ['hasta', '<=']]) if (query[field]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query[field])) throw new AppError(400, 'Fecha: usa el formato AAAA-MM-DD.');
      filters.push(`fecha ${comparison} ?`); params.push(query[field] + (field === 'hasta' ? ' 23:59:59' : ' 00:00:00'));
    }
    const source = `(SELECT m.id_movimiento,'Ingrediente' AS inventario,m.id_ingrediente AS id_recurso,i.nombre,m.cantidad,m.existencia_resultante,m.unidad,m.tipo,m.id_compra,m.id_venta,m.id_usuario,m.motivo,m.fecha,u.nombre AS operador FROM MOVIMIENTO_INGREDIENTE m JOIN INGREDIENTE i ON i.id_ingrediente=m.id_ingrediente LEFT JOIN USUARIO u ON u.id_usuario=m.id_usuario UNION ALL SELECT m.id_movimiento,'Producto',m.id_producto,p.nombre,m.cantidad,m.existencia_resultante,p.unidad,m.tipo,NULL,m.id_venta,m.id_usuario,m.motivo,m.fecha,u.nombre AS operador FROM MOVIMIENTO_PRODUCTO m JOIN PRODUCTO p ON p.id_producto=m.id_producto LEFT JOIN USUARIO u ON u.id_usuario=m.id_usuario) movimientos`;
    const where = filters.length ? ' WHERE ' + filters.map(filter => `(${filter})`).join(' AND ') : '';
    const count = await rows(pool, `SELECT COUNT(*) AS total FROM ${source}${where}`, params);
    const items = await rows(pool, `SELECT * FROM ${source}${where} ORDER BY fecha DESC,id_movimiento DESC,inventario LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, params);
    if (query.id) { if (!items.length) throw new AppError(404, 'No se encontró el movimiento.'); return items[0]; }
    return { items, total: Number(count[0].total), pagina, limite };
  }
  async function read(actor, resource, query = {}) {
    if (!resources.has(resource)) return undefined;
    authorized(actor);
    if (resource === 'cliente') return customerFile(actor, query);
    if (resource === 'movimientos') { adminOnly(actor); return movements(query); }
    if (resource==='proveedores'||(resource==='trabajadores'&&actor.rol!=='Trabajador')) adminOnly(actor);
    if (['ingredientes', 'recetas'].includes(resource) && actor.rol === 'Cliente') throw new AppError(403, 'No tienes permiso para consultar este recurso.');
    if (resource === 'clientes' && actor.rol === 'Cliente') throw new AppError(403, 'Solo puedes consultar tu propia cuenta.');
    if (resource === 'clientes' && query.id) return customerFile(actor, query);
    const conf = config[resource]; const alias = conf.alias;
    const where = []; const values = [];
    const minimal = resource === 'clientes' && actor.rol === 'Trabajador';
    const workerDirectory=resource==='trabajadores'&&actor.rol==='Trabajador';
    const buscar = text(query.buscar, 'Búsqueda', 100, true);
    if (minimal && !buscar) throw new AppError(400, 'Escribe el correo del cliente para buscar.');
    if (conf.role) { where.push('r.nombre=?'); values.push(conf.role); }
    if (actor.rol !== 'Administrador') { where.push(`${alias}.activo=TRUE`); if (resource === 'productos') where.push('c.activo=TRUE'); }
    else if (query.activo !== undefined && query.activo !== '') { where.push(`${alias}.activo=?`); values.push(active(query.activo)); }
    if (query.id) { where.push(`${alias}.${conf.id}=?`); values.push(idValue(query.id)); }
    if (query.id_producto && resource === 'recetas') { where.push('r.id_producto=?'); values.push(idValue(query.id_producto)); }
    if (query.id_categoria && resource === 'productos') { where.push('p.id_categoria=?'); values.push(idValue(query.id_categoria)); }
    if (query.bajo_minimo === '1' && ['productos', 'ingredientes'].includes(resource)) where.push(`${alias}.existencia<=${alias}.stock_minimo`);
    if (buscar) {
      if(minimal){where.push('u.correo=?');values.push(validateEmail(buscar));}
      else {
      const searchEmail=['clientes', 'trabajadores', 'proveedores'].includes(resource)&&!workerDirectory;
      where.push(`(${alias}.nombre LIKE ? ESCAPE '!'${searchEmail ? ` OR ${alias}.correo LIKE ? ESCAPE '!'` : ''})`);
      values.push(like(buscar)); if (searchEmail) values.push(like(buscar));
      }
    }
    const from = `FROM ${conf.table} ${alias}${conf.join ?? ''}${where.length ? ' WHERE ' + where.join(' AND ') : ''}`;
    const { pagina, limite } = pageOptions(query);
    const count = await rows(pool, `SELECT COUNT(*) AS total ${from}`, values);
    const items = await rows(pool, `SELECT ${workerDirectory?'u.id_usuario,u.nombre,u.activo':minimal ? 'u.id_usuario,u.nombre,u.correo' : conf.columns} ${from} ORDER BY ${alias}.${conf.id} DESC LIMIT ${query.id ? 1 : limite} OFFSET ${query.id ? 0 : (pagina - 1) * limite}`, values);
    if (resource === 'recetas') for (const recipe of items) await recipeDetails(pool, recipe);
    if (resource === 'productos') for (const product of items) {
      await productDetails(product);
      if (actor.rol === 'Cliente' && product.receta) product.receta = { id_receta: product.receta.id_receta, activo: product.receta.activo };
    }
    if (query.id) {
      if (!items.length) throw new AppError(404, 'No se encontró el registro.');
      if (resource === 'proveedores') items[0].compras = await rows(pool, 'SELECT c.id_compra,c.fecha,c.total,c.estado,c.observaciones,c.id_usuario,c.version,u.nombre AS operador FROM COMPRA c JOIN USUARIO u ON u.id_usuario=c.id_usuario WHERE c.id_proveedor=? ORDER BY c.fecha DESC,c.id_compra DESC', [idValue(query.id)]);
      return items[0];
    }
    return { items, total: Number(count[0].total), pagina, limite };
  }

  function validateData(actor, action, data) {
    const own = action === 'guardarCliente' && actor.rol === 'Cliente';
    if (!own) adminOnly(actor);
    if (own && data.id !== undefined && idValue(data.id) !== actor.id_usuario) throw new AppError(403, 'Solo puedes editar tu propia cuenta.');
    if (action === 'guardarCliente' && data.correo !== undefined) throw new AppError(403, 'El correo registrado no se puede modificar.');
    if (own && (data.activo !== undefined || data.rol !== undefined || data.id_rol !== undefined || data.contrasena !== undefined || data.contrasena_hash !== undefined)) throw new AppError(403, 'Solo puedes actualizar tus datos de contacto.');
    if (data.rol !== undefined || data.id_rol !== undefined || data.contrasena_hash !== undefined) throw new AppError(400, 'No se puede modificar el rol de la cuenta.');
    const id = data.id === undefined ? (own ? actor.id_usuario : undefined) : idValue(data.id);
    if (id !== undefined) integer(data.version, 'Versión', { min: 1 });
    const result = { id };
    if (action.startsWith('ajustar')) {
      result.id = idValue(data.id ?? data[action === 'ajustarProducto' ? 'id_producto' : 'id_ingrediente']);
      integer(data.version, 'Versión', { min: 1 });
      result.motivo = text(data.motivo, 'Motivo', 255);
      result.existencia = action === 'ajustarProducto' ? integer(data.existencia, 'Existencia') : parseQuantity(data.existencia);
      return result;
    }
    result.nombre = text(data.nombre, 'Nombre', action === 'guardarCategoria' ? 50 : 100);
    if (['guardarCliente', 'guardarTrabajador', 'guardarProveedor'].includes(action)) {
      if (action === 'guardarCliente') {
        result.nombre = validatePersonName(data.nombre);
        Object.assign(result, validateContact(data));
      } else {
        result.correo = action === 'guardarProveedor' && !data.correo ? null : validateEmail(data.correo);
        result.telefono = text(data.telefono, 'Teléfono', 20, true); result.direccion = text(data.direccion, 'Dirección', 255, true);
      }
      if (action === 'guardarCliente' && !id) throw new AppError(400, 'Los clientes crean su cuenta mediante el registro.');
      if (action === 'guardarTrabajador' && (!id || data.contrasena)) {
        result.contrasena = validatePassword(data.contrasena);
        if (result.contrasena !== data.confirmacion) throw new AppError(400, 'Las contraseñas no coinciden.');
      }
    }
    if (['guardarCategoria', 'guardarProducto', 'guardarReceta'].includes(action)) result.descripcion = text(data.descripcion, 'Descripción', 255, true);
    if (action === 'guardarProducto') {
      if (!id) throw new AppError(400, 'Da de alta el producto con su fotografía desde el formulario de productos.');
      result.id_categoria = idValue(data.id_categoria); result.precio = money(parseMoney(data.precio));
      result.stock_minimo = integer(data.stock_minimo, 'Stock mínimo', { fallback: 0 }); result.unidad = text(data.unidad ?? 'pieza', 'Unidad', 20);
    }
    if (action === 'guardarIngrediente') {
      if (!['kg', 'litro', 'pieza'].includes(data.unidad)) throw new AppError(400, 'Unidad: selecciona kg, litro o pieza.');
      result.unidad = data.unidad; result.stock_minimo = quantity(parseQuantity(data.stock_minimo ?? '0'));
      if (!id) result.existencia = quantity(parseQuantity(data.existencia ?? '0'));
    }
    if (action === 'guardarReceta') {
      result.id_producto = idValue(data.id_producto);
      if (data.rendimiento !== undefined) result.rendimiento = integer(data.rendimiento, 'Rendimiento', { min: 1 });
      if (!id && result.rendimiento !== undefined && result.rendimiento !== 1) throw new AppError(400, 'Captura los ingredientes para una unidad vendible (rendimiento 1).');
      if (!Array.isArray(data.detalles) || !data.detalles.length || data.detalles.length > 200) throw new AppError(400, 'Agrega entre 1 y 200 ingredientes a la receta.');
      const seen = new Set();
      result.detalles = data.detalles.map(detail => {
        const ingredient = idValue(detail.id_ingrediente); const amount = parseQuantity(detail.cantidad);
        if (!amount || seen.has(ingredient)) throw new AppError(400, 'Cada ingrediente debe aparecer una sola vez con cantidad positiva.');
        seen.add(ingredient); return { id_ingrediente: ingredient, cantidad: quantity(amount) };
      }).sort((a, b) => a.id_ingrediente - b.id_ingrediente);
    }
    if (data.activo !== undefined) result.activo = active(data.activo);
    return result;
  }
  async function write(actor, action, data = {}, key) {
    if (!actions.has(action)) return undefined;
    authorized(actor);
    const validated = validateData(actor, action, data);
    try {
      return await transaction(pool, connection => once(connection, actor, action, key, data, async () => {
        const d = validated;
        if (action.startsWith('ajustar')) {
          const product = action === 'ajustarProducto'; const table = product ? 'PRODUCTO' : 'INGREDIENTE'; const idName = product ? 'id_producto' : 'id_ingrediente';
          const row = await locked(connection, table, idName, d.id); checkVersion(row, data);
          const previous = product ? row.existencia : parseQuantity(row.existencia);
          const delta = d.existencia - previous;
          const final = product ? d.existencia : quantity(d.existencia);
          await connection.execute(`UPDATE ${table} SET existencia=?,version=version+1 WHERE ${idName}=?`, [final, d.id]);
          if (product) await connection.execute('INSERT INTO MOVIMIENTO_PRODUCTO (id_producto,cantidad,existencia_resultante,tipo,id_usuario,motivo) VALUES (?,?,?,?,?,?)', [d.id, delta, final, 'Ajuste', actor.id_usuario, d.motivo]);
          else await connection.execute('INSERT INTO MOVIMIENTO_INGREDIENTE (id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_usuario,motivo) VALUES (?,?,?,?,?,?,?)', [d.id, signedQuantity(delta), final, row.unidad, 'Ajuste', actor.id_usuario, d.motivo]);
          return { id: d.id, [idName]: d.id, version: row.version + 1, existencia: final };
        }
        if (action === 'guardarTrabajador' || action === 'guardarCliente') {
          const role = action === 'guardarTrabajador' ? 'Trabajador' : 'Cliente';
          let version = 1; let id = d.id;
          const passwordHash = d.contrasena ? await hashPassword(d.contrasena) : null;
          if (id) {
            const users = await rows(connection, 'SELECT u.id_usuario,u.version,u.activo,r.nombre AS rol FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? FOR UPDATE', [id]);
            if (!users.length || users[0].rol !== role) throw new AppError(404, 'No se encontró la cuenta de este tipo.');
            checkVersion(users[0], data); version = users[0].version + 1;
            const sets = ['nombre=?', 'telefono=?', 'direccion=?']; const params = [d.nombre, d.telefono, d.direccion];
            if (action === 'guardarTrabajador') { sets.push('correo=?'); params.push(d.correo); }
            if (d.activo !== undefined) { sets.push('activo=?'); params.push(d.activo); }
            if (passwordHash) { sets.push('contrasena_hash=?'); params.push(passwordHash); }
            params.push(id); await connection.execute(`UPDATE USUARIO SET ${sets.join(',')},version=version+1 WHERE id_usuario=?`, params);
          } else {
            const result = await rows(connection, 'INSERT INTO USUARIO (id_rol,nombre,correo,telefono,direccion,contrasena_hash,activo) SELECT id_rol,?,?,?,?,?,? FROM ROL WHERE nombre=?', [d.nombre, d.correo, d.telefono, d.direccion, passwordHash, d.activo ?? 1, role]);
            if (!result.affectedRows) throw new AppError(409, 'No se encontró el rol Trabajador.'); id = result.insertId;
          }
          return { id, id_usuario: id, version };
        }
        if (action === 'guardarReceta') {
          // Lock product before recipe/ingredients: same order as ordinary sales.
          await locked(connection, 'PRODUCTO', 'id_producto', d.id_producto);
          const existing = await rows(connection, 'SELECT id_receta,id_producto,version,activo,rendimiento FROM RECETA WHERE id_producto=? FOR UPDATE', [d.id_producto]);
          let id = d.id; let version = 1;
          if (id) {
            if (!existing.length || existing[0].id_receta !== id) throw new AppError(404, 'No se encontró la receta de este producto.');
            checkVersion(existing[0], data); version = existing[0].version + 1;
          } else if (existing.length) throw new AppError(409, 'Este producto ya tiene una receta. Abre la receta existente para editarla.');
          const recipeActive = d.activo ?? existing[0]?.activo ?? 1;
          for (const detail of d.detalles) { const ingredient = await locked(connection, 'INGREDIENTE', 'id_ingrediente', detail.id_ingrediente); if (recipeActive && !ingredient.activo) throw new AppError(400, 'La receta requiere ingredientes activos.'); }
          if (id) {
            const rendimiento = d.rendimiento ?? existing[0].rendimiento ?? 1;
            if (rendimiento !== 1 && rendimiento !== existing[0].rendimiento) throw new AppError(400, 'Conserva el rendimiento actual o captura una receta para una unidad vendible.');
            await connection.execute('UPDATE RECETA SET nombre=?,descripcion=?,rendimiento=?,activo=?,version=version+1 WHERE id_receta=?', [d.nombre, d.descripcion, rendimiento, d.activo ?? existing[0].activo, id]); await connection.execute('DELETE FROM DETALLE_RECETA WHERE id_receta=?', [id]);
          }
          else id = (await rows(connection, 'INSERT INTO RECETA (id_producto,nombre,descripcion,rendimiento,activo) VALUES (?,?,?,1,?)', [d.id_producto, d.nombre, d.descripcion, d.activo ?? 1])).insertId;
          for (const detail of d.detalles) await connection.execute('INSERT INTO DETALLE_RECETA (id_receta,id_ingrediente,cantidad) VALUES (?,?,?)', [id, detail.id_ingrediente, detail.cantidad]);
          return { id, id_receta: id, version };
        }
        const map = { guardarCategoria: ['CATEGORIA_PRODUCTO', 'id_categoria', ['nombre', 'descripcion']], guardarIngrediente: ['INGREDIENTE', 'id_ingrediente', ['nombre', 'unidad', 'stock_minimo']], guardarProducto: ['PRODUCTO', 'id_producto', ['nombre', 'id_categoria', 'descripcion', 'precio', 'stock_minimo', 'unidad']], guardarProveedor: ['PROVEEDOR', 'id_proveedor', ['nombre', 'telefono', 'correo', 'direccion']] };
        const [table, idName, fields] = map[action]; let id = d.id; let version = 1;
        if (action === 'guardarProducto') { const categories = await rows(connection, 'SELECT id_categoria FROM CATEGORIA_PRODUCTO WHERE id_categoria=? AND activo=TRUE FOR UPDATE', [d.id_categoria]); if (!categories.length) throw new AppError(400, 'Selecciona una categoría activa.'); }
        if (id) {
          const current = await locked(connection, table, idName, id); checkVersion(current, data); version = current.version + 1;
          if (action === 'guardarIngrediente' && current.unidad !== d.unidad) {
            const uses = await rows(connection, 'SELECT (EXISTS(SELECT 1 FROM MOVIMIENTO_INGREDIENTE WHERE id_ingrediente=?) OR EXISTS(SELECT 1 FROM DETALLE_COMPRA WHERE id_ingrediente=?) OR EXISTS(SELECT 1 FROM DETALLE_RECETA WHERE id_ingrediente=?)) AS usado', [id, id, id]);
            if (parseQuantity(current.existencia) || uses[0].usado) throw new AppError(409, 'La unidad tiene existencias o historial. Crea otro ingrediente.');
          }
          const updateFields = [...fields]; if (d.activo !== undefined) updateFields.push('activo');
          await connection.execute(`UPDATE ${table} SET ${updateFields.map(field => `${field}=?`).join(',')},version=version+1 WHERE ${idName}=?`, [...updateFields.map(field => d[field]), id]);
        } else {
          const insertFields = [...fields, 'activo']; if (action === 'guardarIngrediente') insertFields.push('existencia');
          id = (await rows(connection, `INSERT INTO ${table} (${insertFields.join(',')}) VALUES (${insertFields.map(() => '?').join(',')})`, insertFields.map(field => field === 'activo' ? d.activo ?? 1 : d[field]))).insertId;
          if (action === 'guardarIngrediente') await connection.execute('INSERT INTO MOVIMIENTO_INGREDIENTE (id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_usuario,motivo) VALUES (?,?,?,?,?,?,?)', [id, d.existencia, d.existencia, d.unidad, 'Apertura', actor.id_usuario, 'Existencia inicial']);
        }
        return { id, [idName]: id, version };
      }));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, ['guardarTrabajador', 'guardarCliente'].includes(action) ? 'Ya existe una cuenta con ese correo.' : 'Ya existe un registro con esos datos.');
      throw error;
    }
  }
  return { read, write };
}
