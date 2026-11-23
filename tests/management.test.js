import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagement } from '../server/management.js';
import { verifyPassword } from '../server/passwords.js';

const admin = { id_usuario: 1, rol: 'Administrador', activo: 1 };
const worker = { id_usuario: 2, rol: 'Trabajador', activo: 1 };
const client = { id_usuario: 3, rol: 'Cliente', activo: 1 };
const key = 'cbe13313-f3df-42dc-9b1e-cf2fdcbb069b';
function fake(handler = () => []) {
  const calls = [];
  let operation;
  const connection = {
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (/INSERT INTO OPERACION/.test(sql)) { operation = { huella: values[3], resultado: null }; return [{ insertId: 1, affectedRows: 1 }]; }
      if (/SELECT .*OPERACION/.test(sql)) return [[operation]];
      if (/UPDATE OPERACION/.test(sql)) return [{ affectedRows: 1 }];
      return [await handler(sql, values)];
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {}
  };
  return { calls, pool: { ...connection, async getConnection() { return connection; } } };
}
const status = code => error => error.status === code;

test('customer contact saves name phone address but cannot change email through the API',async()=>{
 const {pool,calls}=fake(sql=>sql.includes('FROM USUARIO')?[{id_usuario:3,version:1,rol:'Cliente',activo:1}]:{affectedRows:1});
 const data={id:3,version:1,nombre:'Ana Pérez',telefono:'5512345678',direccion:'Calle de prueba 123'};
 await assert.rejects(createManagement(pool).write(client,'guardarCliente',{...data,correo:'otro@example.test'},key),status(403));
 const result=await createManagement(pool).write(client,'guardarCliente',data,key);
 assert.equal(result.version,2);
 const update=calls.find(call=>call.sql.startsWith('UPDATE USUARIO'));
 assert.ok(update);assert.doesNotMatch(update.sql,/correo=/);assert.ok(update.values.includes(data.telefono));assert.ok(update.values.includes(data.direccion));
});

test('los recursos ajenos se derivan y los permisos se validan antes del SQL', async () => {
  const { pool, calls } = fake(() => { throw new Error('SQL no autorizado'); });
  const service = createManagement(pool);
  assert.equal(await service.read(worker, 'ventas', {}), undefined);
  assert.equal(await service.write(worker, 'vender', {}, key), undefined);
  for (const resource of ['proveedores', 'movimientos']) await assert.rejects(service.read(worker, resource, {}), status(403));
  await assert.rejects(service.read(client, 'ingredientes', {}), status(403));
  await assert.rejects(service.write(worker, 'guardarTrabajador', {}, key), status(403));
  await assert.rejects(service.write(client, 'guardarCliente', { id: 4 }, key), status(403));
  assert.equal(calls.length, 0);
});

test('trabajador puede asignar responsables con nombres activos sin acceder a contacto de empleados',async()=>{
 const {pool,calls}=fake(sql=>/COUNT/.test(sql)?[{total:1}]:[{id_usuario:2,nombre:'Luis',activo:1}]);
 const result=await createManagement(pool).read(worker,'trabajadores',{});
 assert.deepEqual(result.items,[{id_usuario:2,nombre:'Luis',activo:1}]);
 const projection=calls.find(c=>!c.sql.includes('COUNT')).sql;
 assert.equal(projection.includes('correo'),false);assert.equal(projection.includes('telefono'),false);assert.match(projection,/activo=TRUE/);
});

test('ficha muestra personalizado sin cotizar como precio pendiente y nunca gratuito',async()=>{
 const {pool}=fake(sql=>{
  if(/FROM USUARIO/.test(sql))return [{id_usuario:3,nombre:'Cliente',correo:'cliente@example.test'}];
  if(/FROM PEDIDO/.test(sql))return [{id_pedido:1,tipo:'Personalizado',cotizacion_estado:'Por cotizar',total:'0.00',anticipo:'0.00',estado:'Pendiente'}];
  return [];
 });
 const result=await createManagement(pool).read(client,'cliente',{});
 assert.equal(result.pedidos[0].total,null);assert.equal(result.pedidos[0].saldo,null);
});

