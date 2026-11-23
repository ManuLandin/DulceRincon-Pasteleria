import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { context, csrf, login, PASSWORD } from './helpers.js';
import { hashPassword } from '../server/passwords.js';

const image=()=>sharp({create:{width:40,height:40,channels:3,background:'#edc7d3'}}).png().toBuffer();
const product={nombre:'Pastel real',id_categoria:'11',precio:'580.50',descripcion:'Una descripción',unidad:'pieza',existencia:'0',stock_minimo:'0'};
function fields(req,data=product){for(const [key,value]of Object.entries(data))req.field(key,value);return req;}

test('registration rejects invalid customer names, email and passwords over 25 on the server',async t=>{
 const {agent,repository}=await context(t),token=await csrf(agent),count=repository.users.length;
 const valid={telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'Ana Pérez',correo:'ana@example.test',contrasena:PASSWORD,confirmacion:PASSWORD};
 for(const changed of [{nombre:'Ana123'},{nombre:'   '},{correo:'ana@example'},{correo:'.ana@example.com'},{telefono:''},{direccion:''},{contrasena:'x'.repeat(26),confirmacion:'x'.repeat(26)}]){
  await agent.post('/api/auth/registro').set('X-CSRF-Token',token).send({...valid,...changed}).expect(400);
 }
 assert.equal(repository.users.length,count);
});

test('previously created passwords longer than 25 still allow login',async t=>{
 const {agent,repository}=await context(t),password='Una contraseña anterior de más de veinticinco caracteres';
 repository.users[0].contrasena_hash=await hashPassword(password);
 const token=await csrf(agent);
 await agent.post('/api/auth/login').set('X-CSRF-Token',token).send({correo:'admin@example.test',contrasena:password}).expect(200);
});

