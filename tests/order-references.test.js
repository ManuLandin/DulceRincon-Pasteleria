import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AppError } from '../server/errors.js';
import { mountReferenceRoutes, persistReferences, referenceList, reconcileReferenceFiles } from '../server/order-references.js';

const token='a'.repeat(64);
const image=()=>sharp({create:{width:80,height:40,channels:3,background:'#edc7d3'}}).png().toBuffer();
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'dulce-private-'));
 t.after(async()=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir(),'dulce-private-')));await rm(directory,{recursive:true,force:true});});
 const actors={owner:{id_usuario:2,rol:'Cliente',activo:1},other:{id_usuario:3,rol:'Cliente',activo:1},worker:{id_usuario:4,rol:'Trabajador',activo:1},invalid:{id_usuario:5,rol:'Otro',activo:1}};
 const state={result:null,files:[],fail:false,uncertain:false,reconcileFail:false,quoted:false,calls:0};
 const order=actor=>{if(actor.id_usuario===3)throw new AppError(404,'Pedido no encontrado.');return {id_pedido:11,tipo:'Personalizado',estado:'Pendiente',cotizacion_estado:state.quoted?'Pendiente de aceptación':'Por cotizar'};};
 const save=async(actor,data,key,files)=>{
  state.calls++;if(state.fail)throw new Error('database unavailable');
  if(state.result)return state.result;
  state.files=files;
  state.result={id_pedido:11,referencias:files.map((f,i)=>({...f,id_referencia:i+1,url:`/api/pedidos/11/referencias/${i+1}`,activo:1}))};
  if(state.uncertain)throw Object.assign(new Error('COMMIT acknowledgement lost'),{commitUncertain:true});
  return state.result;
 };
 const commerce={referenceFilesInUse:async()=>{if(state.reconcileFail)throw new Error('Offline');return state.files;},read:async actor=>order(actor),createWithReferences:save,replaceReferences:async(actor,id,version,key,files)=>{if(state.quoted&&!state.result)throw new AppError(409,'El pedido ya fue cotizado.');return save(actor,{id,version},key,files);},referenceById:async(actor,id,ref)=>{order(actor);return state.result?.referencias.find(r=>String(r.id_referencia)===String(ref))||null;}};
 const app=express();app.use((req,res,next)=>{req.session={csrfToken:token};next();});
 const guards={requireUser(req,res,next){req.user=actors[req.get('X-Actor')];if(!req.user)return next(new AppError(401,'Inicia sesión.'));next();}};
 mountReferenceRoutes(app,commerce,guards,directory,(req,res,next)=>next());
 app.use((req,res)=>res.sendStatus(404));
 app.use((error,req,res,next)=>res.status(error instanceof multer.MulterError?(error.code==='LIMIT_FILE_SIZE'?413:400):error.status||503).json({error:error.message}));
 const post=(data={tipo:'Personalizado',descripcion_personalizada:'Pastel con flores'},actor='owner',csrf=token)=>request(app).post('/api/pedidos-personalizados').set('X-Actor',actor).set('X-CSRF-Token',csrf).field('datos',JSON.stringify(data)).field('clave','1234567890abcdef');
 const put=(data={version:1},actor='owner')=>request(app).put('/api/pedidos/11/referencias').set('X-Actor',actor).set('X-CSRF-Token',token).field('datos',JSON.stringify(data)).field('clave','1234567890abcdef');
 return {app,directory,state,post,put,commerce};
}

