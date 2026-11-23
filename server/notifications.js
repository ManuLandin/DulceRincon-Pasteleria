import { AppError } from './errors.js';
import { integer } from './validation.js';
import { transaction, once } from './transactions.js';

const resources = new Set(['notificaciones', 'configuracionBancaria']);
const actions = new Set(['leerNotificacion', 'leerTodasNotificaciones', 'guardarConfiguracionBancaria']);
const roles = new Set(['Administrador', 'Trabajador', 'Cliente']);
const eventActions = new Set(['Creación', 'Cotización', 'Aceptación', 'Rechazo', 'Cobro', 'Actualización', 'Entrega', 'Cancelación', 'Referencia enviada', 'Transferencia aceptada', 'Transferencia por corregir', 'Referencias actualizadas']);
const bankColumns = 'id_config,version,banco,titular,clabe,instrucciones,id_usuario,fecha';
const noticeColumns = 'id_notificacion,id_pedido,id_evento,tipo,titulo,texto,fecha,leida,fecha_lectura,entidad,id_origen';
const fail = (status, message) => { throw new AppError(status, message); };
const idValue = value => integer(value, 'Identificador', { min: 1, max: Number.MAX_SAFE_INTEGER });
async function rows(db, sql, values = []) { return (await db.execute(sql, values))[0]; }

function authorized(actor) {
  if (!actor || !roles.has(actor.rol) || !actor.activo || !Number.isSafeInteger(Number(actor.id_usuario)) || Number(actor.id_usuario) < 1) fail(401, 'Inicia sesión con una cuenta activa para continuar.');
}
function inputText(value, label, max, optional = false) {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.includes('\0') || [...value.trim()].length > max || (!optional && !value.trim())) fail(400, `${label}: escribe un valor válido de hasta ${max} caracteres.`);
  return value.trim();
}
function bankInput(data) {
  const version = integer(data.version, 'Versión', { min: 0, max: 2147483646 });
  const banco = inputText(data.banco, 'Banco', 100);
  const titular = inputText(data.titular, 'Titular', 100);
  if (typeof data.clabe !== 'string' || !/^\d{18}$/.test(data.clabe)) fail(400, 'CLABE: escribe exactamente 18 dígitos.');
  return { version, banco, titular, clabe: data.clabe, instrucciones: inputText(data.instrucciones, 'Instrucciones', 255, true) };
}
function bankResult(row) {
  return row ? { configurada: true, version: Number(row.version), banco: row.banco, titular: row.titular, clabe: row.clabe, instrucciones: row.instrucciones } : { configurada: false, version: 0 };
}

// Historical versions are never updated. Consumers can keep this exact row in
// a transfer snapshot even after an administrator appends a newer destination.
export async function readBankConfiguration(db, version) {
  const result = version === undefined
    ? await rows(db, `SELECT ${bankColumns} FROM CONFIG_BANCARIA ORDER BY version DESC LIMIT 1`)
    : await rows(db, `SELECT ${bankColumns} FROM CONFIG_BANCARIA WHERE version=?`, [integer(version, 'Versión bancaria', { min: 1 })]);
  return result[0] ?? null;
}

