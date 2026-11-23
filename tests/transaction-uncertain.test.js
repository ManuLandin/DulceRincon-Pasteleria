import test from 'node:test';
import assert from 'node:assert/strict';
import {transaction} from '../server/transactions.js';
test('commit transport failure is distinguished from a rolled-back operation',async()=>{
 const connection={beginTransaction:async()=>{},commit:async()=>{throw new Error('Lost acknowledgement');},rollback:async()=>{},release(){}};
 await assert.rejects(()=>transaction({getConnection:async()=>connection},async()=>({id:1})),error=>error.commitUncertain===true);
 await assert.rejects(()=>transaction({getConnection:async()=>connection},async()=>{throw new Error('Before commit');}),error=>!error.commitUncertain);
});