test('authentication, CSRF and allowed roles reject before parsing multipart',async t=>{
 const {app,directory,state}=await fixture(t);
 for(const [actor,csrf,status]of [[undefined,token,401],['owner','bad',403],['invalid',token,403]]){
  let req=request(app).post('/api/pedidos-personalizados').set('Content-Type','multipart/form-data; boundary=broken').set('X-CSRF-Token',csrf);
  if(actor)req=req.set('X-Actor',actor);await req.send('unparseable').expect(status);
 }
 assert.equal(state.calls,0);assert.deepEqual(await readdir(directory),[]);
});
test('normalizes private photos and preserves the original hash without exposing filenames',async t=>{
 const {app,directory,state,post}=await fixture(t);const png=await image();
 const result=await post().attach('referencias',png,{filename:'../../secret.png',contentType:'image/png'}).expect(201);
 assert.equal(state.files[0].hash_original,createHash('sha256').update(png).digest('hex'));
 assert.match(state.files[0].archivo,/^[a-f0-9-]{36}\.webp$/);
 assert.equal((await sharp(await readFile(join(directory,state.files[0].archivo))).metadata()).format,'webp');
 assert.equal('archivo'in result.body.datos.referencias[0],false);
 assert.equal('hash_original'in result.body.datos.referencias[0],false);
 await request(app).get('/uploads/productos/'+state.files[0].archivo).expect(404);
});
test('rejects fake, mislabelled, oversized, excessive and overpixel photos',async t=>{
 const {directory,state,post}=await fixture(t);const png=await image();
 await post().attach('referencias',Buffer.from('not a photo'),'fake.png').expect(400);
 await post().attach('referencias',png,{filename:'fake.jpg',contentType:'image/jpeg'}).expect(400);
 await post().attach('referencias',Buffer.alloc(5*1024*1024+1),'large.png').expect(413);
 let req=post();for(let i=0;i<4;i++)req=req.attach('referencias',png,'x.png');await req.expect(400);
 const huge=await sharp({create:{width:4001,height:4000,channels:3,background:'#fff'}}).png().toBuffer();
 await post().attach('referencias',huge,'huge.png').expect(400);
 assert.equal(state.calls,0);assert.deepEqual(await readdir(directory),[]);
});
test('cleans every new photo after partial validation or a failed transaction',async t=>{
 const {directory,state,post}=await fixture(t);
 await post().attach('referencias',await image(),'first.png').attach('referencias',Buffer.from('broken'),'second.png').expect(400);
 assert.deepEqual(await readdir(directory),[]);
 state.fail=true;await post().attach('referencias',await image(),'first.png').expect(503);
 assert.deepEqual(await readdir(directory),[]);
});
test('a retry reuses the original metadata and removes only regenerated files',async t=>{
 const {directory,state,post}=await fixture(t);const png=await image();
 const first=await post().attach('referencias',png,'x.png').expect(201);
 const second=await post().attach('referencias',png,'x.png').expect(201);
 assert.deepEqual(second.body,first.body);assert.deepEqual(await readdir(directory),[state.files[0].archivo]);
});
test('private download checks ownership and serves WebP with no-store',async t=>{
 const {app,post,state}=await fixture(t);await post().attach('referencias',await image(),'x.png').expect(201);
 const path='/api/pedidos/11/referencias/1';
 await request(app).get(path).expect(401);await request(app).get(path).set('X-Actor','other').expect(404);
 for(const actor of ['owner','worker']){const result=await request(app).get(path).set('X-Actor',actor).expect(200);assert.match(result.headers['content-type'],/image\/webp/);assert.match(result.headers['cache-control'],/no-store/);}
 state.result.referencias[0].archivo='../outside.webp';await request(app).get(path).set('X-Actor','owner').expect(404);
});
test('replacement authorizes before upload and requires explicit intent to remove all photos',async t=>{
 const {put,state,directory}=await fixture(t);
 await put({version:1},'other').attach('referencias',Buffer.from('bad'),'x.png').expect(404);
 state.quoted=true;await put().attach('referencias',await image(),'x.png').expect(409);state.quoted=false;
 await put().expect(400);await put({version:1,vaciar_referencias:true}).expect(200);
 assert.deepEqual(await readdir(directory),[]);
});
test('accepts three references without publishing their internal filenames',async t=>{
 const {post,directory}=await fixture(t);const png=await image();
 let req=post();for(let i=0;i<3;i++)req=req.attach('referencias',png,'x.png');
 const result=await req.expect(201);assert.equal(result.body.datos.referencias.length,3);assert.equal((await readdir(directory)).length,3);
});
test('custom requests can omit photos but reject malformed data and overlong descriptions',async t=>{
 const {post}=await fixture(t);
 await post().expect(201);
 await post({descripcion_personalizada:'x'.repeat(1001)}).expect(400);
 await post([]).expect(400);
});
test('persists normalized metadata and lists only active references with private URLs',async()=>{
 const calls=[];
 const db={execute:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT'))return [[{id_referencia:7,archivo:'e03bfbf0-d106-4eb6-8ce8-0117c776414f.webp',activo:1,fecha:'2026-11-07'}]];return [{insertId:7}];}};
 const files=[{archivo:'e03bfbf0-d106-4eb6-8ce8-0117c776414f.webp',hash_original:'b'.repeat(64)}];
 await persistReferences(db,11,{id_usuario:2},files);
 assert.match(calls[0].sql,/INSERT INTO REFERENCIA_PEDIDO/);assert.deepEqual(calls[0].args,[11,files[0].archivo,files[0].hash_original,2]);
 const refs=await referenceList(db,11);assert.equal(refs[0].url,'/api/pedidos/11/referencias/7');assert.match(calls[1].sql,/activo\s*=\s*1/);assert.deepEqual(calls[1].args,[11]);
});

test('lost COMMIT acknowledgement preserves committed photos and reconciles a retry',async t=>{
 const {directory,state,post,app}=await fixture(t);state.uncertain=true;
 const png=await image();await post().attach('referencias',png,'x.png').expect(503);
 assert.ok((await readdir(directory)).includes(state.files[0].archivo));
 await request(app).get('/api/pedidos/11/referencias/1').set('X-Actor','owner').expect(200);
 state.uncertain=false;await post().attach('referencias',png,'x.png').expect(201);
 assert.deepEqual(await readdir(directory),[state.files[0].archivo]);
});

test('uncertain commits retain a durable reconciliation manifest while database is offline',async t=>{
 const {directory,state,post,commerce}=await fixture(t);state.uncertain=true;state.reconcileFail=true;
 await post().attach('referencias',await image(),'x.png').expect(503);
 assert.equal((await readdir(directory)).length,2);
 await reconcileReferenceFiles(commerce,directory);assert.equal((await readdir(directory)).length,2);
 state.reconcileFail=false;await reconcileReferenceFiles(commerce,directory);
 assert.deepEqual(await readdir(directory),[state.files[0].archivo]);
});