export function createCommunications(pool) {
  async function read(actor, resource, query = {}) {
    if (!resources.has(resource)) return undefined;
    authorized(actor);
    if (resource === 'configuracionBancaria') return bankResult(await readBankConfiguration(pool));
    const pagina = integer(query.pagina, 'Página', { min: 1, max: 1000000, fallback: 1 });
    const limite = integer(query.limite, 'Límite', { min: 1, max: 100, fallback: 20 });
    // A single read view keeps the counter and page consistent while another
    // connection marks notices read or commits a new order event.
    return transaction(pool, async db => {
      const [counts] = await rows(db, 'SELECT COUNT(*) AS total,COALESCE(SUM(leida=0),0) AS no_leidas FROM NOTIFICACION WHERE id_destinatario=?', [actor.id_usuario]);
      const items = await rows(db, `SELECT ${noticeColumns} FROM NOTIFICACION WHERE id_destinatario=? ORDER BY fecha DESC,id_notificacion DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, [actor.id_usuario]);
      return { items, total: Number(counts.total), pagina, limite, no_leidas: Number(counts.no_leidas) };
    });
  }

  async function write(actor, action, data = {}, key) {
    if (!actions.has(action)) return undefined;
    authorized(actor);
    if (action === 'guardarConfiguracionBancaria' && actor.rol !== 'Administrador') fail(403, 'Solo un administrador puede cambiar los datos bancarios.');
    const input = action === 'guardarConfiguracionBancaria' ? bankInput(data) : action === 'leerNotificacion' ? { id: idValue(data.id) } : {};
    try {
      return await transaction(pool, db => once(db, actor, action, key, data, async () => {
        if (action === 'leerNotificacion') {
          const [notice] = await rows(db, 'SELECT id_notificacion,leida FROM NOTIFICACION WHERE id_notificacion=? AND id_destinatario=? FOR UPDATE', [input.id, actor.id_usuario]);
          if (!notice) fail(404, 'No se encontró la notificación.');
          if (!notice.leida) await rows(db, 'UPDATE NOTIFICACION SET leida=1,fecha_lectura=CURRENT_TIMESTAMP WHERE id_notificacion=? AND id_destinatario=?', [input.id, actor.id_usuario]);
          return { id: input.id, id_notificacion: input.id, leida: true };
        }
        if (action === 'leerTodasNotificaciones') {
          const result = await rows(db, 'UPDATE NOTIFICACION SET leida=1,fecha_lectura=CURRENT_TIMESTAMP WHERE id_destinatario=? AND leida=0', [actor.id_usuario]);
          return { actualizadas: Number(result.affectedRows) };
        }
        // Lock a permanent row before selecting the last version: this also
        // serializes two first saves when CONFIG_BANCARIA is still empty.
        await rows(db, "SELECT id_rol FROM ROL WHERE nombre='Administrador' FOR UPDATE");
        const [current] = await rows(db, `SELECT ${bankColumns} FROM CONFIG_BANCARIA ORDER BY version DESC LIMIT 1 FOR UPDATE`);
        if (Number(current?.version ?? 0) !== input.version) fail(409, 'Los datos bancarios cambiaron. Recarga la configuración antes de guardar.');
        const saved = { ...input, version: input.version + 1 };
        await rows(db, 'INSERT INTO CONFIG_BANCARIA (version,banco,titular,clabe,instrucciones,id_usuario) VALUES (?,?,?,?,?,?)', [saved.version, saved.banco, saved.titular, saved.clabe, saved.instrucciones, actor.id_usuario]);
        return bankResult(saved);
      }));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') fail(409, 'Los datos cambiaron. Recarga antes de guardar.');
      throw error;
    }
  }
  return { read, write };
}

function brief(value, max = 255) {
  return typeof value === 'string' ? [...value.trim()].slice(0, max).join('') : '';
}
function eventMessage(id, action, detail, order) {
  const prefix = `Pedido #${id}`;
  const messages = {
    'Creación': ['Nueva solicitud de pedido', `${prefix}: nueva solicitud${order.tipo === 'Personalizado' ? ' personalizada' : ''}. Consulta el detalle para atenderla.`],
    'Cotización': ['Cotización disponible', `${prefix}: hay una cotización nueva. Revisa el importe y la fecha antes de aceptar.`],
    'Aceptación': ['Cotización aceptada', `${prefix}: el cliente aceptó la cotización vigente.`],
    'Rechazo': ['Cotización rechazada', `${prefix}: el cliente rechazó la cotización vigente.`],
    'Cobro': ['Pago registrado', `${prefix}: se registró un pago confirmado. Consulta el saldo en el detalle.`],
    'Actualización': [detail.estado === 'Listo' && detail.estado_anterior !== 'Listo' ? 'Pedido listo para recoger' : 'Pedido actualizado', `${prefix}: ${brief(detail.estado, 40) || 'cambios en el pedido'}.${detail.fecha_entrega ? ' Revisa la fecha comprometida.' : ''}${detail.motivo_retraso ? ` Motivo: ${brief(detail.motivo_retraso)}.` : ''}`],
    'Entrega': ['Pedido entregado', `${prefix}: se registró la entrega.`],
    'Cancelación': ['Pedido cancelado', `${prefix}: se canceló el pedido.${detail.motivo ? ` Motivo: ${brief(detail.motivo)}.` : ''}`],
    'Referencia enviada': ['Transferencia por revisar', `${prefix}: se envió una referencia de transferencia. Comprueba el ingreso antes de aceptar el pedido.`],
    'Transferencia aceptada': ['Transferencia verificada y pedido aceptado', `${prefix}: el personal verificó la transferencia y aceptó el pedido.${detail.fecha_entrega ? ' La entrega prevista está confirmada; consulta la fecha en tu pedido.' : ''}${detail.motivo_retraso ? ` Motivo del cambio: ${brief(detail.motivo_retraso)}.` : ''}`],
    'Transferencia por corregir': ['Referencia de transferencia por corregir', `${prefix}: corrige la referencia para que el personal pueda revisar el pago.${detail.motivo ? ` Motivo: ${brief(detail.motivo)}.` : ''}`],
    'Referencias actualizadas': ['Imágenes de referencia actualizadas', `${prefix}: se actualizaron las imágenes de referencia del encargo.`]
  };
  return messages[action];
}

// Called only after the history INSERT, with the same locked transaction. It
// never begins or commits a transaction and never replays historical events.
export async function notifyHistory(db, idPedido, idEvento, actor, action, detail = {}) {
  if (!eventActions.has(action)) return;
  const id = idValue(idPedido), event = idValue(idEvento);
  const [order] = await rows(db, 'SELECT id_pedido,id_cliente,id_trabajador,tipo FROM PEDIDO WHERE id_pedido=?', [id]);
  if (!order) fail(404, 'No se encontró el pedido para notificar.');
  const recipients = new Set();
  const customer = () => { if (order.id_cliente && Number(order.id_cliente) !== Number(actor.id_usuario)) recipients.add(Number(order.id_cliente)); };
  async function activeStaff() {
    const users = await rows(db, "SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.activo=1 AND r.nombre IN ('Trabajador','Administrador') ORDER BY u.id_usuario");
    for (const user of users) recipients.add(Number(user.id_usuario));
  }
  async function responsible(idWorker = order.id_trabajador, fallback = true) {
    if (!idWorker) { if (fallback) await activeStaff(); return; }
    if (Number(idWorker) === Number(actor.id_usuario)) return;
    const users = await rows(db, "SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? AND u.activo=1 AND r.nombre='Trabajador'", [idWorker]);
    for (const user of users) recipients.add(Number(user.id_usuario));
  }
  if (action === 'Creación') await activeStaff();
  else if (['Aceptación', 'Rechazo', 'Referencia enviada'].includes(action)) await responsible();
  else if (action === 'Cancelación') { customer(); await responsible(); }
  else if (action === 'Referencias actualizadas') {
    if (actor.rol === 'Cliente') await responsible();
    else customer();
  } else {
    customer();
    if (action === 'Transferencia aceptada') await responsible(undefined, false);
    if (action === 'Actualización' && Object.hasOwn(detail, 'id_trabajador') && Number(detail.id_trabajador) !== Number(detail.id_trabajador_anterior ?? 0)) {
      await responsible(detail.id_trabajador, false);
      if (detail.id_trabajador_anterior) await responsible(detail.id_trabajador_anterior, false);
    }
  }
  if(action === 'Entrega' || (action === 'Actualización' && detail.estado === 'Listo' && detail.estado_anterior !== 'Listo')) {
    const admins=await rows(db,"SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.activo=1 AND r.nombre='Administrador' ORDER BY u.id_usuario");
    for(const admin of admins)recipients.add(Number(admin.id_usuario));
  }
  const [title, message] = eventMessage(id, action, detail, order);
  for (const recipient of recipients) {
    await rows(db, 'INSERT INTO NOTIFICACION (id_destinatario,id_pedido,id_evento,tipo,titulo,texto) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id_notificacion=id_notificacion', [recipient, id, event, action, title, brief(message, 500)]);
  }
}

// Called in the same transaction as the completed operation. No customer or
// worker receives the administrator's general sales/purchasing feed.
export async function notifyBusiness(db,entity,sourceId,state){
 const id=idValue(sourceId);
 const titles={Venta:{Completada:'Venta completada'},Compra:{Creada:'Compra creada',Recibida:'Compra recibida',Cancelada:'Compra cancelada'}};
 const title=titles[entity]?.[state];if(!title)throw new Error('Evento de notificación no permitido.');
 const admins=await rows(db,"SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.activo=1 AND r.nombre='Administrador' ORDER BY u.id_usuario");
 for(const admin of admins)await rows(db,'INSERT INTO NOTIFICACION(id_destinatario,entidad,id_origen,clave_evento,tipo,titulo,texto) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id_notificacion=id_notificacion',[admin.id_usuario,entity,id,entity+':'+id+':'+state,title,title,entity+' #'+id+': '+title.toLowerCase()+'. Consulta el registro para ver sus detalles.']);
}
