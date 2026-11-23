import { AppError } from './errors.js';

function scaled(value, digits, max, label) {
 if (!['string','number'].includes(typeof value)) throw new AppError(400, `${label}: escribe una cantidad válida.`);
 const source=String(value);
 if (!(new RegExp('^\\d{1,12}(?:\\.\\d{1,'+digits+'})?$')).test(source)) throw new AppError(400, `${label}: usa hasta ${digits} decimales y un valor no negativo.`);
 const [whole,fraction='']=source.split('.');
 const result=BigInt(whole)*10n**BigInt(digits)+BigInt(fraction.padEnd(digits,'0'));
 if(result>BigInt(max)) throw new AppError(400, `${label}: supera el máximo permitido.`);
 return Number(result);
}
export const parseMoney=value=>scaled(value,2,9999999999,'Importe');
export const parseQuantity=value=>scaled(value,3,999999999999,'Cantidad');
function display(value,digits){
 if(!Number.isSafeInteger(value)) throw new AppError(400,'Cantidad fuera del rango permitido.');
 const sign=value<0?'-':''; const absolute=BigInt(Math.abs(value)); const scale=10n**BigInt(digits);
 return sign+(absolute/scale).toString()+'.'+(absolute%scale).toString().padStart(digits,'0');
}
export const money=value=>display(value,2);
export const quantity=value=>display(value,3);
export function lineTotal(mills,cents){
 if(!Number.isSafeInteger(mills)||!Number.isSafeInteger(cents)||mills<0||cents<0)throw new AppError(400,'Cantidad o precio inválidos.');
 const result=(BigInt(mills)*BigInt(cents)+500n)/1000n;
 if(result>9999999999n)throw new AppError(400,'El importe de la línea supera el máximo permitido.');
 return Number(result);
}
