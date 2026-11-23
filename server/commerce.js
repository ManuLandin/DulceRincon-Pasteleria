import { AppError } from './errors.js';
import { parseMoney, parseQuantity, money, quantity, lineTotal } from './amounts.js';
import { transaction, once } from './transactions.js';
import {notifyHistory,notifyBusiness} from './notifications.js';
import {depositCents,pickupDate,assertAccepted,issueCheckoutQuote,verifyCheckoutQuote,issueTransferAuthorization,planDelivery} from './order-policy.js';
import {bankPreview,lastTransfer,submitTransfer,reviewTransfer,registerConfirmedTransfer} from './order-payments.js';
import {persistReferences,referenceList} from './order-references.js';

const fail = (status, message) => { throw new AppError(status, message); };
const MAX_MONEY = 9999999999;
const MAX_QUANTITY = 999999999999;
const actions = new Set(['prepararVenta','guardarCompra','recibirCompra','cancelarCompra','vender','crearPedido','cotizarPedido','aceptarCotizacion','rechazarCotizacion','actualizarPedido','cobrarPedido','entregarPedido','cancelarPedido']);
const resources = new Set(['compras','ventas','pedidos','resumen']);
const methods = new Set(['Efectivo','Transferencia']);
for(const action of ['prepararPedido','enviarReferencia','revisarTransferencia'])actions.add(action);
const staff = actor => ['Administrador','Trabajador'].includes(actor?.rol);
function requireActor(actor) { if (!actor?.id_usuario || !actor.activo) fail(403,'La cuenta no está activa.'); }
function integer(value, label = 'Identificador', max = 2147483647) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)>max) fail(400,`${label} inválido.`);
  return Number(value);
}
function text(value, max = 255, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.trim().length>max || (required && !value.trim())) fail(400,'Texto inválido.');
  return value.trim() || null;
}
function date(value, required = false) {
  if ((value == null || value==='') && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(value)) fail(400,'Fecha inválida.');
  const normalized = value.replace('T',' ');
  const [day,time] = normalized.split(' ');
  const parsed = new Date(`${day}T${time}Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==day || +time.slice(0,2)>23 || +time.slice(3,5)>59 || (time.length>5 && +time.slice(6)>59)) fail(400,'Fecha inválida.');
  return normalized.length===16 ? `${normalized}:00` : normalized;
}
function moneyInput(value, positive = false) { const n=parseMoney(value); if (positive && n<=0) fail(400,'El importe debe ser positivo.'); return n; }
function boundedTotal(n) { if (!Number.isSafeInteger(n) || n<0 || n>MAX_MONEY) fail(400,'El total supera el límite permitido.'); return n; }
function method(value) { if (!methods.has(value)) fail(400,'Selecciona un método de pago válido.'); return value; }
function list(value) { if (!Array.isArray(value) || !value.length || value.length>100) fail(400,'Agrega de 1 a 100 líneas.'); return value; }
function version(row, data) { if (integer(data.version,'Versión')!==Number(row.version)) fail(409,'El registro cambió. Actualiza antes de continuar.'); }
function owner(order, actor) { if (actor.rol==='Cliente' && Number(order.id_cliente)!==Number(actor.id_usuario)) fail(403,'No puedes acceder a este pedido.'); }
function open(order) { if (['Despachado','Cancelado'].includes(order.estado)) fail(409,'El pedido está cerrado.'); }
function accepted(order) { assertAccepted(order); if (order.tipo==='Personalizado' && (order.cotizacion_estado!=='Aceptado' || Number(order.aceptada_version)!==Number(order.cotizacion_version))) fail(409,'El cliente debe aceptar la cotización vigente.'); }
function productLines(details) {
  const ids = new Set();
  return list(details).map(row=> {
    const id_producto=integer(row.id_producto);
    if (ids.has(id_producto)) fail(400,'No repitas productos.');
    ids.add(id_producto);
    return {id_producto,cantidad:integer(row.cantidad,'Cantidad')};
  }).sort((a,b)=>a.id_producto-b.id_producto);
}
function ingredientLines(details, prices = false) {
  const ids = new Set();
  return list(details).map(row=> {
    const id_ingrediente=integer(row.id_ingrediente);
    if (ids.has(id_ingrediente)) fail(400,'No repitas ingredientes.');
    ids.add(id_ingrediente);
    const mills=parseQuantity(row.cantidad);
    if (!mills) fail(400,'La cantidad debe ser positiva.');
    const result={id_ingrediente,mills};
    if (prices) result.cents=moneyInput(row.precio_unitario);
    return result;
  }).sort((a,b)=>a.id_ingrediente-b.id_ingrediente);
}
function productTotal(lines, products) {
  let total=0n;
  for (const line of lines) {
    const product=products.find(p=>Number(p.id_producto)===line.id_producto);
    if (!product) fail(409,'Uno de los productos ya no está disponible.');
    total += BigInt(line.cantidad)*BigInt(parseMoney(product.precio));
  }
  return boundedTotal(Number(total));
}
function gcd(a,b) { while(b) { const n=a%b; a=b; b=n; } return a; }
function consumption(lines, recipes) {
  const totals=new Map();
  for (const line of lines) {
    const rows=recipes.filter(r=>Number(r.id_producto)===line.id_producto);
    if (!rows.length) fail(409,`Falta receta activa del producto ${line.id_producto}.`);
    for (const recipe of rows) {
      const denominator=BigInt(integer(recipe.rendimiento,'Rendimiento'));
      const numerator=BigInt(parseQuantity(recipe.cantidad))*BigInt(line.cantidad);
      const old=totals.get(Number(recipe.id_ingrediente)) || [0n,1n];
      const n=old[0]*denominator+numerator*old[1], d=old[1]*denominator, g=gcd(n,d);
      totals.set(Number(recipe.id_ingrediente),[n/g,d/g]);
    }
  }
  return [...totals].map(([id_ingrediente,[n,d]])=> {
    const mills=Number((n*2n+d)/(d*2n));
    if (!Number.isSafeInteger(mills) || mills>MAX_QUANTITY) fail(400,'El consumo supera el límite permitido.');
    return {id_ingrediente,mills};
  }).sort((a,b)=>a.id_ingrediente-b.id_ingrediente);
}
function accept(order, actor, data) {
  owner(order,actor); version(order,data); open(order);
  if (order.tipo!=='Personalizado' || order.cotizacion_estado!=='Pendiente de aceptación' || Number(data.cotizacion_version)!==Number(order.cotizacion_version)) fail(409,'La cotización no está vigente. Actualiza el pedido.');
}
function transition(order, state) {
  const next=({'En preparación':'En progreso','Entregado':'Despachado'})[state] || state;
  open(order);
  if (next===order.estado) return next;
  const allowed={'Pendiente':'En progreso','En progreso':'Listo'};
  if (allowed[order.estado]!==next) fail(409,'El cambio de estado no está permitido.');
  accepted(order);
  return next;
}
function cancel(order, actor) {
  owner(order,actor); open(order);
  const paid=parseMoney(order.anticipo);
  if (paid>0 && actor.rol!=='Administrador') fail(403,'Un administrador debe registrar la devolución completa.');
  if (!paid && order.estado!=='Pendiente') fail(409,'Solo se cancelan pedidos que no han empezado a prepararse.');
}
export const commerceRules = Object.freeze({productLines,productTotal,consumption,accept,transition,cancel});

async function rows(db, sql, params=[]) { const [result]=await db.execute(sql,params); return result; }
async function one(db, sql, params=[]) { return (await rows(db,sql,params))[0]; }
async function getOrder(db, id) {
  const order=await one(db,'SELECT * FROM PEDIDO WHERE id_pedido=? FOR UPDATE',[integer(id)]);
  if (!order) fail(404,'Pedido no encontrado.');
  return order;
}
async function history(db, id, actor, action, detail) {
  const event=await rows(db,'INSERT INTO HISTORIAL_PEDIDO (id_pedido,id_usuario,accion,detalle) VALUES (?,?,?,?)',[id,actor.id_usuario,action,JSON.stringify(detail)]);
  await notifyHistory(db,id,event.insertId,actor,action,detail);
}
async function checkCustomer(db, id) {
  const user=await one(db,"SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? AND u.activo=1 AND r.nombre='Cliente' FOR SHARE",[integer(id)]);
  if (!user) fail(400,'Selecciona un cliente activo.');
  return Number(user.id_usuario);
}
async function lockedProducts(db, lines) {
  const products=[];
  for (const line of lines) {
    const product=await one(db,'SELECT p.*,c.activo AS categoria_activa FROM PRODUCTO p JOIN CATEGORIA_PRODUCTO c ON c.id_categoria=p.id_categoria WHERE p.id_producto=? FOR UPDATE',[line.id_producto]);
    if (!product || !product.activo || !product.categoria_activa) fail(409,'Uno de los productos no está disponible.');
    products.push(product);
  }
  return products;
}
async function recipeConsumption(db, lines) {
  const recipes=[];
  for (const line of lines) {
    const recipe=await one(db,'SELECT * FROM RECETA WHERE id_producto=? AND activo=1 FOR UPDATE',[line.id_producto]);
    if (!recipe) fail(409,`Falta receta activa del producto ${line.id_producto}.`);
    const details=await rows(db,'SELECT id_ingrediente,cantidad FROM DETALLE_RECETA WHERE id_receta=? ORDER BY id_ingrediente FOR UPDATE',[recipe.id_receta]);
    for (const detail of details) recipes.push({...detail,id_producto:line.id_producto,rendimiento:recipe.rendimiento});
  }
  return consumption(lines,recipes);
}
async function lockedIngredients(db, lines) {
  const result=[];
  for (const line of lines) {
    const ingredient=await one(db,'SELECT * FROM INGREDIENTE WHERE id_ingrediente=? FOR UPDATE',[line.id_ingrediente]);
    if (!ingredient || !ingredient.activo) fail(409,'Uno de los ingredientes no está activo.');
    result.push(ingredient);
  }
  return result;
}
async function validateStock(db, lines, products, custom,checkOnly=false) {
  const consumes=custom || await recipeConsumption(db,lines);
  const ingredients=await lockedIngredients(db,consumes);
  const shortages=[];
  for (const line of lines) {
    const product=products.find(p=>Number(p.id_producto)===line.id_producto);
    if (Number(product.existencia)<line.cantidad) shortages.push(`${product.nombre}: faltan ${line.cantidad-Number(product.existencia)} piezas`);
  }
  for (const line of consumes) {
    const ingredient=ingredients.find(i=>Number(i.id_ingrediente)===line.id_ingrediente);
    const available=parseQuantity(ingredient.existencia);
    if (available<line.mills) shortages.push(`${ingredient.nombre}: faltan ${quantity(line.mills-available)} ${ingredient.unidad}`);
  }
  if (shortages.length&&!checkOnly) fail(409,`Existencias insuficientes. ${shortages.join('; ')}.`);
  return {consumes,ingredients,faltantes:shortages};
}

async function prepareSale(db,data){
 const lines=productLines(data.detalles),products=await lockedProducts(db,lines),total=productTotal(lines,products);
 try{
  const stock=await validateStock(db,lines,products,null,true);
  return {total:money(total),puede_vender:total>0&&stock.faltantes.length===0,faltantes:stock.faltantes,detalles:snapshot(lines,products)};
 }catch(error){if(error instanceof AppError&&error.status===409)return {total:money(total),puede_vender:false,faltantes:[error.message],detalles:snapshot(lines,products)};throw error;}
}

async function orderAvailability(db,actor,order,details){
 if(['Despachado','Cancelado'].includes(order.estado))return null;
 if(order.tipo==='Personalizado')return {puede_entregar:null,pendiente_consumo:true,faltantes:[]};
 let result;
 try{
  const lines=productLines(details),products=await lockedProducts(db,lines);
  const stock=await validateStock(db,lines,products,null,true);
  result={puede_entregar:stock.faltantes.length===0,faltantes:stock.faltantes};
 }catch(error){if(!(error instanceof AppError))throw error;result={puede_entregar:false,faltantes:[error.message]};}
 if(actor.rol==='Cliente')return {puede_entregar:result.puede_entregar,faltantes:result.puede_entregar?[]:['El personal revisará los insumos y confirmará la fecha de entrega.']};
 return result;
}
async function consumeStock(db, actor, saleId, lines, products, stock) {
  for (const line of lines) {
    const product=products.find(p=>Number(p.id_producto)===line.id_producto);
    const remaining=Number(product.existencia)-line.cantidad;
    await rows(db,'UPDATE PRODUCTO SET existencia=?,version=version+1 WHERE id_producto=?',[remaining,line.id_producto]);
    await rows(db,"INSERT INTO MOVIMIENTO_PRODUCTO (id_producto,cantidad,existencia_resultante,tipo,id_venta,id_usuario,motivo) VALUES (?,?,?,'Venta',?,?,?)",[line.id_producto,-line.cantidad,remaining,saleId,actor.id_usuario,`Venta ${saleId}`]);
  }
  for (const line of stock.consumes) {
    const ingredient=stock.ingredients.find(i=>Number(i.id_ingrediente)===line.id_ingrediente);
    const remaining=parseQuantity(ingredient.existencia)-line.mills;
    await rows(db,'UPDATE INGREDIENTE SET existencia=?,version=version+1 WHERE id_ingrediente=?',[quantity(remaining),line.id_ingrediente]);
    await rows(db,"INSERT INTO MOVIMIENTO_INGREDIENTE (id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_venta,id_usuario,motivo) VALUES (?,?,?,?,'Venta',?,?,?)",[line.id_ingrediente,`-${quantity(line.mills)}`,quantity(remaining),ingredient.unidad,saleId,actor.id_usuario,`Consumo real venta ${saleId}`]);
  }
}
async function insertDetails(db, table, idColumn, id, details) {
  for (const line of details) await rows(db,`INSERT INTO ${table} (${idColumn},id_producto,nombre,cantidad,precio_unitario) VALUES (?,?,?,?,?)`,[id,line.id_producto,line.nombre,line.cantidad,line.precio_unitario]);
}
function snapshot(lines, products) {
  return lines.map(line=> {const p=products.find(p=>Number(p.id_producto)===line.id_producto);return {...line,nombre:p.nombre,precio_unitario:money(parseMoney(p.precio))};});
}
async function payment(db, actor, order, data) {
  open(order); accepted(order);
  if(Number(order.politica_pago)===1&&(order.modalidad_pago!=='Efectivo'||data.metodo_pago!=='Efectivo'))fail(409,'El saldo de este pedido solo se registra en efectivo después de verificar su anticipo.');
  const cents=moneyInput(data.importe,true), total=parseMoney(order.total), paid=parseMoney(order.anticipo);
  if (cents>total-paid) fail(409,'El cobro supera el saldo pendiente.');
  const paymentMethod=method(data.metodo_pago), reference=text(data.referencia,100);
  const paidRow=await rows(db,'INSERT INTO PAGO (id_pedido,importe,metodo_pago,id_usuario,referencia) VALUES (?,?,?,?,?)',[order.id_pedido,money(cents),paymentMethod,actor.id_usuario,reference]);
  if(paymentMethod==='Transferencia'&&reference)await registerConfirmedTransfer(db,paidRow.insertId,reference);
  order.anticipo=money(paid+cents);
  await rows(db,'UPDATE PEDIDO SET anticipo=?,version=version+1 WHERE id_pedido=?',[order.anticipo,order.id_pedido]);
  order.version++;
  await history(db,order.id_pedido,actor,'Cobro',{importe:money(cents),metodo_pago:paymentMethod,referencia:reference});
  return cents;
}
function resultOrder(order) { return {id:Number(order.id_pedido),folio:Number(order.id_pedido),estado:order.estado,version:Number(order.version),politica_pago:Number(order.politica_pago)||0,aceptacion_estado:order.aceptacion_estado,modalidad_pago:order.modalidad_pago,total:money(parseMoney(order.total)),saldo:money(parseMoney(order.total)-parseMoney(order.anticipo))}; }

async function savePurchase(db, actor, data) {
  const lines=ingredientLines(data.detalles,true);
  const total=boundedTotal(lines.reduce((sum,l)=>sum+lineTotal(l.mills,l.cents),0));
  const note=text(data.observaciones);
  let id, current;
  if (data.id) {
    current=await one(db,'SELECT * FROM COMPRA WHERE id_compra=? FOR UPDATE',[integer(data.id)]);
    if (!current) fail(404,'Compra no encontrada.');
    version(current,data);
    if (current.estado!=='Pendiente') fail(409,'La compra ya está cerrada.');
    if (data.id_proveedor && Number(data.id_proveedor)!==Number(current.id_proveedor)) fail(409,'El proveedor no se puede cambiar.');
    id=Number(current.id_compra);
  } else {
    const supplier=await one(db,'SELECT id_proveedor FROM PROVEEDOR WHERE id_proveedor=? AND activo=1 FOR SHARE',[integer(data.id_proveedor)]);
    if (!supplier) fail(400,'Selecciona un proveedor activo.');
  }
  await lockedIngredients(db,lines);
  if (!current) {
    const inserted=await rows(db,'INSERT INTO COMPRA (id_proveedor,id_usuario,total,observaciones) VALUES (?,?,?,?)',[Number(data.id_proveedor),actor.id_usuario,money(total),note]);
    id=inserted.insertId;
  } else {
    await rows(db,'UPDATE COMPRA SET total=?,observaciones=?,version=version+1 WHERE id_compra=?',[money(total),note,id]);
    await rows(db,'DELETE FROM DETALLE_COMPRA WHERE id_compra=?',[id]);
  }
  for (const line of lines) await rows(db,'INSERT INTO DETALLE_COMPRA (id_compra,id_ingrediente,cantidad,precio_unitario) VALUES (?,?,?,?)',[id,line.id_ingrediente,quantity(line.mills),money(line.cents)]);
  if(!current)await notifyBusiness(db,'Compra',id,'Creada');
  return {id,folio:id,version:current?Number(current.version)+1:1,estado:'Pendiente',total:money(total)};
}
async function changePurchase(db, actor, action, data) {
  const purchase=await one(db,'SELECT * FROM COMPRA WHERE id_compra=? FOR UPDATE',[integer(data.id)]);
  if (!purchase) fail(404,'Compra no encontrada.');
  version(purchase,data);
  if (purchase.estado!=='Pendiente') fail(409,'La compra ya está cerrada.');
  const state=action==='recibirCompra'?'Recibida':'Cancelada';
  if (state==='Recibida') {
    const details=await rows(db,'SELECT * FROM DETALLE_COMPRA WHERE id_compra=? ORDER BY id_ingrediente FOR UPDATE',[purchase.id_compra]);
    if (!details.length) fail(409,'La compra no tiene ingredientes.');
    const lines=ingredientLines(details,true), ingredients=await lockedIngredients(db,lines);
    for (const line of lines) {
      const ingredient=ingredients.find(i=>Number(i.id_ingrediente)===line.id_ingrediente);
      const remaining=parseQuantity(ingredient.existencia)+line.mills;
      if (remaining>MAX_QUANTITY) fail(400,'La recepción supera el límite de existencias.');
      await rows(db,'UPDATE INGREDIENTE SET existencia=?,version=version+1 WHERE id_ingrediente=?',[quantity(remaining),line.id_ingrediente]);
      await rows(db,"INSERT INTO MOVIMIENTO_INGREDIENTE (id_ingrediente,cantidad,existencia_resultante,unidad,tipo,id_compra,id_usuario,motivo) VALUES (?,?,?,?,'Compra',?,?,?)",[line.id_ingrediente,quantity(line.mills),quantity(remaining),ingredient.unidad,purchase.id_compra,actor.id_usuario,`Recepción compra ${purchase.id_compra}`]);
    }
  }
  await rows(db,'UPDATE COMPRA SET estado=?,version=version+1 WHERE id_compra=?',[state,purchase.id_compra]);
  await notifyBusiness(db,'Compra',purchase.id_compra,state);
  return {id:Number(purchase.id_compra),folio:Number(purchase.id_compra),estado:state,version:Number(purchase.version)+1};
}
async function sell(db, actor, data) {
  const lines=productLines(data.detalles), products=await lockedProducts(db,lines), total=productTotal(lines,products);
  if (!total) fail(400,'La venta debe tener un total positivo.');
  if(moneyInput(data.total_autorizado)!==total){const error=new AppError(409,'El precio cambió antes de confirmar la venta. El total actual es $'+money(total)+'. Revisa el importe y confirma de nuevo antes de cobrar.');error.priceChanged=true;throw error;}
  const customer=data.id_cliente?await checkCustomer(db,data.id_cliente):null;
  const paymentMethod=method(data.metodo_pago), reference=text(data.referencia,100);
  if(paymentMethod==='Transferencia'&&(!reference||data.transferencia_verificada!==true))fail(400,'Captura la referencia y confirma que comprobaste el ingreso de la transferencia.');
  const received=data.recibido==null || data.recibido===''?total:moneyInput(data.recibido);
  if (received<total) fail(400,'El importe recibido no cubre el total.');
  const stock=await validateStock(db,lines,products);
  const sale=await rows(db,'INSERT INTO VENTA (id_usuario,id_cliente,total,metodo_pago) VALUES (?,?,?,?)',[actor.id_usuario,customer,money(total),paymentMethod]);
  const id=sale.insertId;
  await insertDetails(db,'DETALLE_VENTA','id_venta',id,snapshot(lines,products));
  await consumeStock(db,actor,id,lines,products,stock);
  const receipt=await rows(db,'INSERT INTO PAGO (id_venta,importe,metodo_pago,id_usuario,referencia) VALUES (?,?,?,?,?)',[id,money(total),paymentMethod,actor.id_usuario,reference]);
  if(paymentMethod==='Transferencia')await registerConfirmedTransfer(db,receipt.insertId,reference);
  await notifyBusiness(db,'Venta',id,'Completada');
  return {id,folio:id,total:money(total),estado:'Pagada',cambio:money(paymentMethod==='Efectivo'?received-total:0)};
}
async function prepareOrder(db,actor,data) {
  if(data.id){
    const order=await getOrder(db,data.id);owner(order,actor);open(order);
    if(order.tipo==='Personalizado'&&order.cotizacion_estado!=='Aceptado')fail(409,'Acepta primero la cotización del personalizado.');
    const latest=await lastTransfer(db,order.id_pedido);
    const preview=await bankPreview(db,parseMoney(order.total),data.modalidad_pago,latest?.config_version);
    return {...preview,autorizacion_pago:issueTransferAuthorization(actor.id_usuario,order,{modalidad_pago:data.modalidad_pago,config_version:preview.configuracion_bancaria.version})};
  }
  const lines=productLines(data.detalles),products=await lockedProducts(db,lines),total=productTotal(lines,products);
  const preview=await bankPreview(db,total,data.modalidad_pago);
  return {...preview,cotizacion_checkout:issueCheckoutQuote(actor.id_usuario,lines.map(line=>({...line,precio_centavos:parseMoney(products.find(p=>Number(p.id_producto)===line.id_producto).precio)})),{modalidad_pago:data.modalidad_pago,config_version:preview.configuracion_bancaria.version})};
}
async function createOrder(db, actor, data, files=[]) {
  const customer=await checkCustomer(db,actor.rol==='Cliente'?actor.id_usuario:data.id_cliente);
  if (data.tipo && !['Catalogo','Personalizado'].includes(data.tipo)) fail(400,'Tipo de pedido inválido.');
  const custom=data.tipo==='Personalizado', description=custom?text(data.descripcion_personalizada,1000,true):null;
  const requested=pickupDate(data.fecha_solicitada), note=text(data.observaciones);
  let details,total,quoteHash=null;
  if (custom) { details=[{id_producto:null,nombre:description.slice(0,100),cantidad:1,precio_unitario:'0.00'}]; total=0; }
  else {
    const lines=productLines(data.detalles);
    const quote=verifyCheckoutQuote(data.cotizacion_checkout,actor.id_usuario,lines,data);total=quote.total;quoteHash=quote.hash;
    if(await one(db,'SELECT id_pedido FROM PEDIDO WHERE cotizacion_checkout_hash=?',[quoteHash]))fail(409,'Esta cotización ya tiene un pedido. Consulta Mis pedidos antes de enviar otra solicitud.');
    if(parseMoney(data.total_autorizado)!==total)fail(409,'Confirma el importe mostrado antes de enviar la referencia.');
    details=[];
    for(const line of lines){
      const product=await one(db,'SELECT id_producto,nombre FROM PRODUCTO WHERE id_producto=? FOR UPDATE',[line.id_producto]);
      if(!product)fail(409,'No se encontró un producto de la cotización.');
      const price=quote.lines.find(item=>item[0]===line.id_producto)[2];details.push({...line,nombre:product.nombre,precio_unitario:money(price)});
    }
  }
  const inserted=await rows(db,'INSERT INTO PEDIDO (id_cliente,tipo,descripcion_personalizada,fecha_solicitada,total,observaciones,cotizacion_estado,politica_pago,aceptacion_estado,cotizacion_checkout_hash) VALUES (?,?,?,?,?,?,?,1,?,?)',[customer,custom?'Personalizado':'Catalogo',description,requested,money(total),note,custom?'Por cotizar':'No aplica',custom?'Pendiente de precio':'Pendiente de referencia',quoteHash]);
  const order=await getOrder(db,inserted.insertId);
  await insertDetails(db,'DETALLE_PEDIDO','id_pedido',order.id_pedido,details);
  if(files.length){if(!custom)fail(400,'Solo los personalizados admiten referencias.');await persistReferences(db,order.id_pedido,actor,files);}
  if(!custom)await submitTransfer(db,actor,order,data,history,{initial:true});
  await history(db,order.id_pedido,actor,'Creación',{tipo:custom?'Personalizado':'Catalogo',fecha_solicitada:requested,total:custom?null:money(total),aceptacion_estado:order.aceptacion_estado});
  const result={...resultOrder(order),referencias:await referenceList(db,order.id_pedido)};
  if(custom){result.total=null;result.saldo=null;}return result;
}
async function sendReference(db,actor,data){
  const order=await getOrder(db,data.id);owner(order,actor);version(order,data);open(order);
  await submitTransfer(db,actor,order,data,history);return resultOrder(order);
}
async function validateReference(db,actor,data){
  const order=await getOrder(db,data.id);version(order,data);open(order);
  await reviewTransfer(db,actor,order,data,history);return resultOrder(order);
}
async function quoteOrder(db, actor, data) {
  const order=await getOrder(db,data.id);version(order,data);open(order);
  if (order.tipo!=='Personalizado' || !['Por cotizar','Pendiente de aceptación'].includes(order.cotizacion_estado) || order.estado!=='Pendiente') fail(409,'El precio del pedido ya no se puede cambiar.');
  const total=moneyInput(data.total,true), delivery=pickupDate(data.fecha_entrega||order.fecha_entrega||order.fecha_solicitada), note=text(data.nota);
  await rows(db,"UPDATE PEDIDO SET total=?,fecha_entrega=?,cotizacion_estado='Pendiente de aceptación',cotizacion_version=cotizacion_version+1,version=version+1 WHERE id_pedido=?",[money(total),delivery,order.id_pedido]);
  await rows(db,'UPDATE DETALLE_PEDIDO SET precio_unitario=? WHERE id_pedido=? AND id_producto IS NULL',[money(total),order.id_pedido]);
  await history(db,order.id_pedido,actor,'Cotización',{total:money(total),fecha_entrega:delivery,nota:note,cotizacion_version:Number(order.cotizacion_version)+1});
  return {...resultOrder({...order,total:money(total),version:Number(order.version)+1}),cotizacion_version:Number(order.cotizacion_version)+1,cotizacion_estado:'Pendiente de aceptación'};
}
async function respondQuote(db, actor, action, data) {
  const order=await getOrder(db,data.id);accept(order,actor,data);
  if (action==='aceptarCotizacion') {
    await rows(db,"UPDATE PEDIDO SET cotizacion_estado='Aceptado',aceptada_version=cotizacion_version,aceptada_fecha=CURRENT_TIMESTAMP,version=version+1 WHERE id_pedido=?",[order.id_pedido]);
    if(Number(order.politica_pago)===1)await rows(db,"UPDATE PEDIDO SET aceptacion_estado='Pendiente de referencia' WHERE id_pedido=?",[order.id_pedido]);
    await history(db,order.id_pedido,actor,'Aceptación',{cotizacion_version:Number(order.cotizacion_version),total:order.total});
  } else {
    await rows(db,"UPDATE PEDIDO SET cotizacion_estado='Rechazado',estado='Cancelado',version=version+1 WHERE id_pedido=?",[order.id_pedido]);
    order.estado='Cancelado';
    await history(db,order.id_pedido,actor,'Rechazo',{cotizacion_version:Number(order.cotizacion_version)});
  }
  return {...resultOrder({...order,version:Number(order.version)+1}),cotizacion_estado:action==='aceptarCotizacion'?'Aceptado':'Rechazado'};
}
async function updateOrder(db, actor, data) {
  const order=await getOrder(db,data.id);version(order,data);open(order);
  const state=data.estado?transition(order,data.estado):order.estado;
  let worker=order.id_trabajador;
  const {fecha_entrega:delivery,motivo_retraso:delay}=planDelivery(order,data);
  if ('id_trabajador' in data) {
    worker=data.id_trabajador?integer(data.id_trabajador):null;
    if (worker) {
      const user=await one(db,"SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? AND u.activo=1 AND r.nombre='Trabajador' FOR SHARE",[worker]);
      if (!user) fail(400,'Selecciona un trabajador activo.');
    }
  }
  await rows(db,'UPDATE PEDIDO SET estado=?,id_trabajador=?,fecha_entrega=?,motivo_retraso=?,version=version+1 WHERE id_pedido=?',[state,worker,delivery,delay,order.id_pedido]);
  await history(db,order.id_pedido,actor,'Actualización',{estado_anterior:order.estado,estado:state,id_trabajador_anterior:order.id_trabajador,id_trabajador:worker,fecha_entrega:delivery,motivo_retraso:delay});
  return resultOrder({...order,estado:state,version:Number(order.version)+1});
}
async function chargeOrder(db, actor, data) {
  const order=await getOrder(db,data.id);version(order,data);
  await payment(db,actor,order,data);
  return resultOrder(order);
}
async function deliverOrder(db, actor, data) {
  const order=await getOrder(db,data.id);version(order,data);open(order);accepted(order);
  if (order.estado!=='Listo') fail(409,'El pedido debe estar listo antes de entregarlo.');
  const details=await rows(db,'SELECT * FROM DETALLE_PEDIDO WHERE id_pedido=? ORDER BY id_producto FOR UPDATE',[order.id_pedido]);
  if (!details.length) fail(409,'El pedido no tiene artículos.');
  const custom=order.tipo==='Personalizado';
  const lines=custom?[]:productLines(details);
  const products=custom?[]:await lockedProducts(db,lines);
  const customConsumption=custom?ingredientLines(data.detalles):null;
  const stock=await validateStock(db,lines,products,customConsumption);
  if (data.pago) await payment(db,actor,order,data.pago);
  if (parseMoney(order.total)!==parseMoney(order.anticipo)) fail(409,'Liquida el saldo antes de entregar.');
  const payments=await rows(db,'SELECT DISTINCT metodo_pago FROM PAGO WHERE id_pedido=? AND devuelto=0 ORDER BY metodo_pago',[order.id_pedido]);
  const summaryMethod=payments.length===1 && ['Efectivo','Transferencia','Tarjeta'].includes(payments[0].metodo_pago)?payments[0].metodo_pago:'Mixto';
  const sale=await rows(db,'INSERT INTO VENTA (id_usuario,id_cliente,id_pedido,total,metodo_pago) VALUES (?,?,?,?,?)',[actor.id_usuario,order.id_cliente,order.id_pedido,order.total,summaryMethod]);
  await insertDetails(db,'DETALLE_VENTA','id_venta',sale.insertId,details);
  await consumeStock(db,actor,sale.insertId,lines,products,stock);
  await rows(db,"UPDATE PEDIDO SET estado='Despachado',version=version+1 WHERE id_pedido=?",[order.id_pedido]);
  await notifyBusiness(db,'Venta',sale.insertId,'Completada');
  await history(db,order.id_pedido,actor,'Entrega',{id_venta:sale.insertId,consumo:stock.consumes.map(l=>({id_ingrediente:l.id_ingrediente,cantidad:quantity(l.mills)}))});
  return {...resultOrder({...order,estado:'Despachado',version:Number(order.version)+1}),id_venta:sale.insertId};
}
async function cancelOrder(db, actor, data) {
  const order=await getOrder(db,data.id);owner(order,actor);version(order,data);cancel(order,actor);
  const pending=Number(order.politica_pago)===1?await lastTransfer(db,order.id_pedido):null;
  if(pending?.estado==='Pendiente')fail(409,'El personal debe resolver la transferencia pendiente antes de cancelar.');
  const paid=parseMoney(order.anticipo), reason=text(data.motivo,255,true);
  if (paid) {
    const paymentMethod=method(data.devolucion?.metodo_pago || data.metodo_pago);
    await rows(db,'INSERT INTO DEVOLUCION (id_pedido,importe,metodo_pago,id_usuario,motivo) VALUES (?,?,?,?,?)',[order.id_pedido,money(paid),paymentMethod,actor.id_usuario,reason]);
    await rows(db,'UPDATE PAGO SET devuelto=1 WHERE id_pedido=? AND devuelto=0',[order.id_pedido]);
  }
  await rows(db,"UPDATE PEDIDO SET estado='Cancelado',anticipo=0,version=version+1 WHERE id_pedido=?",[order.id_pedido]);
  await history(db,order.id_pedido,actor,'Cancelación',{motivo:reason,devolucion:money(paid)});
  return {...resultOrder({...order,estado:'Cancelado',anticipo:'0.00',version:Number(order.version)+1}),saldo:'0.00',devolucion:money(paid)};
}

function page(query) {
  const pagina=query.pagina==null?1:integer(query.pagina,'Página',1000000);
  const limite=query.limite==null?20:integer(query.limite,'Límite',100);
  return {pagina,limite};
}
function day(value) { date(`${value} 00:00:00`,true);return value; }
function nextDay(value) { const d=new Date(`${value}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10); }
function period(query, defaults = false) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const from=query.desde?day(query.desde):(defaults?today:null);
  const until=query.hasta?day(query.hasta):(defaults?today:null);
  if (from && until && from>until) fail(400,'El periodo de fechas no es válido.');
  return {from:from?`${from} 00:00:00`:null,until:until?`${nextDay(until)} 00:00:00`:null,desde:from,hasta:until};
}
function normalizedOrder(order) {
  if (order.tipo==='Personalizado' && order.cotizacion_estado==='Por cotizar') return {...order,total:null,saldo:null};
  if (order.estado==='Cancelado') return {...order,saldo:'0.00'};
  return order;
}
async function readRecords(db, actor, resource, query) {
  const pagination=page(query), filters=period(query);
  const alias=resource==='compras'?'c':resource==='ventas'?'v':'p';
  const table=resource==='compras'?'COMPRA':resource==='ventas'?'VENTA':'PEDIDO';
  const idColumn=resource==='compras'?'id_compra':resource==='ventas'?'id_venta':'id_pedido';
  const dateColumn=resource==='pedidos'?'fecha_pedido':'fecha';
  const clauses=['1=1'],params=[];
  const add=(sql,value)=>{clauses.push(sql);params.push(value);};
  if (actor.rol==='Cliente') add(`${alias}.id_cliente=?`,actor.id_usuario);
  if (resource==='ventas' && actor.rol==='Trabajador') add('v.id_usuario=?',actor.id_usuario);
  if (filters.from) add(`${alias}.${dateColumn}>=?`,filters.from);
  if (filters.until) add(`${alias}.${dateColumn}<?`,filters.until);
  if (query.estado) {
    const allowed=resource==='compras'?['Pendiente','Recibida','Cancelada']:resource==='ventas'?['Pagada','Cancelada']:['Pendiente','En progreso','Listo','Despachado','Cancelado'];
    const state=({'Entregado':'Despachado','En preparación':'En progreso'})[query.estado] || query.estado;
    if (!allowed.includes(state)) fail(400,'Estado inválido.');
    add(`${alias}.estado=?`,state);
  }
  if(query.aceptacion_estado&&resource==='pedidos'){
    if(!['Pendiente de precio','Pendiente de referencia','Pendiente de validación','Por corregir','Aceptado'].includes(query.aceptacion_estado))fail(400,'Filtro de aceptación inválido.');
    add('p.aceptacion_estado=?',query.aceptacion_estado);
  }
  if (query.id_cliente && resource!=='compras' && actor.rol!=='Cliente') add(`${alias}.id_cliente=?`,integer(query.id_cliente));
  if (query.id_proveedor && resource==='compras') add('c.id_proveedor=?',integer(query.id_proveedor));
  if (query.id_usuario && resource==='ventas' && actor.rol==='Administrador') add('v.id_usuario=?',integer(query.id_usuario));
  if (query.operador && resource==='ventas' && actor.rol==='Administrador') {
    const operatorName=text(query.operador,100,true);
    add("u.nombre LIKE ? ESCAPE '!'",'%'+operatorName.replace(/[!%_]/g,'!$&')+'%');
  }
  if (query.tipo && resource==='pedidos') {
    if (!['Catalogo','Personalizado'].includes(query.tipo)) fail(400,'Tipo inválido.');
    add('p.tipo=?',query.tipo);
  }
  let columns, joins;
  if(resource==='compras') {
    columns='c.*,c.id_compra AS id,s.nombre AS proveedor,u.nombre AS operador';
    joins='JOIN PROVEEDOR s ON s.id_proveedor=c.id_proveedor JOIN USUARIO u ON u.id_usuario=c.id_usuario';
  } else if(resource==='ventas') {
    columns="v.*,v.id_venta AS id,COALESCE(cl.nombre,'Público general') AS cliente,u.nombre AS operador";
    joins='JOIN USUARIO u ON u.id_usuario=v.id_usuario LEFT JOIN USUARIO cl ON cl.id_usuario=v.id_cliente';
  } else {
    columns="p.*,p.id_pedido AS id,p.fecha_pedido AS fecha,cl.nombre AS cliente,w.nombre AS trabajador,CASE WHEN p.estado='Cancelado' THEN 0 ELSE p.total-p.anticipo END AS saldo";
    joins='JOIN USUARIO cl ON cl.id_usuario=p.id_cliente LEFT JOIN USUARIO w ON w.id_usuario=p.id_trabajador';
  }
  if(query.buscar) {
    const search=text(query.buscar,100,true);
    const escaped='%'+search.replace(/[!%_]/g,'!$&')+'%';
    const name=resource==='compras'?'s.nombre':'cl.nombre';
    clauses.push(`(CAST(${alias}.${idColumn} AS CHAR) LIKE ? ESCAPE '!' OR ${name} LIKE ? ESCAPE '!')`);
    params.push(escaped,escaped);
  }
  if(query.id) {
    add(`${alias}.${idColumn}=?`,integer(query.id));
    const result=await one(db,`SELECT ${columns} FROM ${table} ${alias} ${joins} WHERE ${clauses.join(' AND ')} LIMIT 1`,params);
    if(!result) fail(404,'Registro no encontrado.');
    const id=Number(result[idColumn]);
    if(resource==='compras') {
      result.detalles=await rows(db,'SELECT d.*,i.nombre,i.unidad FROM DETALLE_COMPRA d JOIN INGREDIENTE i ON i.id_ingrediente=d.id_ingrediente WHERE d.id_compra=? ORDER BY d.id_detalle_compra',[id]);
      result.pagos=[];result.historial=[];
      return result;
    }
    const detailTable=resource==='ventas'?'DETALLE_VENTA':'DETALLE_PEDIDO';
    result.detalles=await rows(db,`SELECT d.*,COALESCE(d.nombre,p.nombre) AS nombre FROM ${detailTable} d LEFT JOIN PRODUCTO p ON p.id_producto=d.id_producto WHERE d.${idColumn}=? ORDER BY d.id_producto,d.nombre`,[id]);
    if(resource==='pedidos'){
      result.disponibilidad=await orderAvailability(db,actor,result,result.detalles);
      result.intentos_transferencia=await rows(db,'SELECT * FROM INTENTO_TRANSFERENCIA WHERE id_pedido=? ORDER BY id_intento',[id]);
      result.referencias=(await referenceList(db,id)).map(({archivo,...ref})=>ref);
      result.importe_transferir=parseMoney(result.total)>0?money(depositCents(parseMoney(result.total),result.modalidad_pago||'Efectivo')):null;
    }
    const orderId=resource==='pedidos'?id:result.id_pedido;
    result.pagos=await rows(db,`SELECT p.*,u.nombre AS operador FROM PAGO p LEFT JOIN USUARIO u ON u.id_usuario=p.id_usuario WHERE p.${orderId?'id_pedido':'id_venta'}=? ORDER BY p.fecha,p.id_pago`,[orderId || id]);
    result.historial=orderId?await rows(db,'SELECT h.*,u.nombre AS operador FROM HISTORIAL_PEDIDO h LEFT JOIN USUARIO u ON u.id_usuario=h.id_usuario WHERE h.id_pedido=? ORDER BY h.id_historial',[orderId]):[];
    if(actor.rol==='Cliente') result.historial=result.historial.map(entry=> {
      const detail=typeof entry.detalle==='string'?JSON.parse(entry.detalle):entry.detalle;
      if(!detail || typeof detail!=='object')return entry;
      const {consumo,...publicDetail}=detail;
      return {...entry,detalle:publicDetail};
    });
    result.devoluciones=orderId?await rows(db,'SELECT d.*,u.nombre AS operador FROM DEVOLUCION d JOIN USUARIO u ON u.id_usuario=d.id_usuario WHERE d.id_pedido=? ORDER BY d.id_devolucion',[orderId]):[];
    if(resource==='ventas' && staff(actor)) {
      result.movimientos=await rows(db,'SELECT m.*,i.nombre FROM MOVIMIENTO_INGREDIENTE m JOIN INGREDIENTE i ON i.id_ingrediente=m.id_ingrediente WHERE m.id_venta=? ORDER BY m.id_movimiento',[id]);
    }
    return resource==='pedidos'?normalizedOrder(result):result;
  }
  const from=`FROM ${table} ${alias} ${joins} WHERE ${clauses.join(' AND ')}`;
  const count=await one(db,`SELECT COUNT(*) AS total ${from}`,params);
  const items=await rows(db,`SELECT ${columns} ${from} ORDER BY ${alias}.${idColumn} DESC LIMIT ${pagination.limite} OFFSET ${(pagination.pagina-1)*pagination.limite}`,params);
  return {...pagination,total:Number(count.total),items:resource==='pedidos'?items.map(normalizedOrder):items};
}
async function readSummary(db, actor, query) {
  const range=period(query,true), params=[range.from,range.until];
  const own=actor.rol==='Trabajador';
  const salesParams=own?[...params,actor.id_usuario]:params;
  const salesWhere=`v.fecha>=? AND v.fecha<? AND v.estado='Pagada'${own?' AND v.id_usuario=?':''}`;
  const cashWhere=`fecha>=? AND fecha<?${own?' AND id_usuario=?':''}`;
  const sales=await one(db,`SELECT COUNT(*) AS ventas,COALESCE(SUM(v.total),0) AS total_ventas FROM VENTA v WHERE ${salesWhere}`,salesParams);
  // A returned payment is still a receipt on its original date. Refunds are
  // reported separately on their actual date; opening balances are not receipts.
  const cash=await one(db,`SELECT COALESCE(SUM(importe),0) AS cobros,COUNT(*) AS cantidad FROM PAGO WHERE ${cashWhere} AND metodo_pago<>'Saldo inicial'`,salesParams);
  const refunds=await one(db,`SELECT COALESCE(SUM(importe),0) AS devoluciones FROM DEVOLUCION WHERE ${cashWhere}`,salesParams);
  const orders=await one(db,"SELECT COUNT(*) AS pedidos_abiertos,COALESCE(SUM(estado='Listo' OR (fecha_entrega>=? AND fecha_entrega<?)),0) AS pedidos_para_entregar FROM PEDIDO WHERE estado NOT IN ('Despachado','Cancelado')",params);
  const serie=await rows(db,`SELECT DATE(v.fecha) AS fecha,COUNT(*) AS ventas,SUM(v.total) AS total FROM VENTA v WHERE ${salesWhere} GROUP BY DATE(v.fecha) ORDER BY fecha`,salesParams);
  const top=await rows(db,`SELECT d.id_producto,CASE WHEN d.id_producto IS NULL THEN 'Personalizados' ELSE MAX(d.nombre) END AS nombre,SUM(d.cantidad) AS cantidad,SUM(d.subtotal) AS total FROM DETALLE_VENTA d JOIN VENTA v ON v.id_venta=d.id_venta WHERE ${salesWhere} GROUP BY d.id_producto ORDER BY cantidad DESC LIMIT 10`,salesParams);
  const result={desde:range.desde,hasta:range.hasta,ventas:Number(sales.ventas),total_ventas:String(sales.total_ventas),cobros:String(cash.cobros),cantidad_cobros:Number(cash.cantidad),devoluciones:String(refunds.devoluciones),pedidos_abiertos:Number(orders.pedidos_abiertos),pedidos_para_entregar:Number(orders.pedidos_para_entregar),serie,productos_mas_vendidos:top};
  if(!own) {
    const products=await one(db,'SELECT COUNT(*) AS productos_activos FROM PRODUCTO WHERE activo=1');
    const ingredients=await one(db,'SELECT COUNT(*) AS ingredientes_bajo_minimo FROM INGREDIENTE WHERE activo=1 AND existencia<=stock_minimo');
    result.productos_activos=Number(products.productos_activos);
    result.ingredientes_bajo_minimo=Number(ingredients.ingredientes_bajo_minimo);
  }
  return result;
}

