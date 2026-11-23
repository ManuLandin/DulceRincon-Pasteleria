import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration, validateProduct, validatePassword } from '../server/validation.js';
import { hashPassword, verifyPassword } from '../server/passwords.js';
import { presentCategory } from '../server/categories.js';

test('registration normalizes name/email and never accepts a supplied role', () => {
  const result = validateRegistration({telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'  Ana Pérez ',correo:' ANA@EJEMPLO.COM ',contrasena:'una clave segura 2026',confirmacion:'una clave segura 2026',id_rol:1,rol:'Administrador'});
  assert.equal(result.nombre,'Ana Pérez');
  assert.equal(result.correo,'ana@ejemplo.com');
  assert.equal('rol' in result,false);
  assert.equal('id_rol' in result,false);
});
test('registration rejects malformed email, mismatched confirmation and long names', () => {
  const base={telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'Ana',correo:'ana@ejemplo.com',contrasena:'una clave segura 2026',confirmacion:'una clave segura 2026'};
  assert.throws(()=>validateRegistration({...base,correo:'x<script>@'}),/correo/i);
  assert.throws(()=>validateRegistration({...base,confirmacion:'otra clave segura'}),/coinciden/i);
  assert.throws(()=>validateRegistration({...base,nombre:'a'.repeat(101)}),/nombre/i);
});
test('passwords allow spaces and reject fewer than 12 or more than 128 characters',()=>{
  assert.doesNotThrow(()=>validatePassword('doce letras!'));
  assert.throws(()=>validatePassword('corta'),/12/);
  assert.throws(()=>validatePassword('x'.repeat(129)),/128/);
});
test('product validation preserves decimals and rejects negative or malformed amounts',()=>{
  const base={telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'Pastel de fresa',id_categoria:'5',precio:'580.50',existencia:'0',stock_minimo:'0',unidad:'pieza'};
  const result=validateProduct(base);
  assert.equal(result.precio,'580.50');
  assert.equal(result.id_categoria,5);
  assert.throws(()=>validateProduct({...base,precio:'-1'}),/precio/i);
  assert.throws(()=>validateProduct({...base,precio:'1.999'}),/precio/i);
  assert.throws(()=>validateProduct({...base,precio:'100000000'}),/precio/i);
  assert.throws(()=>validateProduct({...base,existencia:'1.5'}),/existencia/i);
  assert.throws(()=>validateProduct({...base,id_categoria:'1 OR 1=1'}),/categoría/i);
});
test('category aliases preserve actual IDs and source names',()=>{
  assert.deepEqual(presentCategory({id_categoria:19,nombre:'Postres'}),{id_categoria:19,nombre:'Repostería',nombre_original:'Postres',slug:'reposteria'});
  assert.equal(presentCategory({id_categoria:22,nombre:'Cupcakes'}).slug,'cup-cakes');
});
test('Argon2id hashes use independent salts and verify only the correct password',async()=>{
  const password='una contraseña segura 2026';
  const first=await hashPassword(password);
  const second=await hashPassword(password);
  assert.match(first,/^\$argon2id\$/);
  assert.notEqual(first,second);
  assert.equal(await verifyPassword(first,password),true);
  assert.equal(await verifyPassword(first,'una contraseña diferente'),false);
  assert.equal(await verifyPassword('not-a-hash',password),false);
});
