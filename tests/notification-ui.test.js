import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
class Element {
 constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.events={};this.attrs={};this.value='';this.classList={toggle(){},add(){}};}
 get isConnected(){return this.root||Boolean(this.parent?.isConnected);}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}
 addEventListener(name,fn){this.events[name]=fn;}
 setCustomValidity(text){this.invalid=text;}
 showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function core(){
 const el=(...args)=>new Element(...args),ctx={DR:{element:el,ready:{then(){}},user:{id_usuario:1}},window:{},document:{},Intl,Date,Node:Element};ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(await readFile(new URL('../assets/js/operation-core.js',import.meta.url),'utf8'),ctx);return ctx;
}
test('unchanged past or legacy pickup time allows status changes, edited time must follow opening hours',async()=>{
 const {OP}=await core(),value='2026-01-01T09:00';
 const field=OP.field('fecha','Fecha','datetime-local',value,{required:true,allowUnchanged:true});
 const [day,hour,minute]=field.wrap.children[2].children;
 assert.equal(hour.tag,'select');assert.equal(minute.tag,'select');
 assert.equal(day.invalid,'');assert.equal(hour.invalid,'');
 hour.value='08';hour.events.change();assert.ok(hour.invalid);assert.ok(day.invalid);
 const fresh=OP.field('fecha','Fecha','datetime-local',value,{required:true});assert.ok(fresh.wrap.children[2].children[0].invalid);
});

test('pickup dropdowns combine the date and time and closing time only permits minute zero',async()=>{
 const {OP}=await core(),field=OP.field('fecha','Recogida','datetime-local','',{required:true});
 const [day,hour,minute]=field.wrap.children[2].children;
 assert.equal(hour.tag,'select');assert.equal(minute.children.length,60);
 day.value='2099-01-01';hour.value='19';minute.value='45';minute.events.change();
 assert.equal(field.input.value,'2099-01-01T19:45');assert.equal(hour.invalid,'');
 hour.value='20';hour.events.change();
 assert.equal(field.input.value,'2099-01-01T20:00');
 assert.ok(minute.children.slice(1).every(option=>option.disabled));
});
test('revisiting notices keeps only mounted view and stable polls preserve action controls',async()=>{
 const ctx=await core(),host=new Element('main');host.root=true;let reads=0;
 ctx.document={hidden:false,body:{dataset:{page:'trabajador'}},querySelectorAll:()=>[]};
 ctx.OP.read=async()=>{reads++;return {items:[{id_notificacion:1,id_pedido:1,titulo:'Pedido',texto:'Nuevo pedido',fecha:'2026-11-07 12:00:00',leida:0}],total:1,limite:20,no_leidas:1};};
 vm.runInContext(await readFile(new URL('../assets/js/notifications.js',import.meta.url),'utf8'),ctx);
 for(let i=0;i<8;i++){host.replaceChildren();ctx.OP.notifications.mount(host);await tick();}
 const pane=host.children[0],content=pane.children[3],row=content.children[0];reads=0;
 await ctx.OP.notifications.refresh();assert.equal(reads,1);assert.equal(content.children[0],row);
 host.replaceChildren();reads=0;await ctx.OP.notifications.refresh();assert.equal(reads,1);
});

test('in-page confirmation cancels without saving and accepts only after explicit confirmation',async()=>{
 const ctx=await core(),body=new Element('body');body.root=true;ctx.document={body};
 let pending=ctx.OP.confirmAction('Registrar ingreso de prueba');let modal=body.children[0];
 modal.children[1].children[1].events.click();assert.equal(await pending,false);
 pending=ctx.OP.confirmAction('Registrar ingreso de prueba');modal=body.children.at(-1);
 modal.children[1].children[2].events.click();assert.equal(await pending,true);
});

test('notice links open the matching order, sale or purchase record',async()=>{
 for(const [entity,expected] of [['Pedido','order'],['Venta','sale'],['Compra','purchase']]){
  const ctx=await core(),host=new Element('main');host.root=true;let opened;
  ctx.document={hidden:false,body:{dataset:{page:'admin'}},querySelectorAll:()=>[]};
  ctx.OP.read=async(resource,query)=>resource==='notificaciones'?{items:[{entidad:entity,id_origen:7,id_pedido:7,id_notificacion:1,titulo:'Aviso',texto:'Prueba',fecha:'2026-11-12 12:00:00',leida:1}],total:1,limite:20,no_leidas:0}:{id:query.id};
  ctx.OP.orderDetail=async id=>{opened=['order',id];};ctx.OP.purchaseDetail=async id=>{opened=['purchase',id];};ctx.OP.receipt=row=>{opened=['sale',row.id];};
  vm.runInContext(await readFile(new URL('../assets/js/notifications.js',import.meta.url),'utf8'),ctx);
  ctx.OP.notifications.mount(host);await tick();
  const row=host.children[0].children[3].children[0],link=row.children[3].children[0];
  await link.events.click({preventDefault(){}});assert.deepEqual(opened,[expected,7]);
 }
});
