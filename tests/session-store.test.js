import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { MysqlSessionStore } from '../server/session-store.js';

test('session adapter persists data, reads valid sessions, touches and deletes by parameterized ID',async t=>{
  const records=new Map(),calls=[];
  const pool={execute:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.startsWith('INSERT'))records.set(params[0],{expires:params[1],data:params[2]});
    if(sql.startsWith('SELECT')){const record=records.get(params[0]);return [record&&record.expires>params[1]?[record]:[]];}
    if(sql.startsWith('UPDATE')){const record=records.get(params[1]);if(record&&record.expires>params[2])record.expires=params[0];}
    if(sql.startsWith('DELETE')&&sql.includes('session_id'))records.delete(params[0]);
    return [{affectedRows:1}];
  }};
  const store=new MysqlSessionStore(pool);t.after(()=>store.close());
  const set=promisify(store.set.bind(store)),get=promisify(store.get.bind(store)),touch=promisify(store.touch.bind(store)),destroy=promisify(store.destroy.bind(store));
  const id="sid' OR 1=1";
  const data={cookie:{expires:new Date(Date.now()+60000)},userId:101,csrfToken:'nonce'};
  await set(id,data);assert.equal((await get(id)).userId,101);
  await touch(id,{cookie:{expires:new Date(Date.now()+120000)}});
  assert.ok(records.get(id).expires>Math.floor(Date.now()/1000)+90);
  records.get(id).expires=0;assert.equal(await get(id),null);
  await destroy(id);assert.equal(await get(id),null);
  assert.equal(calls.some(call=>call.sql.includes(id)),false);
});