test('un trabajador solo puede buscar los datos mínimos de clientes activos', async () => {
  const { pool, calls } = fake(sql => /COUNT/.test(sql) ? [{ total: 1 }] : [{ id_usuario: 3, nombre: 'Ana', correo: 'ana@example.test' }]);
  const service = createManagement(pool);
  await assert.rejects(service.read(worker, 'clientes', {}), status(400));
  await assert.rejects(service.read(worker, 'cliente', { id: 3 }), status(403));
  await assert.rejects(service.read(worker,'clientes',{buscar:'@'}),status(400));
  await assert.rejects(service.read(worker,'clientes',{buscar:'Ana'}),status(400));
  const result = await service.read(worker, 'clientes', { buscar: 'ana@example.test' });
  assert.deepEqual(result.items, [{ id_usuario: 3, nombre: 'Ana', correo: 'ana@example.test' }]);
  assert.ok(calls.every(call => !call.sql.includes('contrasena_hash')));
  assert.ok(calls.every(call => call.sql.includes('activo=TRUE')));
  assert.ok(calls.every(call=>!call.sql.includes('LIKE')));
});

test('valida unidades fijas y recetas sin ingredientes repetidos', async () => {
  const { pool } = fake(); const service = createManagement(pool);
  await assert.rejects(service.write(admin, 'guardarIngrediente', { nombre: 'Azúcar', unidad: 'gramo', existencia: '1', stock_minimo: '0' }, key), status(400));
  await assert.rejects(service.write(admin, 'guardarReceta', { id_producto: 1, nombre: 'Pastel', detalles: [{ id_ingrediente: 2, cantidad: '1' }, { id_ingrediente: 2, cantidad: '0.5' }] }, key), status(400));
  await assert.rejects(service.write(admin, 'guardarReceta', { id_producto: 1, nombre: 'Pastel', rendimiento: 2, detalles: [{ id_ingrediente: 2, cantidad: '1' }] }, key), status(400));
});

test('ajusta existencia decimal exacta y registra la diferencia y el motivo bajo bloqueo', async () => {
  const { pool, calls } = fake(sql => {
    if (/SELECT .* FROM INGREDIENTE .*FOR UPDATE/.test(sql)) return [{ id_ingrediente: 2, existencia: '0.100', unidad: 'kg', version: 4 }];
    return { affectedRows: 1, insertId: 9 };
  });
  const result = await createManagement(pool).write(admin, 'ajustarIngrediente', { id_ingrediente: 2, version: 4, existencia: '0.300', motivo: 'Conteo físico' }, key);
  assert.equal(result.existencia, '0.300'); assert.equal(result.version, 5);
  const movement = calls.find(call => /INSERT INTO MOVIMIENTO_INGREDIENTE/.test(call.sql));
  assert.ok(movement); assert.ok(movement.values.includes('0.200')); assert.ok(movement.values.includes('Conteo físico'));
  await assert.rejects(createManagement(pool).write(admin, 'ajustarIngrediente', { id: 2, version: 3, existencia: '0.300', motivo: 'Conteo' }, key), status(409));
});

test('la ficha suma cada venta y pedido una vez sin multiplicarlos por los pagos', async () => {
  const { pool, calls } = fake(sql => {
    if (/FROM USUARIO/.test(sql)) return [{ id_usuario: 3, nombre: 'Ana', correo: 'ana@example.test', version: 1 }];
    if (/FROM PAGO/.test(sql)) return [{ id_pago: 1, id_pedido: 9, importe: '10.00', devuelto: 0 }, { id_pago: 2, id_pedido: 9, importe: '20.00', devuelto: 0 }];
    if (/FROM VENTA/.test(sql)) return [{ id_venta: 8, total: '120.00', estado: 'Pagada', fecha: '2026-11-06' }];
    if (/FROM PEDIDO/.test(sql)) return [{ id_pedido: 9, total: '100.00', anticipo: '30.00', estado: 'Pendiente' }];
    return [];
  });
  const result = await createManagement(pool).read(client, 'cliente', {});
  assert.equal(result.resumen.compras_completadas, 1);
  assert.equal(result.resumen.importe_comprado, '120.00');
  assert.equal(result.resumen.saldo_pendiente, '70.00');
  assert.equal(result.resumen.pedidos_abiertos, 1);
  assert.equal(result.pagos.length, 2);
  assert.ok(calls.every(call => !call.sql.includes('contrasena_hash')));
  await assert.rejects(createManagement(pool).read(client, 'cliente', { id: 4 }), status(403));
});

