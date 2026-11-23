import test from 'node:test';
import assert from 'node:assert/strict';
import {checkOperationSchema} from '../server/config.js';
test('startup refuses to advertise operating panels until their migration is complete',async()=>{
 await assert.rejects(()=>checkOperationSchema({execute:async()=>[[]]}),/db:operacion/);
});
