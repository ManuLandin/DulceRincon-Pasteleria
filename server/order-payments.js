import {AppError} from './errors.js';
import {parseMoney,money} from './amounts.js';
import {depositCents,normalizeReference,verifyTransferAuthorization,planDelivery} from './order-policy.js';
import {readBankConfiguration} from './notifications.js';

const fail=(status,message)=>{throw new AppError(status,message);};
const id=value=>{const result=Number(value);if(!Number.isSafeInteger(result)||result<1)fail(400,'Identificador inválido.');return result;};
export async function bankPreview(db,total,mode,version){
 const expected=depositCents(total,mode),bank=await readBankConfiguration(db,version);
 if(!bank)fail(409,'La pastelería todavía no ha configurado sus datos bancarios. Solicita al administrador que los complete.');
 return {total:money(total),importe_transferir:money(expected),saldo_posterior:money(total-expected),configuracion_bancaria:{configurada:true,version:Number(bank.version),banco:bank.banco,titular:bank.titular,clabe:bank.clabe,instrucciones:bank.instrucciones}};
}
export async function lastTransfer(db,orderId){
 const [rows]=await db.execute('SELECT * FROM INTENTO_TRANSFERENCIA WHERE id_pedido=? ORDER BY id_intento DESC LIMIT 1 FOR UPDATE',[orderId]);return rows[0]||null;
}
export async function registerConfirmedTransfer(db,paymentId,reference){
 const normalized=normalizeReference(reference);
 try{await db.execute('INSERT INTO TRANSFERENCIA_VALIDADA(referencia_normalizada,id_pago) VALUES (?,?)',[normalized,paymentId]);}
 catch(error){if(error.code==='ER_DUP_ENTRY')fail(409,'Esta referencia ya se utilizó para un pago confirmado. Revisa el ingreso antes de continuar.');throw error;}
}
export async function submitTransfer(db,actor,order,data,history,{initial=false}={}){
 if(Number(order.politica_pago)!==1)fail(409,'Este pedido conserva sus condiciones anteriores. El personal puede registrar su pago con el flujo original.');
 if(['Cancelado','Despachado'].includes(order.estado))fail(409,'El pedido está cerrado.');
 if(order.tipo==='Personalizado'&&order.cotizacion_estado!=='Aceptado')fail(409,'Acepta primero la cotización del personalizado.');
 if(order.aceptacion_estado==='Aceptado'||parseMoney(order.anticipo)>0)fail(409,'La transferencia de este pedido ya fue aceptada.');
 const latest=await lastTransfer(db,order.id_pedido);
 if(latest&&latest.estado==='Pendiente')fail(409,'Tu referencia ya está pendiente de validación. Espera la revisión del personal.');
 const total=parseMoney(order.total);if(parseMoney(data.total_autorizado)!==total)fail(409,'El importe no corresponde al precio aceptado del pedido. Actualiza el detalle.');
 if(!initial)verifyTransferAuthorization(data.autorizacion_pago,actor.id_usuario,order,data);
 const normalized=normalizeReference(data.referencia),preview=await bankPreview(db,total,data.modalidad_pago,id(data.config_version));
 const [used]=await db.execute('SELECT id_pago FROM TRANSFERENCIA_VALIDADA WHERE referencia_normalizada=?',[normalized]);if(used.length)fail(409,'Esta referencia ya corresponde a un pago confirmado.');
 const [result]=await db.execute('INSERT INTO INTENTO_TRANSFERENCIA(id_pedido,referencia,referencia_normalizada,importe,modalidad_pago,config_version,destino_snapshot,cotizacion_version) VALUES (?,?,?,?,?,?,?,?)',[order.id_pedido,data.referencia.trim(),normalized,preview.importe_transferir,data.modalidad_pago,preview.configuracion_bancaria.version,JSON.stringify(preview.configuracion_bancaria),Number(order.cotizacion_version)||0]);
 await db.execute("UPDATE PEDIDO SET modalidad_pago=?,aceptacion_estado='Pendiente de validación',version=version+1 WHERE id_pedido=?",[data.modalidad_pago,order.id_pedido]);
 order.modalidad_pago=data.modalidad_pago;order.aceptacion_estado='Pendiente de validación';order.version=Number(order.version)+1;
 if(!initial)await history(db,order.id_pedido,actor,'Referencia enviada',{id_intento:result.insertId,modalidad_pago:data.modalidad_pago,importe:preview.importe_transferir,referencia:data.referencia.trim()});
 return result.insertId;
}
export async function reviewTransfer(db,actor,order,data,history){
 if(Number(order.politica_pago)!==1||['Cancelado','Despachado'].includes(order.estado))fail(409,'El pedido no admite esta revisión.');
 if(!['Aceptar','Corregir'].includes(data.decision))fail(400,'Selecciona aceptar o por corregir.');
 const current=await lastTransfer(db,order.id_pedido);
 if(!current||Number(current.id_intento)!==id(data.id_intento)||current.estado!=='Pendiente'||order.aceptacion_estado!=='Pendiente de validación')fail(409,'Esta referencia ya cambió o fue revisada. Actualiza el pedido.');
 if(data.decision==='Corregir'){
  if(typeof data.motivo!=='string'||!data.motivo.trim()||data.motivo.trim().length>255)fail(400,'Indica por qué la transferencia requiere corrección.');
  await db.execute("UPDATE INTENTO_TRANSFERENCIA SET estado='Por corregir',motivo=?,id_revisor=?,fecha_revision=CURRENT_TIMESTAMP WHERE id_intento=?",[data.motivo.trim(),actor.id_usuario,current.id_intento]);
  await db.execute("UPDATE PEDIDO SET aceptacion_estado='Por corregir',version=version+1 WHERE id_pedido=?",[order.id_pedido]);
  order.aceptacion_estado='Por corregir';order.version=Number(order.version)+1;
  await history(db,order.id_pedido,actor,'Transferencia por corregir',{id_intento:current.id_intento,motivo:data.motivo.trim()});return;
 }
 if(order.tipo==='Personalizado'&&(order.cotizacion_estado!=='Aceptado'||Number(current.cotizacion_version)!==Number(order.cotizacion_version)))fail(409,'La referencia no corresponde a la cotización aceptada.');
 const expected=depositCents(parseMoney(order.total),current.modalidad_pago);
 if(parseMoney(current.importe)!==expected||parseMoney(order.anticipo)!==0)fail(409,'El importe de la referencia no corresponde al pago requerido.');
 const planned=planDelivery(order,data,{accepting:true});
 let responsible=order.id_trabajador;
 if(!responsible)responsible=actor.rol==='Trabajador'?actor.id_usuario:id(data.id_trabajador);
 const [workers]=await db.execute("SELECT u.id_usuario FROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol WHERE u.id_usuario=? AND u.activo=TRUE AND r.nombre='Trabajador' FOR SHARE",[responsible]);
 if(!workers.length)fail(409,'Selecciona un trabajador activo para atender el pedido.');
 const [payment]=await db.execute("INSERT INTO PAGO(id_pedido,importe,metodo_pago,id_usuario,referencia) VALUES (?,?,'Transferencia',?,?)",[order.id_pedido,current.importe,actor.id_usuario,current.referencia]);
 await registerConfirmedTransfer(db,payment.insertId,current.referencia);
 await db.execute("UPDATE INTENTO_TRANSFERENCIA SET estado='Aceptado',id_pago=?,id_revisor=?,fecha_revision=CURRENT_TIMESTAMP WHERE id_intento=?",[payment.insertId,actor.id_usuario,current.id_intento]);
 await db.execute("UPDATE PEDIDO SET anticipo=?,aceptacion_estado='Aceptado',id_trabajador=?,aceptado_por=?,aceptado_fecha=CURRENT_TIMESTAMP,fecha_entrega=?,motivo_retraso=?,version=version+1 WHERE id_pedido=?",[current.importe,responsible,actor.id_usuario,planned.fecha_entrega,planned.motivo_retraso,order.id_pedido]);
 Object.assign(order,planned);order.anticipo=String(current.importe);order.id_trabajador=responsible;order.aceptacion_estado='Aceptado';order.version=Number(order.version)+1;
 await history(db,order.id_pedido,actor,'Transferencia aceptada',{id_intento:current.id_intento,id_pago:payment.insertId,importe:current.importe,id_trabajador:responsible,...planned});
}
