import {AppError} from './errors.js';
import {createHmac,createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
const quoteSecret=process.env.SESSION_SECRET||randomBytes(32);

export function depositCents(total,mode){
 if(!Number.isSafeInteger(total)||total<=0||total>9999999999)throw new AppError(400,'El pedido requiere un total válido y positivo.');
 if(!['Efectivo','Transferencia'].includes(mode))throw new AppError(400,'Selecciona Efectivo al recoger o Transferencia total.');
 return mode==='Transferencia'?total:Math.min(total,Math.max(1,Number((BigInt(total)*30n+50n)/100n)));
}
export function pickupDate(value,{now=new Date()}={}){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value))throw new AppError(400,'Indica una fecha y hora de recogida válidas.');
 const normalized=value.replace('T',' ')+(value.length===16?':00':'');
 const [day,time]=normalized.split(' '),parsed=new Date(day+'T'+time+'Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day||+time.slice(0,2)>23||+time.slice(3,5)>59||+time.slice(6)>59)throw new AppError(400,'La fecha y hora de recogida no son válidas.');
 if(time<'10:00:00'||time>'20:00:00')throw new AppError(400,'Solo puedes recoger entre las 10:00 a. m. y las 8:00 p. m.');
 if(new Date(day+'T'+time+'-06:00').getTime()<=now.getTime())throw new AppError(400,'La fecha de recogida debe ser posterior al momento actual.');
 return normalized;
}
export function planDelivery(order, data = {}, { accepting = false } = {}) {
 const normalize = value => value ? String(value).replace('T',' ') + (String(value).length === 16 ? ':00' : '') : null;
 const baseline = normalize(order.fecha_entrega || order.fecha_solicitada);
 const explicit = Object.hasOwn(data,'fecha_entrega');
 let delivery = explicit ? data.fecha_entrega : baseline;
 if (accepting || explicit) delivery = pickupDate(delivery);
 else delivery = normalize(delivery);
 const changed = explicit && baseline && delivery !== baseline;
 const reason = data.motivo_retraso === undefined ? (order.motivo_retraso || '') : data.motivo_retraso;
 if (typeof reason !== 'string' || reason.length > 255 || (changed && !reason.trim())) throw new AppError(400,'Indica el motivo del cambio de fecha, tanto para adelantos como para retrasos (hasta 255 caracteres).');
 return { fecha_entrega:delivery, motivo_retraso:reason.trim() || null };
}
export function normalizeReference(value){
 if(typeof value!=='string'||!value.trim()||value.trim().length>100||value.includes('\0'))throw new AppError(400,'Escribe la referencia o clave de rastreo de la transferencia (hasta 100 caracteres).');
 return value.trim().replace(/\s+/g,'').toUpperCase();
}
export function assertAccepted(order){
 if(Number(order.politica_pago)===1&&order.aceptacion_estado!=='Aceptado')throw new AppError(409,'El personal debe verificar la transferencia y aceptar el pedido antes de prepararlo o entregarlo.');
}

export function issueCheckoutQuote(actorId,lines,context){
 const total=lines.reduce((sum,line)=>sum+line.cantidad*line.precio_centavos,0);
 if(!Number.isSafeInteger(total)||total<=0||total>9999999999)throw new AppError(400,'Total del pedido fuera de rango.');
 const value={actor:Number(actorId),nonce:randomUUID(),lines:lines.map(line=>[line.id_producto,line.cantidad,line.precio_centavos]),total,payment:paymentContext(context)};
 const body=Buffer.from(JSON.stringify(value)).toString('base64url');
 return body+'.'+createHmac('sha256',quoteSecret).update(body).digest('hex');
}
export function verifyCheckoutQuote(token,actorId,lines,context){
 const invalid=()=>{throw new AppError(409,'Actualiza la cotización del catálogo antes de enviar la referencia.');};
 if(typeof token!=='string'||token.length>14000)return invalid();
 const [body,signature,...extra]=token.split('.');
 if(extra.length||!signature||!/^[a-f0-9]{64}$/.test(signature))return invalid();
 const expected=createHmac('sha256',quoteSecret).update(body).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return invalid();
 let value;try{value=JSON.parse(Buffer.from(body,'base64url').toString());}catch{return invalid();}
 if(JSON.stringify(value.payment)!==JSON.stringify(paymentContext(context)))return invalid();
 if(value.actor!==Number(actorId)||!Array.isArray(value.lines)||value.lines.length!==lines.length)return invalid();
 let total=0;
 for(let i=0;i<lines.length;i++){
  const [id,amount,price]=value.lines[i];
  if(id!==lines[i].id_producto||amount!==lines[i].cantidad||!Number.isSafeInteger(price)||price<0||price>9999999999)return invalid();
  total+=amount*price;
 }
 if(!Number.isSafeInteger(total)||total<=0||total!==value.total||total>9999999999)return invalid();
 return {total,lines:value.lines,hash:createHash('sha256').update(token).digest('hex')};
}

function paymentContext(data){
 const version=Number(data?.config_version),mode=data?.modalidad_pago;
 if(!Number.isSafeInteger(version)||version<1||!['Efectivo','Transferencia'].includes(mode))throw new AppError(409,'Consulta de nuevo las instrucciones de pago.');
 return {config_version:version,modalidad_pago:mode};
}
function transferContext(actorId,order,data){
 return {actor:Number(actorId),order:Number(order.id_pedido),total:String(order.total),quote:Number(order.cotizacion_version)||0,...paymentContext(data)};
}
export function issueTransferAuthorization(actorId,order,data){
 const body=Buffer.from(JSON.stringify(transferContext(actorId,order,data))).toString('base64url');
 return body+'.'+createHmac('sha256',quoteSecret).update(body).digest('hex');
}
export function verifyTransferAuthorization(token,actorId,order,data){
 const expected=issueTransferAuthorization(actorId,order,data);
 if(typeof token!=='string'||token.length!==expected.length||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))throw new AppError(409,'Consulta de nuevo el importe y las instrucciones de pago del pedido.');
}
