import { createHmac,randomBytes } from 'node:crypto';
import { AppError } from './errors.js';
const fingerprintSecret=process.env.SESSION_SECRET||randomBytes(32);

export async function transaction(pool,callback){
 const connection=await pool.getConnection();
 let committing=false;
 try{await connection.beginTransaction();const result=await callback(connection);committing=true;await connection.commit();return result;}
 catch(error){if(committing)error.commitUncertain=true;await connection.rollback().catch(()=>{});throw error;}
 finally{connection.release();}
}
function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 return JSON.stringify(value);
}
export async function once(connection,actor,accion,clave,datos,callback){
 if(typeof clave!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(clave))throw new AppError(400,'Falta una clave válida de la operación. Recarga el formulario.');
 const huella=createHmac('sha256',fingerprintSecret).update(canonical({accion,datos})).digest('hex');
 await connection.execute('INSERT INTO OPERACION (id_usuario,clave,accion,huella) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id_operacion=id_operacion',[actor.id_usuario,clave,accion,huella]);
 const [rows]=await connection.execute('SELECT huella,resultado FROM OPERACION WHERE id_usuario=? AND clave=? FOR UPDATE',[actor.id_usuario,clave]);
 const row=rows[0];
 if(!row||row.huella!==huella)throw new AppError(409,'Esta operación ya se usó con otros datos. Abre un formulario nuevo.');
 if(row.resultado!==null){return typeof row.resultado==='string'?JSON.parse(row.resultado):row.resultado;}
 const result=await callback(connection);
 if(result===undefined)throw new Error('Una operación confirmada debe devolver su resultado.');
 await connection.execute('UPDATE OPERACION SET resultado=? WHERE id_usuario=? AND clave=?',[JSON.stringify(result),actor.id_usuario,clave]);
 return result;
}
