import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto,randomUUID} from 'node:crypto';

async function browserContext(failureStatus){
 const storage=new Map(),effects=new Map();let attempt=0;
 const context={TextEncoder,crypto:{subtle:webcrypto.subtle,randomUUID},FormData,Intl,Node:class{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},document:{dispatchEvent(){}},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},console};
 context.window=context;
 context.fetch=async(path,options)=>{
  if(path==='/api/auth/me')return {ok:true,status:200,json:async()=>({usuario:{id_usuario:5,rol:'Administrador'}})};
  if(path==='/api/auth/csrf')return {ok:true,status:200,json:async()=>({csrfToken:'a'.repeat(64)})};
  const payload=JSON.parse(options.body);attempt++;
  if(attempt===2&&failureStatus)return {ok:false,status:failureStatus,json:async()=>({error:'Interrupción temporal'})};
  if(!effects.has(payload.clave))effects.set(payload.clave,{id:effects.size+71,folio:effects.size+71,total:payload.datos.total_autorizado});
  if(attempt===1)return {ok:true,status:200,json:async()=>{throw new Error('Body terminated');}};
  return {ok:true,status:200,json:async()=>({datos:effects.get(payload.clave)})};
 };
 vm.createContext(context);
 vm.runInContext(await readFile(new URL('../assets/js/api.js',import.meta.url),'utf8'),context);
 await context.DR.ready;
 vm.runInContext(await readFile(new URL('../assets/js/operation-core.js',import.meta.url),'utf8'),context);
 return {...context,effects};
}
for(const status of [undefined,401,403,429,503])test('incomplete successful response and transient '+status+' preserve one sale across retry',async()=>{
 const browser=await browserContext(status);const payload={detalles:[{id_producto:1,cantidad:1}],metodo_pago:'Tarjeta',total_autorizado:'450.00'};
 await assert.rejects(()=>browser.OP.write('vender',payload));
 if(status)await assert.rejects(()=>browser.OP.write('vender',payload));
 const result=await browser.OP.write('vender',payload);
 assert.equal(result.id,71);assert.equal(browser.effects.size,1);
});

test('a retry recovers its original authorized amount even when the current preview changes',async()=>{
 const browser=await browserContext();const payload={detalles:[{id_producto:1,cantidad:1}],metodo_pago:'Tarjeta',total_autorizado:'450.00'};
 await assert.rejects(()=>browser.OP.write('vender',payload));
 const recovered=await browser.OP.write('vender',{...payload,total_autorizado:'500.00'});
 assert.equal(recovered.total,'450.00');assert.equal(browser.effects.size,1);
 const next=await browser.OP.write('vender',{...payload,total_autorizado:'500.00'});
 assert.equal(next.total,'500.00');assert.equal(browser.effects.size,2);
});
