import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validateRegistration } from '../server/validation.js';

const registration = {telefono:'5512345678',direccion:'Calle de prueba 123',nombre:'María José Muñoz',correo:'cliente@example.test',contrasena:'Una clave segura 2026',confirmacion:'Una clave segura 2026'};
test('new customer names require letters and spaces, including Spanish accents', () => {
  assert.equal(validateRegistration({...registration,nombre:'  María José Muñoz  '}).nombre,'María José Muñoz');
  for (const nombre of ['', '   ', '123', 'Ana2', 'Ana <script>', 'Ana_Pérez', 'Ana-María', '😊']) {
    assert.throws(() => validateRegistration({...registration,nombre}), /nombre/i);
  }
});
test('registration accepts 25 password characters and rejects 26, empty fields and malformed emails', () => {
  assert.doesNotThrow(() => validateRegistration({...registration,contrasena:'x'.repeat(25),confirmacion:'x'.repeat(25)}));
  assert.throws(() => validateRegistration({...registration,contrasena:'x'.repeat(26),confirmacion:'x'.repeat(26)}), /25/);
  for (const correo of ['', 'cliente', 'a@b', 'a@@b.com', '.ana@example.com', 'a..b@example.com', 'a@-example.com']) {
    assert.throws(() => validateRegistration({...registration,correo}), /correo/i);
  }
});
async function cart(raw) {
  const memory = new Map(raw ? [['dr-carrito-v1', raw]] : []);
  const ctx = { localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},window:{} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(await readFile(new URL('../assets/js/cart-model.js',import.meta.url),'utf8'),ctx);
  return { model:ctx.DRCartModel, memory };
}
test('cart groups repeated products, persists IDs and quantities only and removes ordered quantities', async () => {
  const {model,memory} = await cart();
  model.add(1); model.add(2,3); model.add(1,2);
  assert.equal(model.count(),6);
  const snapshot = model.items();
  model.add(1); model.consume(snapshot);
  assert.equal(model.items().length,1); assert.equal(model.items()[0].cantidad,1);
  const stored = JSON.parse(memory.get('dr-carrito-v1'));
  assert.deepEqual(Object.keys(stored[0]).sort(),['cantidad','id_producto']);
  model.set(1,0); assert.equal(model.count(),0);
});
test('cart rejects invalid quantities and recovers from corrupt storage', async () => {
  const {model} = await cart('{broken');
  assert.equal(model.count(),0);
  for (const quantity of [-1,0,1.2,Infinity,1000000]) assert.throws(()=>model.add(1,quantity));
  model.add(1,2); assert.throws(()=>model.set(1,-2)); assert.equal(model.count(),2);
  const malformed = await cart('[{"id_producto":1,"cantidad":2},{"id_producto":1,"cantidad":3},{"id_producto":-1,"cantidad":4}]');
  assert.equal(malformed.model.count(),5);
});
