import test from 'node:test';
import assert from 'node:assert/strict';
import {petrolEmissions,getRoute,PETROL_KG_CO2_PER_LITRE} from '../src/features/sustainability/model.js';

test('100 km using 10 litres shared by two occupants allocates half the combustion emissions',()=>{
  assert.equal(petrolEmissions(100000,10,2),5*PETROL_KG_CO2_PER_LITRE);
  assert.equal(petrolEmissions(0,10,2),0);
});
test('invalid fuel or occupancy never becomes a zero-carbon result',()=>{
  for(const args of [[1000,0,1],[1000,8,0],[1000,8,1.5],[-1,8,1],[NaN,8,1]])
    assert.equal(petrolEmissions(...args),null);
});
test('no route remains unavailable without substituting straight-line distance',async()=>{
  const previous=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({code:'NoRoute',routes:[]})});
  try {
    const r=await getRoute('walking',[101.7,3.1],[101.71,3.12],{mapbox:'test'},new AbortController().signal);
    assert.equal(r.status,'unavailable');
    assert.equal(r.distance,undefined);
  } finally {global.fetch=previous;}
});
test('transit returns provider metrics and missing key remains unavailable',async()=>{
  const previous=global.fetch;
  global.fetch=async()=>({ok:true,json:async()=>({routes:[{distanceMeters:4321,duration:'1200s'}]})});
  try {
    const signal=new AbortController().signal;
    const r=await getRoute('transit',[101.7,3.1],[101.71,3.12],{google:'test'},signal);
    assert.equal(r.distance,4321);assert.equal(r.duration,1200);
    assert.equal((await getRoute('transit',[0,0],[1,1],{},signal)).status,'unavailable');
  } finally {global.fetch=previous;}
});
