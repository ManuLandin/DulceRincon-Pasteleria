import test from 'node:test';
import assert from 'node:assert/strict';
import {depositCents,pickupDate,normalizeReference,assertAccepted,issueCheckoutQuote,verifyCheckoutQuote} from '../server/order-policy.js';
test('order transfer is total or exactly rounded thirty percent, never floating money',()=>{
 assert.equal(depositCents(90000,'Efectivo'),27000);assert.equal(depositCents(90000,'Transferencia'),90000);
 assert.equal(depositCents(105,'Efectivo'),32);assert.equal(depositCents(1,'Efectivo'),1);
 assert.throws(()=>depositCents(90000,'Tarjeta'));assert.throws(()=>depositCents(0,'Efectivo'));
});
test('checkout preserves the price shown during an external transfer and binds customer and quantities',()=>{
 const lines=[{id_producto:1,cantidad:2,precio_centavos:45000}],context={modalidad_pago:'Transferencia',config_version:2},token=issueCheckoutQuote(5,lines,context);
 assert.equal(verifyCheckoutQuote(token,5,lines,context).total,90000);
 assert.throws(()=>verifyCheckoutQuote(token,5,lines,{...context,config_version:1}));assert.throws(()=>verifyCheckoutQuote(token,5,lines,{...context,modalidad_pago:'Efectivo'}));assert.throws(()=>verifyCheckoutQuote(token,6,lines,context));assert.throws(()=>verifyCheckoutQuote(token,5,[{id_producto:1,cantidad:3}]));
 assert.throws(()=>verifyCheckoutQuote(token.slice(0,-1)+'x',5,lines));
});
test('pickup range includes ten and twenty but rejects out of hours and past dates',()=>{
 const options={now:new Date('2026-11-07T22:00:00Z')};
 assert.equal(pickupDate('2026-11-08T10:00',options),'2026-11-08 10:00:00');
 assert.equal(pickupDate('2026-11-08T20:00',options),'2026-11-08 20:00:00');
 for(const value of ['2026-11-08T09:59','2026-11-08T20:01','2026-11-08T20:00:01','2026-11-06T14:00','2026-02-30T12:00'])assert.throws(()=>pickupDate(value,options));
 assert.equal(pickupDate('2026-11-09T12:00',{now:new Date('2026-11-08T04:00:00Z')}),'2026-11-09 12:00:00');
});
test('new policies require bank acceptance, legacy orders preserve original conditions',()=>{
 assert.doesNotThrow(()=>assertAccepted({politica_pago:0}));
 assert.doesNotThrow(()=>assertAccepted({politica_pago:1,aceptacion_estado:'Aceptado'}));
 assert.throws(()=>assertAccepted({politica_pago:1,aceptacion_estado:'Pendiente de validación'}));
 assert.equal(normalizeReference(' abc 123 '),'ABC123');assert.throws(()=>normalizeReference(' '));
});
