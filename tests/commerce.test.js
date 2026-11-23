import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommerce, commerceRules } from '../server/commerce.js';

const client = { id_usuario: 20, rol: 'Cliente', activo: 1 };
const worker = { id_usuario: 21, rol: 'Trabajador', activo: 1 };
const admin = { id_usuario: 22, rol: 'Administrador', activo: 1 };

// SQL is the external boundary; transaction/idempotency helpers remain real.
function writeDatabase(respond) {
  const operations=new Map();
  const connection={async beginTransaction(){},async commit(){},async rollback(){},release(){},async execute(sql,params=[]) {
    if(sql.startsWith('INSERT INTO OPERACION')) {
      const id=`${params[0]}:${params[1]}`;
      if(!operations.has(id))operations.set(id,{huella:params[3],resultado:null});
      return [{affectedRows:1}];
    }
    if(sql.startsWith('SELECT huella,resultado FROM OPERACION'))return [[operations.get(`${params[0]}:${params[1]}`)]];
    if(sql.startsWith('UPDATE OPERACION')){operations.get(`${params[1]}:${params[2]}`).resultado=params[0];return [{affectedRows:1}];}
    return [await respond(sql,params)];
  }};
  return {async getConnection(){return connection;}};
}

test('comercio deriva recursos y acciones desconocidos sin consultar SQL', async () => {
  const service = createCommerce({ execute() { throw new Error('SQL inesperado'); } });
  assert.equal(await service.read(client, 'productos', {}), undefined);
  assert.equal(await service.write(client, 'guardarProducto', {}, 'x'), undefined);
});

test('cliente no puede cobrar y trabajador no puede gestionar compras ni resumen ajeno', async () => {
  const service = createCommerce({});
  for (const action of ['vender','cobrarPedido','entregarPedido','cotizarPedido','actualizarPedido']) {
    await assert.rejects(service.write(client, action, {}, 'x'), { status: 403 });
  }
  for (const action of ['guardarCompra','recibirCompra','cancelarCompra']) {
    await assert.rejects(service.write(worker, action, {}, 'x'), { status: 403 });
  }
  await assert.rejects(service.read(client, 'resumen', {}), { status: 403 });
  await assert.rejects(service.read(worker, 'compras', {}), { status: 403 });
});

test('cantidades de producto enteras, líneas distintas y total exacto a precio servidor', () => {
  const lines = commerceRules.productLines([{id_producto:2,cantidad:'3'},{id_producto:1,cantidad:'2'}]);
  assert.deepEqual(lines.map(l=>l.id_producto), [1,2]);
  assert.equal(commerceRules.productTotal(lines, [{id_producto:1,precio:'0.10'},{id_producto:2,precio:'19.99'}]), 6017);
  assert.throws(()=>commerceRules.productLines([{id_producto:1,cantidad:'1.5'}]), {status:400});
  assert.throws(()=>commerceRules.productLines([{id_producto:1,cantidad:'1'},{id_producto:1,cantidad:'2'}]), {status:400});
});

test('consumo agrega ingredientes compartidos y redondea por ingrediente una sola vez', () => {
  const lines = [{id_producto:1,cantidad:1},{id_producto:2,cantidad:1}];
  const recipes = [{id_producto:1,id_ingrediente:9,cantidad:'0.001',rendimiento:3},{id_producto:2,id_ingrediente:9,cantidad:'0.001',rendimiento:3}];
  assert.deepEqual(commerceRules.consumption(lines, recipes), [{id_ingrediente:9,mills:1}]);
  assert.throws(()=>commerceRules.consumption(lines, recipes.slice(0,1)), {status:409});
});

test('cotización ajena, antigua o aceptada no se acepta ni se modifica', () => {
  const order = {id_cliente:20,version:2,tipo:'Personalizado',estado:'Pendiente',cotizacion_estado:'Pendiente de aceptación',cotizacion_version:3};
  assert.doesNotThrow(()=>commerceRules.accept(order,client,{version:2,cotizacion_version:3}));
  assert.throws(()=>commerceRules.accept(order,{...client,id_usuario:30},{version:2,cotizacion_version:3}), {status:403});
  assert.throws(()=>commerceRules.accept(order,client,{version:2,cotizacion_version:2}), {status:409});
  assert.throws(()=>commerceRules.accept({...order,cotizacion_estado:'Aceptado'},client,{version:2,cotizacion_version:3}), {status:409});
});

test('transiciones impiden preparación personalizada sin aceptar y salto a entregado', () => {
  const order = {estado:'Pendiente',tipo:'Personalizado',cotizacion_estado:'Por cotizar'};
  assert.throws(()=>commerceRules.transition(order,'En progreso'), {status:409});
  assert.throws(()=>commerceRules.transition({...order,tipo:'Catalogo'},'Despachado'), {status:409});
  assert.equal(commerceRules.transition({...order,cotizacion_estado:'Aceptado',aceptada_version:1,cotizacion_version:1},'En preparación'),'En progreso');
  assert.equal(commerceRules.transition({estado:'En progreso',tipo:'Catalogo'},'Listo'),'Listo');
});

test('lectura de pedidos aplica titular en listado y detalle y conserva saldo cancelado cero', async () => {
  const calls=[];
  const db={async execute(sql,params) {
    calls.push({sql,params});
    if(sql.includes('COUNT(*)'))return [[{total:1}]];
    if(sql.includes('FROM PEDIDO p'))return [[{id:5,id_pedido:5,id_cliente:20,total:'40.00',anticipo:'0.00',saldo:'0.00',estado:'Cancelado',tipo:'Catalogo'}]];
    return [[]];
  }};
  const service=createCommerce(db);
  const result=await service.read(client,'pedidos',{pagina:'1',limite:'10'});
  assert.equal(result.total,1);
  assert.equal(result.items[0].saldo,'0.00');
  assert.ok(calls.every(c=>c.sql.includes('p.id_cliente=?') && c.params.includes(20)));
  calls.length=0;
  const detail=await service.read(client,'pedidos',{id:'5'});
  assert.equal(detail.id,5);
  assert.deepEqual(detail.pagos,[]);
  assert.ok(calls[0].sql.includes('p.id_cliente=?'));
});