function authorizeRead(actor, resource) {
  requireActor(actor);
  if (resource==='compras' && actor.rol!=='Administrador') fail(403,'No puedes consultar compras a proveedores.');
  if (resource==='resumen' && !staff(actor)) fail(403,'No puedes consultar el resumen de caja.');
  if (!['Administrador','Trabajador','Cliente'].includes(actor.rol)) fail(403,'Acceso no permitido.');
}
function authorizeWrite(actor, action) {
  requireActor(actor);
  if (['guardarCompra','recibirCompra','cancelarCompra'].includes(action)) {
    if (actor.rol!=='Administrador') fail(403,'Solo un administrador gestiona compras.');
  } else if (['aceptarCotizacion','rechazarCotizacion'].includes(action)) {
    if (actor.rol!=='Cliente') fail(403,'La cotización solo puede responderla su cliente.');
  } else if (!['prepararPedido','crearPedido','cancelarPedido','enviarReferencia'].includes(action) && !staff(actor)) fail(403,'Solo el personal puede realizar esta operación.');
  if (!['Administrador','Trabajador','Cliente'].includes(actor.rol)) fail(403,'Acceso no permitido.');
}

export function createCommerce(pool) {
  return {
    async createWithReferences(actor,data,key,files){
      authorizeWrite(actor,'crearPedido');
      const fingerprint={...data,archivos:files.map(file=>file.hash_original)};
      return transaction(pool,db=>once(db,actor,'crearPedidoReferencias',key,fingerprint,()=>createOrder(db,actor,{...data,tipo:'Personalizado'},files)));
    },
    async replaceReferences(actor,orderId,expectedVersion,key,files){
      authorizeWrite(actor,'crearPedido');
      return transaction(pool,db=>once(db,actor,'reemplazarReferencias',key,{id:orderId,version:expectedVersion,archivos:files.map(file=>file.hash_original)},async()=>{
        const order=await getOrder(db,orderId);owner(order,actor);version(order,{version:expectedVersion});open(order);
        if(order.tipo!=='Personalizado'||order.cotizacion_estado!=='Por cotizar')fail(409,'Las referencias se pueden corregir antes de cotizar el personalizado.');
        await rows(db,'UPDATE REFERENCIA_PEDIDO SET activo=0 WHERE id_pedido=?',[orderId]);await persistReferences(db,orderId,actor,files);
        await rows(db,'UPDATE PEDIDO SET version=version+1 WHERE id_pedido=?',[orderId]);order.version++;
        await history(db,orderId,actor,'Referencias actualizadas',{cantidad:files.length});
        return {...resultOrder(order),referencias:await referenceList(db,orderId)};
      }));
    },
    async referenceFilesInUse(files){
      if(!files.length)return [];
      return rows(pool,'SELECT archivo FROM REFERENCIA_PEDIDO WHERE archivo IN ('+files.map(()=>'?').join(',')+') FOR SHARE',files.map(file=>file.archivo));
    },
    async referenceById(actor,orderId,referenceId){
      requireActor(actor);
      const found=await one(pool,'SELECT r.*,p.id_cliente FROM REFERENCIA_PEDIDO r JOIN PEDIDO p ON p.id_pedido=r.id_pedido WHERE r.id_referencia=? AND r.id_pedido=?',[integer(referenceId),integer(orderId)]);
      if(!found)fail(404,'No se encontró la referencia.');owner(found,actor);return found;
    },
    async read(actor, resource, query={}) {
      if (!resources.has(resource)) return undefined;
      authorizeRead(actor,resource);
      if (resource==='resumen') return readSummary(pool,actor,query);
      return readRecords(pool,actor,resource,query);
    },
    async write(actor, action, data={}, key) {
      if (!actions.has(action)) return undefined;
      authorizeWrite(actor,action);
      if (!data || typeof data!=='object' || Array.isArray(data)) fail(400,'Datos inválidos.');
      if(action==='prepararVenta')return transaction(pool,db=>prepareSale(db,data));
      if(action==='prepararPedido')return transaction(pool,db=>prepareOrder(db,actor,data));
      return transaction(pool,db=>once(db,actor,action,key,data,()=> {
        switch(action) {
          case 'guardarCompra': return savePurchase(db,actor,data);
          case 'recibirCompra': case 'cancelarCompra': return changePurchase(db,actor,action,data);
          case 'vender': return sell(db,actor,data);
          case 'crearPedido': return createOrder(db,actor,data);
          case 'enviarReferencia': return sendReference(db,actor,data);
          case 'revisarTransferencia': return validateReference(db,actor,data);
          case 'cotizarPedido': return quoteOrder(db,actor,data);
          case 'aceptarCotizacion': case 'rechazarCotizacion': return respondQuote(db,actor,action,data);
          case 'actualizarPedido': return updateOrder(db,actor,data);
          case 'cobrarPedido': return chargeOrder(db,actor,data);
          case 'entregarPedido': return deliverOrder(db,actor,data);
          case 'cancelarPedido': return cancelOrder(db,actor,data);
        }
      }));
    }
  };
}
