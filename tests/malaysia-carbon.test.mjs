import test from 'node:test';
import assert from 'node:assert/strict';
import {electricCarbon,malaysiaGrid} from '../src/features/sustainability/carbon.js';
const route={status:'available',mode:'electric',distance:100000};
test('Malaysia electricity factor is multiplied by kWh, never by distance alone',()=>{
  const result=electricCarbon(route,20,2,'peninsular');
  assert.equal(result.kWh,20);
  assert.equal(result.kg,7.4);
  assert.equal(result.year,2024);
  assert.equal(malaysiaGrid.status,'Provisional');
});
test('charging region changes electricity scenario without changing route',()=>{
  assert.ok(Math.abs(electricCarbon(route,20,2,'sabah').kg-5.39)<1e-10);
  assert.ok(Math.abs(electricCarbon(route,20,2,'sarawak').kg-1.99)<1e-10);
});
test('missing energy, occupancy or region never produces a false zero',()=>{
  for(const args of [[route,0,1,'peninsular'],[route,20,0,'peninsular'],[route,20,1,'unknown'],[{status:'unavailable'},20,1,'peninsular']])
    assert.equal(electricCarbon(...args).kg,null);
});
