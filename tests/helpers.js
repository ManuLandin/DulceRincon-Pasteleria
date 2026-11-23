import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import session from 'express-session';
import request from 'supertest';
import { hashPassword } from '../server/passwords.js';
import { createApp } from '../server/app.js';

export const PASSWORD = 'Una clave de prueba 2026';
const encoded = hashPassword(PASSWORD);
export async function context(t,options={}) {
  const hash = await encoded;
  const users = [
    {id_usuario:101,nombre:'Admin real',correo:'admin@example.test',contrasena_hash:hash,rol:'Administrador',activo:1},
    {id_usuario:102,nombre:'Cliente real',correo:'cliente@example.test',contrasena_hash:hash,rol:'Cliente',activo:1},
    {id_usuario:103,nombre:'Trabajador real',correo:'trabajador@example.test',contrasena_hash:hash,rol:'Trabajador',activo:1}
  ];
  const categories = [{id_categoria:11,nombre:'Pasteles'},{id_categoria:23,nombre:'Cupcakes'},{id_categoria:39,nombre:'Galletas'},{id_categoria:47,nombre:'Postres'}];
  const products=[];
  const repository={
    users, products, failWrites:false,
    userById:async id=>users.find(u=>u.id_usuario===id)||null,
    userByEmail:async email=>users.find(u=>u.correo===email)||null,
    createCustomer:async data=>{if(users.some(u=>u.correo===data.correo)){const e=new Error('duplicate');e.code='ER_DUP_ENTRY';throw e;} const user={id_usuario:users.length+104,...data,rol:'Cliente',activo:1};users.push(user);return user.id_usuario;},
    categories:async()=>categories,
    productsPage:async query=>{let data=products.filter(p=>p.activo);if(query.categoria)data=data.filter(p=>p.id_categoria===query.categoria);if(query.buscar)data=data.filter(p=>p.nombre.toLowerCase().includes(query.buscar.toLowerCase()));return {rows:data.slice((query.pagina-1)*query.limite,query.pagina*query.limite),total:data.length};},
    adminProducts:async()=>products,
    productById:async(id,{includeInactive=false}={})=>products.find(p=>p.id_producto===id&&(includeInactive||p.activo))||null,
    createProduct:async(data,image)=>{if(repository.failWrites)throw new Error('database offline');const category=categories.find(c=>c.id_categoria===data.id_categoria);if(!category)return null;const product={...data,id_producto:products.length+1,imagen:image,categoria:category.nombre,activo:1};products.push(product);return product.id_producto;},
    replaceImage:async(id,image)=>{if(repository.failWrites)throw new Error('database offline');const product=products.find(p=>p.id_producto===id);if(!product)return null;const anterior=product.imagen;product.imagen=image;return {anterior};},
    isImageReferenced:async image=>products.some(p=>p.imagen===image)
  };
  const uploadDir=await mkdtemp(join(tmpdir(),'dulce-rincon-test-'));
  t.after(async()=>{if(!resolve(uploadDir).startsWith(resolve(tmpdir(),'dulce-rincon-test-')))throw new Error('Unsafe cleanup path');await rm(uploadDir,{recursive:true,force:true});});
  const app=createApp({repository,uploadDir,sessionStore:new session.MemoryStore(),sessionSecret:'test-secret-'.repeat(8),rateLimits:false,logger:{error(){}},...options});
  return {app,repository,uploadDir,agent:request.agent(app)};
}
export async function csrf(agent) { return (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken; }
export async function login(agent,email) {
  const token=await csrf(agent);
  const result=await agent.post('/api/auth/login').set('X-CSRF-Token',token).send({correo:email,contrasena:PASSWORD}).expect(200);
  return result.body.csrfToken;
}
