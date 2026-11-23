import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSeedEnvironment,buildDataset} from '../scripts/seed/data.js';

test('seeder refuses production, implicit environments, remote hosts and unconfirmed or normal databases',()=>{
 const env={NODE_ENV:'development',SEED_CONFIRM_DB:'pasteleria_dev'};
 const config={production:false,database:{host:'127.0.0.1',database:'pasteleria_dev'}};
 assert.doesNotThrow(()=>assertSeedEnvironment(config,env));
 for(const changed of [{NODE_ENV:'production'},{NODE_ENV:undefined},{SEED_CONFIRM_DB:'other'}])assert.throws(()=>assertSeedEnvironment(config,{...env,...changed}));
 assert.throws(()=>assertSeedEnvironment({...config,production:true},env));
 assert.throws(()=>assertSeedEnvironment({...config,database:{...config.database,host:'remote.example.test'}},env));
 assert.throws(()=>assertSeedEnvironment({...config,database:{...config.database,database:'pasteleria_db'}},{...env,SEED_CONFIRM_DB:'pasteleria_db'}));
});
test('dataset has requested counts, valid states, exact totals and three calendar months of dates',()=>{
 const data=buildDataset('2026-11-12');
 assert.equal(data.users.length,9);assert.equal(data.products.length,25);assert.equal(data.ingredients.length,15);assert.equal(data.suppliers.length,5);
 assert.equal(data.orders.length,15);assert.equal(data.sales.length,20);
 assert.equal(data.orders.filter(o=>o.state==='Despachado').length,5);
 for(const sale of data.sales){assert.equal(sale.total,sale.lines.reduce((n,l)=>n+l.price*l.quantity,0));assert.ok(sale.date>='2026-08-12'&&sale.date<'2026-11-13');}
 assert.throws(()=>buildDataset('2026-02-30'));
});