test('anonymous users cannot read a private panel or write products before multipart processing',async t=>{
  const {app,uploadDir}=await context(t);
  const panel=await request(app).get('/admin.html').expect(302);
  assert.match(panel.headers.location,/login/);
  await request(app).post('/api/admin/productos').expect(401);
  assert.deepEqual(await readdir(uploadDir),[]);
});
test('registration needs CSRF and assigns Cliente despite supplied administrator fields',async t=>{
  const {agent,repository}=await context(t);
  const data={telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'Nueva cliente',correo:'nueva@example.test',contrasena:PASSWORD,confirmacion:PASSWORD,rol:'Administrador',id_rol:1};
  await agent.post('/api/auth/registro').send(data).expect(403);
  const token=await csrf(agent);
  const result=await agent.post('/api/auth/registro').set('X-CSRF-Token',token).send(data).expect(201);
  assert.equal(result.body.usuario.rol,'Cliente');
  assert.equal('contrasena_hash' in result.body.usuario,false);
  assert.match(repository.users.at(-1).contrasena_hash,/^\$argon2id\$/);
  assert.equal(repository.users.at(-1).telefono,data.telefono);
  assert.equal(repository.users.at(-1).direccion,data.direccion);
  await agent.get('/api/auth/me').expect(401);
});
test('login rotates the session and uses a generic message for wrong credentials',async t=>{
  const {agent}=await context(t);
  const initial=await csrf(agent);
  const wrong=await agent.post('/api/auth/login').set('X-CSRF-Token',initial).send({correo:'admin@example.test',contrasena:'incorrecta'}).expect(401);
  const unknown=await agent.post('/api/auth/login').set('X-CSRF-Token',initial).send({correo:'unknown@example.test',contrasena:PASSWORD}).expect(401);
  assert.equal(wrong.body.error,unknown.body.error);
  const result=await agent.post('/api/auth/login').set('X-CSRF-Token',initial).send({correo:'admin@example.test',contrasena:PASSWORD}).expect(200);
  assert.notEqual(result.body.csrfToken,initial);
  assert.equal(result.body.destino,'/admin.html');
  assert.match(result.headers['set-cookie'][0],/HttpOnly/);
  assert.match(result.headers['set-cookie'][0],/SameSite=Lax/);
});
test('both non-administrator roles cannot create or replace images',async t=>{
  for(const email of ['cliente@example.test','trabajador@example.test']){
    const {agent}=await context(t);const token=await login(agent,email);
    await agent.post('/api/admin/productos').set('X-CSRF-Token',token).expect(403);
    await agent.put('/api/admin/productos/1/imagen').set('X-CSRF-Token',token).expect(403);
  }
});
test('server rechecks active status and role rather than trusting the stored session',async t=>{
  const {agent,repository}=await context(t);const token=await login(agent,'admin@example.test');
  repository.users[0].rol='Cliente';
  await agent.post('/api/admin/productos').set('X-CSRF-Token',token).expect(403);
  repository.users[0].activo=0;
  await agent.get('/api/auth/me').expect(401);
});
test('logout invalidates the session and a private panel redirects to the correct role',async t=>{
  const {agent}=await context(t);const token=await login(agent,'cliente@example.test');
  const result=await agent.get('/admin.html').expect(302);assert.equal(result.headers.location,'/cliente.html');
  await agent.post('/api/auth/logout').set('X-CSRF-Token',token).expect(200);
  await agent.get('/api/auth/me').expect(401);
});
test('catalog returns aliases and an empty state, and rejects malformed query identifiers',async t=>{
  const {agent}=await context(t);
  const categories=await agent.get('/api/categorias').expect(200);
  assert.equal(categories.body.categorias.find(c=>c.id_categoria===47).nombre,'Repostería');
  const result=await agent.get('/api/productos?buscar=ninguno').expect(200);
  assert.deepEqual(result.body.productos,[]);assert.equal(result.body.paginacion.total,0);
  await agent.get('/api/productos?categoria=1%20OR%201=1').expect(400);
  await agent.get('/api/productos/999').expect(404);
});
test('create requires a photo, rejects fake image data and enforces 5 MiB',async t=>{
  const {agent,uploadDir}=await context(t);const token=await login(agent,'admin@example.test');
  await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).expect(400);
  await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).attach('imagen',Buffer.from('<script>bad</script>'),{filename:'fake.png',contentType:'image/png'}).expect(400);
  await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).attach('imagen',Buffer.alloc(5*1024*1024+1),{filename:'large.png',contentType:'image/png'}).expect(413);
  assert.deepEqual(await readdir(uploadDir),[]);
});
test('valid photo is normalized and its product appears in filtered public catalog and detail',async t=>{
  const {agent,uploadDir}=await context(t);const token=await login(agent,'admin@example.test');
  const result=await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).attach('imagen',await image(),{filename:'../../foto.png',contentType:'image/png'}).expect(201);
  const saved=result.body.producto;assert.match(saved.imagen,/^\/uploads\/productos\/[a-f0-9-]+\.webp$/);
  const metadata=await sharp(await readFile(join(uploadDir,basename(saved.imagen)))).metadata();assert.equal(metadata.format,'webp');
  const list=await agent.get('/api/productos?categoria=11&buscar=Pastel').expect(200);assert.equal(list.body.productos[0].id_producto,saved.id_producto);
  const detail=await agent.get('/api/productos/'+saved.id_producto).expect(200);assert.equal(detail.body.producto.precio,'580.50');
});
test('invalid category and database write failure do not leave new image files',async t=>{
  const {agent,repository,uploadDir}=await context(t);const token=await login(agent,'admin@example.test');
  await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token),{...product,id_categoria:'999'}).attach('imagen',await image(),'image.png').expect(400);
  repository.failWrites=true;
  await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).attach('imagen',await image(),'image.png').expect(503);
  assert.deepEqual(await readdir(uploadDir),[]);
});
test('failed replacement preserves the original photo and a successful replacement cleans it',async t=>{
  const {agent,repository,uploadDir}=await context(t);const token=await login(agent,'admin@example.test');
  const created=await fields(agent.post('/api/admin/productos').set('X-CSRF-Token',token)).attach('imagen',await image(),'first.png').expect(201);
  const original=created.body.producto.imagen;
  repository.failWrites=true;
  await agent.put('/api/admin/productos/1/imagen').set('X-CSRF-Token',token).attach('imagen',await image(),'second.png').expect(503);
  assert.equal(repository.products[0].imagen,original);assert.deepEqual(await readdir(uploadDir),[basename(original)]);
  repository.failWrites=false;
  const replaced=await agent.put('/api/admin/productos/1/imagen').set('X-CSRF-Token',token).attach('imagen',await image(),'second.png').expect(200);
  assert.notEqual(replaced.body.producto.imagen,original);assert.deepEqual(await readdir(uploadDir),[basename(replaced.body.producto.imagen)]);
});
test('secrets, server source and package files are not public',async t=>{
  const {app}=await context(t);
  for(const path of ['/.env','/server/config.js','/package.json','/README.md'])await request(app).get(path).expect(404);
});