test('trabajador ve exclusivamente sus ventas y no admite paginación ni fechas inválidas', async () => {
  const calls=[];
  const service=createCommerce({async execute(sql,params){calls.push({sql,params});return [sql.includes('COUNT(*)')?[{total:0}]:[]];}});
  assert.deepEqual(await service.read(worker,'ventas',{}),{items:[],total:0,pagina:1,limite:20});
  assert.ok(calls.every(c=>c.sql.includes('v.id_usuario=?') && c.params.includes(21)));
  await assert.rejects(service.read(worker,'ventas',{pagina:'-1'}),{status:400});
  await assert.rejects(service.read(worker,'ventas',{desde:'2026-02-30'}),{status:400});
});

test('resumen suma cobros recibidos independientemente de devoluciones e ignora saldo inicial', async () => {
  const calls=[];
  const service=createCommerce({async execute(sql,params){
    calls.push({sql,params});
    if(sql.includes('FROM PAGO'))return [[{cobros:'50.00',cantidad:2}]];
    if(sql.includes('FROM DEVOLUCION'))return [[{devoluciones:'20.00'}]];
    if(sql.includes('SUM(v.total)'))return [[{ventas:1,total_ventas:'90.00'}]];
    if(sql.includes('FROM PEDIDO'))return [[{pedidos_abiertos:1,pedidos_para_entregar:0}]];
    if(sql.includes('FROM PRODUCTO'))return [[{productos_activos:2}]];
    if(sql.includes('FROM INGREDIENTE'))return [[{ingredientes_bajo_minimo:0}]];
    return [[]];
  }});
  const result=await service.read(worker,'resumen',{desde:'2026-11-01',hasta:'2026-11-06'});
  assert.equal(result.cobros,'50.00');assert.equal(result.devoluciones,'20.00');
  const cash=calls.find(c=>c.sql.includes('FROM PAGO'));
  assert.ok(cash.sql.includes("metodo_pago<>'Saldo inicial'"));
  assert.ok(!cash.sql.includes('devuelto=0'));
  assert.ok(cash.params.includes(21));
  assert.ok(!calls.some(c=>c.sql.includes('FROM PRODUCTO') || c.sql.includes('FROM INGREDIENTE')));
});

test('cancelación pagada requiere administrador y nunca admite entregados', () => {
  const order = {estado:'Pendiente',anticipo:'20.00',id_cliente:20};
  assert.throws(()=>commerceRules.cancel(order,client), {status:403});
  assert.throws(()=>commerceRules.cancel(order,worker), {status:403});
  assert.doesNotThrow(()=>commerceRules.cancel(order,admin));
  assert.throws(()=>commerceRules.cancel({...order,estado:'Despachado'},admin), {status:409});
  assert.throws(()=>commerceRules.cancel({...order,estado:'En progreso',anticipo:'0.00'},client), {status:409});
});

test('pedido de catálogo con total cero se rechaza como una venta gratuita', async () => {
  const pool=writeDatabase(async sql=> {
    if(sql.includes('FROM USUARIO'))return [{id_usuario:20}];
    if(sql.includes('FROM PRODUCTO'))return [{id_producto:1,nombre:'Producto cero',precio:'0.00',activo:1,categoria_activa:1}];
    return {insertId:1,affectedRows:1};
  });
  await assert.rejects(createCommerce(pool).write(client,'prepararPedido',{modalidad_pago:'Efectivo',detalles:[{id_producto:1,cantidad:'1'}]}),{status:400});
});

test('el cliente consulta comprobante sin recibir consumos internos ni ingredientes', async () => {
  const service=createCommerce({async execute(sql) {
    if(sql.includes('FROM VENTA v'))return [[{id:1,id_venta:1,id_pedido:2,id_cliente:20,total:'50.00'}]];
    if(sql.includes('FROM HISTORIAL_PEDIDO'))return [[{accion:'Entrega',detalle:{id_venta:1,consumo:[{id_ingrediente:1,cantidad:'0.200'}]}}]];
    if(sql.includes('FROM MOVIMIENTO_INGREDIENTE'))return [[{id_ingrediente:1,cantidad:'-0.200'}]];
    return [[]];
  }});
  const result=await service.read(client,'ventas',{id:1});
  assert.equal(result.movimientos,undefined);
  assert.equal(result.historial[0].detalle.consumo,undefined);
  assert.equal(result.historial[0].detalle.id_venta,1);
});

test('cambiar estado conservando fecha comprometida no obliga a inventar un retraso', async () => {
  const pool=writeDatabase(async sql=> {
    if(sql.includes('FROM PEDIDO'))return [{id_pedido:1,id_cliente:20,tipo:'Catalogo',total:'50.00',anticipo:'0.00',estado:'Pendiente',version:1,fecha_entrega:'2026-11-20 10:00:00',motivo_retraso:null,id_trabajador:null}];
    return {affectedRows:1,insertId:1};
  });
  const result=await createCommerce(pool).write(worker,'actualizarPedido',{id:1,version:1,estado:'En preparación',fecha_entrega:'2026-11-20T10:00',motivo_retraso:''},'00000000-0000-4000-8000-000000000002');
  assert.equal(result.estado,'En progreso');
  assert.equal(result.version,2);
});
