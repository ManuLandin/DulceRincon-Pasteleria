import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney,parseQuantity,money,quantity,lineTotal} from '../server/amounts.js';

test('money and ingredient quantities retain exact scaled decimal values',()=>{
 assert.equal(parseMoney('450.35'),45035); assert.equal(money(45035),'450.35');
 assert.equal(parseQuantity('0.125'),125); assert.equal(quantity(125),'0.125');
 assert.equal(parseMoney('99999999.99'),9999999999);
 assert.equal(parseQuantity('999999999.999'),999999999999);
});
test('invalid or excessive decimal inputs fail rather than silently round',()=>{
 for(const bad of ['-1','1e2','1.001','NaN',null,{},'100000000.00']) assert.throws(()=>parseMoney(bad));
 for(const bad of ['-0.1','0.0001','1,5','1000000000']) assert.throws(()=>parseQuantity(bad));
});
test('line totals use exact multiplication and commercial rounding',()=>{
 assert.equal(lineTotal(125,101),13);
 assert.equal(lineTotal(5,100),1);
 assert.equal(lineTotal(1000,45035),45035);
 assert.throws(()=>lineTotal(999999999999,9999999999));
});