test('editar cliente propio no permite cambiar estado ni rol', async () => {
  const { pool } = fake();
  await assert.rejects(createManagement(pool).write(client, 'guardarCliente', { id: 3, version: 1, nombre: 'Ana', correo: 'a@example.test', activo: false }, key), status(403));
  await assert.rejects(createManagement(pool).write(admin, 'guardarTrabajador', { nombre: 'Ana', correo: 'a@example.test', rol: 'Administrador' }, key), status(400));
});

test('traduce correo duplicado y nunca devuelve hashes', async () => {
  const { pool } = fake(sql => {
    if (/FROM USUARIO.*FOR UPDATE/.test(sql)) return [{ id_usuario: 4, rol: 'Trabajador', version: 1, activo: 1 }];
    if (/UPDATE USUARIO/.test(sql)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
    return [];
  });
  await assert.rejects(createManagement(pool).write(admin, 'guardarTrabajador', { id: 4, version: 1, nombre: 'Ana', correo: 'a@example.test' }, key), error => error.status === 409 && /correo/.test(error.message));
});

test('alta de trabajador usa Argon2, fija el rol y devuelve solo identificador y versión', async () => {
  const { pool, calls } = fake(() => ({ affectedRows: 1, insertId: 7 }));
  const password = 'Una contraseña segura 123';
  const result = await createManagement(pool).write(admin, 'guardarTrabajador', { nombre: 'Luis', correo: 'LUIS@example.test', contrasena: password, confirmacion: password }, key);
  assert.deepEqual(result, { id: 7, id_usuario: 7, version: 1 });
  const insert = calls.find(call => /INSERT INTO USUARIO/.test(call.sql));
  assert.equal(insert.values.at(-1), 'Trabajador');
  assert.equal(insert.values[1], 'luis@example.test');
  assert.equal(await verifyPassword(insert.values[4], password), true);
  assert.equal(JSON.stringify(result).includes('hash'), false);
});

test('una unidad con historial no se cambia y una edición nunca sobrescribe las existencias', async () => {
  const { pool, calls } = fake(sql => {
    if (/FROM INGREDIENTE .*FOR UPDATE/.test(sql)) return [{ id_ingrediente: 2, existencia: '0.000', unidad: 'kg', activo: 1, version: 1 }];
    if (/AS usado/.test(sql)) return [{ usado: 1 }];
    return { affectedRows: 1 };
  });
  const service = createManagement(pool);
  await assert.rejects(service.write(admin, 'guardarIngrediente', { id: 2, version: 1, nombre: 'Azúcar', unidad: 'litro' }, key), status(409));
  await service.write(admin, 'guardarIngrediente', { id: 2, version: 1, nombre: 'Azúcar', unidad: 'kg', existencia: '99.999' }, key);
  const update = calls.find(call => /UPDATE INGREDIENTE/.test(call.sql));
  assert.ok(update); assert.equal(update.sql.includes('existencia='), false);
});

test('la receta exige versión y cantidades por unidad y conserva edición histórica fuera de movimientos', async () => {
  const { pool, calls } = fake(sql => {
    if (/FROM PRODUCTO .*FOR UPDATE/.test(sql)) return [{ id_producto: 1, version: 1, activo: 1, existencia: 5 }];
    if (/FROM RECETA .*FOR UPDATE/.test(sql)) return [{ id_receta: 4, id_producto: 1, version: 2, activo: 1 }];
    if (/FROM INGREDIENTE .*FOR UPDATE/.test(sql)) return [{ id_ingrediente: 2, version: 1, activo: 1 }];
    return { affectedRows: 1 };
  });
  const service = createManagement(pool);
  const data = { id: 4, version: 1, id_producto: 1, nombre: 'Receta', detalles: [{ id_ingrediente: 2, cantidad: '0.250' }] };
  await assert.rejects(service.write(admin, 'guardarReceta', data, key), status(409));
  const result = await service.write(admin, 'guardarReceta', { ...data, version: 2 }, key);
  assert.deepEqual(result, { id: 4, id_receta: 4, version: 3 });
  assert.ok(calls.some(call => /UPDATE RECETA/.test(call.sql)));
  assert.ok(calls.every(call => !/UPDATE MOVIMIENTO|DELETE FROM MOVIMIENTO/.test(call.sql)));
});

test('cliente consulta catálogo activo sin conocer cantidades de recetas o ingredientes', async () => {
  const { pool } = fake(sql => {
    if (/COUNT/.test(sql)) return [{ total: 1 }];
    if (/FROM PRODUCTO/.test(sql)) return [{ id_producto: 1, existencia: 5, activo: 1 }];
    if (/FROM RECETA/.test(sql)) return [{ id_receta: 4, id_producto: 1, rendimiento: 1, activo: 1 }];
    if (/FROM DETALLE_RECETA/.test(sql)) return [{ id_ingrediente: 2, cantidad: '0.100', existencia: '0.300', unidad: 'kg', activo: 1 }];
    return [];
  });
  const result = await createManagement(pool).read(client, 'productos', {});
  assert.equal(result.items[0].disponibilidad.unidades, 3);
  assert.equal(result.items[0].receta.detalles, undefined);
  assert.equal(JSON.stringify(result).includes('id_ingrediente'), false);
});

test('editar una receta antigua conserva su rendimiento para no reinterpretar consumos', async () => {
  const { pool, calls } = fake(sql => {
    if (/FROM PRODUCTO .*FOR UPDATE/.test(sql)) return [{ id_producto: 1, version: 1, activo: 1 }];
    if (/FROM RECETA .*FOR UPDATE/.test(sql)) return [{ id_receta: 4, id_producto: 1, version: 2, activo: 1, rendimiento: 6 }];
    if (/FROM INGREDIENTE .*FOR UPDATE/.test(sql)) return [{ id_ingrediente: 2, version: 1, activo: 1 }];
    return { affectedRows: 1 };
  });
  await createManagement(pool).write(admin, 'guardarReceta', { id: 4, version: 2, id_producto: 1, nombre: 'Lote histórico', detalles: [{ id_ingrediente: 2, cantidad: '0.600' }] }, key);
  const update = calls.find(call => /UPDATE RECETA/.test(call.sql));
  assert.ok(update.values.includes(6));
});

test('se puede desactivar una receta que contiene ingredientes ya inactivos', async () => {
  const { pool } = fake(sql => {
    if (/FROM PRODUCTO .*FOR UPDATE/.test(sql)) return [{ id_producto: 1, version: 1, activo: 1 }];
    if (/FROM RECETA .*FOR UPDATE/.test(sql)) return [{ id_receta: 4, id_producto: 1, version: 2, activo: 1, rendimiento: 1 }];
    if (/FROM INGREDIENTE .*FOR UPDATE/.test(sql)) return [{ id_ingrediente: 2, version: 1, activo: 0 }];
    return { affectedRows: 1 };
  });
  const result = await createManagement(pool).write(admin, 'guardarReceta', { id: 4, version: 2, id_producto: 1, nombre: 'Retirada', activo: false, detalles: [{ id_ingrediente: 2, cantidad: '0.600' }] }, key);
  assert.equal(result.version, 3);
});
