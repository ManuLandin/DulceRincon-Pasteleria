import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from '../server/validation.js';
import * as policy from '../server/order-policy.js';

const account = {nombre:'Ana Pérez',correo:'ana@example.test',contrasena:'Una clave de prueba 2026',confirmacion:'Una clave de prueba 2026',telefono:'5512345678',direccion:'Calle de prueba 123'};
test('registration requires and preserves telephone and address', () => {
 const result=validateRegistration(account);
 assert.equal(result.telefono,account.telefono); assert.equal(result.direccion,account.direccion);
 for(const change of [{telefono:''},{telefono:'   '},{telefono:'letras'},{direccion:''},{direccion:' '.repeat(5)}]) assert.throws(()=>validateRegistration({...account,...change}),/teléfono|dirección/i);
});
test('initial admin validation can explicitly omit customer contact fields', () => {
 const {telefono,direccion,...admin}=account;
 assert.doesNotThrow(()=>validateRegistration(admin,{requireContact:false}));
 assert.throws(()=>validateRegistration(admin),/teléfono/i);
});
test('delivery defaults to the requested time and rescheduling in either direction requires a reason', () => {
 const order={fecha_solicitada:'2099-12-15 12:00:00',fecha_entrega:null,motivo_retraso:null};
 assert.equal(policy.planDelivery(order,{}, {accepting:true}).fecha_entrega,order.fecha_solicitada);
 for(const fecha_entrega of ['2099-12-15T11:00','2099-12-15T13:00']) {
  assert.throws(()=>policy.planDelivery(order,{fecha_entrega},{accepting:true}),/motivo/i);
  assert.equal(policy.planDelivery(order,{fecha_entrega,motivo_retraso:'Horario acordado con cliente'},{accepting:true}).fecha_entrega,fecha_entrega.replace('T',' ')+':00');
 }
 assert.throws(()=>policy.planDelivery(order,{fecha_entrega:'2099-12-15T21:00',motivo_retraso:'Cambio'}),/recoger/);
});
test('status changes preserve the confirmed date, including overdue orders; acceptance needs a future date', () => {
 const old={fecha_entrega:'2020-01-01 12:00:00',fecha_solicitada:'2020-01-01 12:00:00'};
 assert.equal(policy.planDelivery(old,{}).fecha_entrega,old.fecha_entrega);
 assert.throws(()=>policy.planDelivery(old,{}, {accepting:true}),/posterior/);
 assert.equal(policy.planDelivery({...old,fecha_entrega:'2099-12-16 14:00:00'}, {}, {accepting:true}).fecha_entrega,'2099-12-16 14:00:00');
});
