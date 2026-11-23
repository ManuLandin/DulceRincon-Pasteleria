import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommunications, readBankConfiguration, notifyHistory } from '../server/notifications.js';
const admin = { id_usuario: 1, rol: 'Administrador', activo: 1 };
const worker = { id_usuario: 2, rol: 'Trabajador', activo: 1 };
const client = { id_usuario: 3, rol: 'Cliente', activo: 1 };
const key = 'notifications-operation-0001';
const status = code => error => error.status === code;

function database(handler = () => { throw new Error('SQL inesperado'); }) {
  const calls = [], operations = new Map();
  let committed = 0, rolledBack = 0;
  const connection = {
    async execute(sql, values = []) {
      calls.push({ sql, values });
      const operationKey = `${values[0]}:${values[1]}`;
      if (sql.startsWith('INSERT INTO OPERACION')) {
        if (!operations.has(operationKey)) operations.set(operationKey, { huella: values[3], resultado: null });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('FROM OPERACION')) return [[operations.get(operationKey)]];
      if (sql.startsWith('UPDATE OPERACION')) {
        operations.get(`${values[1]}:${values[2]}`).resultado = values[0];
        return [{ affectedRows: 1 }];
      }
      return [await handler(sql, values)];
    },
    async beginTransaction() {}, async commit() { committed++; }, async rollback() { rolledBack++; }, release() {}
  };
  return { pool: { ...connection, async getConnection() { return connection; } }, calls,
    get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

test('expone el servicio y helpers transaccionales de comunicaciones', () => {
  assert.equal(typeof createCommunications, 'function');
  assert.equal(typeof readBankConfiguration, 'function');
  assert.equal(typeof notifyHistory, 'function');
});

test('deriva recursos desconocidos y deniega configuración ajena antes del SQL', async () => {
  const db = database(), service = createCommunications(db.pool);
  assert.equal(await service.read(null, 'pedidos'), undefined);
  assert.equal(await service.write(null, 'crearPedido', {}, key), undefined);
  for (const actor of [client, worker]) await assert.rejects(service.write(actor, 'guardarConfiguracionBancaria', {}, key), status(403));
  await assert.rejects(service.read(null, 'notificaciones'), status(401));
  await assert.rejects(service.read({ ...client, activo: 0 }, 'notificaciones'), status(401));
  assert.equal(db.calls.length, 0);
});

test('listado y contador siempre pertenecen a la sesión incluso con destinatario manipulado', async () => {
  const item = { id_notificacion: 12, id_pedido: 9, id_evento: 10, tipo: 'Cotización', titulo: 'Cotización', texto: 'Pedido 9', fecha: '2026-11-07', leida: 0, fecha_lectura: null };
  const db = database((sql, values) => {
    assert.equal(values[0], 3);
    assert.match(sql, /WHERE id_destinatario=\?/);
    if (sql.includes('COUNT')) return [{ total: 7, no_leidas: 4 }];
    assert.match(sql, /ORDER BY fecha DESC,id_notificacion DESC LIMIT 2 OFFSET 2/);
    return [item];
  });
  const result = await createCommunications(db.pool).read(client, 'notificaciones', { id_destinatario: 88, pagina: '2', limite: '2' });
  assert.deepEqual(result, { items: [item], total: 7, no_leidas: 4, pagina: 2, limite: 2 });
});

test('marcar un aviso ajeno falla sin modificar registros y marcar propio es idempotente', async () => {
  let updates = 0;
  const db = database((sql, values) => {
    if (sql.startsWith('SELECT') && sql.includes('FROM NOTIFICACION')) {
      assert.deepEqual(values, [12, 3]);
      assert.match(sql, /id_notificacion=\? AND id_destinatario=\? FOR UPDATE/);
      return [{ id_notificacion: 12, leida: 0 }];
    }
    if (sql.startsWith('UPDATE NOTIFICACION')) { updates++; assert.deepEqual(values, [12, 3]); return { affectedRows: 1 }; }
    throw new Error(sql);
  });
  const service = createCommunications(db.pool);
  const first = await service.write(client, 'leerNotificacion', { id: 12, id_destinatario: 8 }, key);
  assert.deepEqual(first, { id: 12, id_notificacion: 12, leida: true });
  assert.deepEqual(await service.write(client, 'leerNotificacion', { id: 12, id_destinatario: 8 }, key), first);
  assert.equal(updates, 1);
  const foreign = database(sql => { if (sql.includes('FROM NOTIFICACION')) return []; throw new Error(sql); });
  await assert.rejects(createCommunications(foreign.pool).write(client, 'leerNotificacion', { id: 99 }, key), status(404));
  assert.equal(foreign.calls.some(c => c.sql.startsWith('UPDATE NOTIFICACION')), false);
});

test('marca todas únicamente de la sesión y exige una clave de escritura', async () => {
  const db = database((sql, values) => {
    assert.match(sql, /^UPDATE NOTIFICACION .*WHERE id_destinatario=\? AND leida=0$/);
    assert.deepEqual(values, [3]);
    return { affectedRows: 2 };
  });
  const service = createCommunications(db.pool);
  await assert.rejects(service.write(client, 'leerTodasNotificaciones', {}), status(400));
  assert.deepEqual(await service.write(client, 'leerTodasNotificaciones', { id_destinatario: 9 }, key), { actualizadas: 2 });
});

test('configuración vacía no inventa datos y versión histórica se consulta sin mutar filas', async () => {
  const empty = database(sql => { assert.match(sql, /FROM CONFIG_BANCARIA/); return []; });
  assert.deepEqual(await createCommunications(empty.pool).read(client, 'configuracionBancaria'), { configurada: false, version: 0 });
  const row = { id_config: 4, version: 2, banco: 'Banco capturado', titular: 'Titular capturado', clabe: '012345678901234567', instrucciones: '', id_usuario: 1, fecha: '2026-11-07' };
  const db = database((sql, values) => { assert.match(sql, /WHERE version=\?/); assert.deepEqual(values, [2]); return [row]; });
  assert.deepEqual(await readBankConfiguration(db.pool, 2), row);
  assert.equal(db.calls.every(c => c.sql.startsWith('SELECT')), true);
});

test('guardar cuenta agrega versión inmutable y rechaza formularios obsoletos', async () => {
  const data = { version: 2, banco: ' Banco capturado ', titular: ' Titular capturado ', clabe: '012345678901234567', instrucciones: ' Incluir folio ' };
  let inserted;
  const db = database((sql, values) => {
    if (sql.includes('FROM ROL')) return [{ id_rol: 1 }];
    if (sql.includes('FROM CONFIG_BANCARIA')) return [{ version: 2 }];
    if (sql.startsWith('INSERT INTO CONFIG_BANCARIA')) { inserted = values; return { insertId: 3 }; }
    throw new Error(sql);
  });
  const service = createCommunications(db.pool);
  const saved = await service.write(admin, 'guardarConfiguracionBancaria', data, key);
  assert.deepEqual(saved, { configurada: true, version: 3, banco: 'Banco capturado', titular: 'Titular capturado', clabe: data.clabe, instrucciones: 'Incluir folio' });
  assert.deepEqual(inserted, [3, 'Banco capturado', 'Titular capturado', data.clabe, 'Incluir folio', 1]);
  assert.deepEqual(await service.write(admin, 'guardarConfiguracionBancaria', data, key), saved);
  assert.equal(db.calls.filter(c => c.sql.startsWith('INSERT INTO CONFIG_BANCARIA')).length, 1);
  await assert.rejects(service.write(admin, 'guardarConfiguracionBancaria', { ...data, version: 1 }, key + '2'), status(409));
  assert.equal(db.calls.some(c => /^(UPDATE|DELETE).*CONFIG_BANCARIA/.test(c.sql)), false);
});

test('configuración valida CLABE literal de 18 dígitos y longitudes', async () => {
  const db = database(), service = createCommunications(db.pool);
  const data = { version: 0, banco: 'Banco', titular: 'Titular', clabe: '012345678901234567' };
  for (const changes of [{ clabe: '123' }, { clabe: '01234567890123456x' }, { banco: '' }, { titular: 'X'.repeat(101) }, { instrucciones: 'X'.repeat(256) }]) {
    await assert.rejects(service.write(admin, 'guardarConfiguracionBancaria', { ...data, ...changes }, key), status(400));
  }
  assert.equal(db.calls.length, 0);
});

function eventDatabase(order = {}) {
  const notices = new Map();
  const db = database((sql, values) => {
    if (sql.includes('FROM PEDIDO')) return [{ id_pedido: 9, id_cliente: 3, id_trabajador: null, tipo: 'Catalogo', ...order }];
    if (sql.includes('FROM USUARIO')) {
      if (sql.includes("r.nombre='Administrador'")) return [{id_usuario:1}];
      if (sql.includes('u.id_usuario=?')) return [{ id_usuario: values[0] }];
      return [{ id_usuario: 1 }, { id_usuario: 2 }, { id_usuario: 4 }];
    }
    if (sql.startsWith('INSERT INTO NOTIFICACION')) {
      assert.match(sql, /ON DUPLICATE KEY UPDATE id_notificacion=id_notificacion$/);
      const identity = `${values[2]}:${values[0]}`;
      if (!notices.has(identity)) notices.set(identity, { recipient: values[0], order: values[1], event: values[2], type: values[3], title: values[4], text: values[5] });
      return { affectedRows: 1 };
    }
    throw new Error(sql);
  });
  return { ...db, notices };
}

test('pedido nuevo avisa a personal activo una sola vez por evento y destinatario', async () => {
  const db = eventDatabase();
  await notifyHistory(db.pool, 9, 20, client, 'Creación', { tipo: 'Catalogo' });
  await notifyHistory(db.pool, 9, 20, client, 'Creación', { tipo: 'Catalogo' });
  assert.deepEqual([...db.notices.values()].map(n => n.recipient), [1, 2, 4]);
  assert.equal([...db.notices.values()].every(n => n.order === 9 && n.event === 20), true);
  const recipients = db.calls.find(c => c.sql.includes('FROM USUARIO'));
  assert.match(recipients.sql, /u.activo=1/);
  assert.match(recipients.sql, /Trabajador/);
  assert.match(recipients.sql, /Administrador/);
  assert.equal(db.calls.some(c => c.sql.includes('OPERACION')), false);
});

test('cotización y observación avisan solo al titular y muestran el motivo sin datos bancarios', async () => {
  const db = eventDatabase();
  await notifyHistory(db.pool, 9, 21, worker, 'Cotización', { total: '150.00' });
  await notifyHistory(db.pool, 9, 22, worker, 'Transferencia por corregir', { motivo: 'Referencia no localizada', referencia: 'PRIVATE-REFERENCE', clabe: 'PRIVATE-ACCOUNT' });
  assert.deepEqual([...db.notices.values()].map(n => n.recipient), [3, 3]);
  assert.match(db.notices.get('22:3').text, /Referencia no localizada/);
  assert.equal(JSON.stringify([...db.notices.values()]).includes('PRIVATE-'), false);
});

test('acciones cliente avisan al responsable y sin responsable a personal activo', async () => {
  const assigned = eventDatabase({ id_trabajador: 4 });
  await notifyHistory(assigned.pool, 9, 23, client, 'Aceptación', {});
  await notifyHistory(assigned.pool, 9, 24, client, 'Referencia enviada', {});
  assert.deepEqual([...assigned.notices.values()].map(n => n.recipient), [4, 4]);
  const free = eventDatabase();
  await notifyHistory(free.pool, 9, 24, client, 'Referencia enviada', {});
  assert.deepEqual([...free.notices.values()].map(n => n.recipient), [1, 2, 4]);
});

test('aceptar transferencia avisa al titular y al responsable elegido por administrador', async () => {
  const db = eventDatabase({ id_trabajador: 4 });
  await notifyHistory(db.pool, 9, 25, admin, 'Transferencia aceptada', { id_trabajador: 4 });
  assert.deepEqual([...db.notices.values()].map(n => n.recipient), [3, 4]);
});

test('reasignación avisa al responsable anterior y al nuevo pero un cambio de estado no repite asignación', async () => {
  const db = eventDatabase({ id_trabajador: 4 });
  await notifyHistory(db.pool, 9, 26, admin, 'Actualización', { estado: 'Pendiente', id_trabajador: 4, id_trabajador_anterior: 2 });
  assert.deepEqual([...db.notices.values()].map(n => n.recipient), [3, 4, 2]);
  const stateChange = eventDatabase({ id_trabajador: 4 });
  await notifyHistory(stateChange.pool, 9, 27, worker, 'Actualización', { estado: 'En progreso', id_trabajador: 4, id_trabajador_anterior: 4 });
  assert.deepEqual([...stateChange.notices.values()].map(n => n.recipient), [3]);
});

test('cancelación del cliente avisa al responsable y entrega avisa al cliente', async () => {
  const db = eventDatabase({ id_trabajador: 2 });
  await notifyHistory(db.pool, 9, 28, client, 'Cancelación', { motivo: 'Ya no lo necesito' });
  await notifyHistory(db.pool, 9, 29, worker, 'Entrega', {});
  assert.deepEqual([...db.notices.values()].map(n => n.recipient), [2, 3, 1]);
});

test('primera configuración devuelve solo destino público y rechaza idempotencia con datos distintos', async () => {
  const db = database(sql => {
    if (sql.includes('FROM ROL')) return [{ id_rol: 1 }];
    if (sql.includes('FROM CONFIG_BANCARIA')) return [];
    if (sql.startsWith('INSERT INTO CONFIG_BANCARIA')) return { insertId: 1 };
    throw new Error(sql);
  });
  const service = createCommunications(db.pool);
  const data = { version: 0, banco: 'Banco capturado', titular: 'Titular capturado', clabe: '012345678901234567' };
  assert.deepEqual(await service.write(admin, 'guardarConfiguracionBancaria', data, key), { configurada: true, version: 1, banco: data.banco, titular: data.titular, clabe: data.clabe, instrucciones: '' });
  await assert.rejects(service.write(admin, 'guardarConfiguracionBancaria', { ...data, titular: 'Otro titular' }, key), status(409));
  assert.equal(db.calls.filter(c => c.sql.startsWith('INSERT INTO CONFIG_BANCARIA')).length, 1);
});

test('una notificación ya leída conserva fecha_lectura y la clave exige mismos datos', async () => {
  const db = database(sql => {
    if (sql.includes('FROM NOTIFICACION')) return [{ id_notificacion: 12, leida: 1 }];
    throw new Error(sql);
  });
  const service = createCommunications(db.pool);
  assert.equal((await service.write(client, 'leerNotificacion', { id: 12 }, key)).leida, true);
  await assert.rejects(service.write(client, 'leerNotificacion', { id: 13 }, key), status(409));
  assert.equal(db.calls.some(c => c.sql.startsWith('UPDATE NOTIFICACION')), false);
});

test('fallar al insertar aviso propaga el error para que el núcleo revierta el pedido', async () => {
  const expected = new Error('Falló almacenamiento del aviso');
  const db = database(sql => {
    if (sql.includes('FROM PEDIDO')) return [{ id_pedido: 9, id_cliente: 3, id_trabajador: 2, tipo: 'Catalogo' }];
    if (sql.startsWith('INSERT INTO NOTIFICACION')) throw expected;
    throw new Error(sql);
  });
  await assert.rejects(notifyHistory(db.pool, 9, 30, worker, 'Cotización', {}), error => error === expected);
  assert.equal(db.committed, 0);
});
