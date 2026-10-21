import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,extractSegments,operationalCarbon} from '../src/features/sustainability/carbon.js';
const base={status:'available',mode:'transit',distance:15000};
test('mixed bus/rail uses segment distance, not whole trip, and never car occupancy',()=>{
  const route={...base,segments:[{mode:'WALK',metres:1000},{mode:'TRANSIT',vehicle:'BUS',metres:4000},{mode:'TRANSIT',vehicle:'SUBWAY',metres:10000}]};
  const a=operationalCarbon(route,8,1,true), b=operationalCarbon(route,8,4,true);
  assert.equal(a.kg,4*dataset.factors.bus.value+10*dataset.factors.metro.value);
  assert.equal(a.kg,b.kg);
  assert.equal(a.breakdown.length,2);
});
test('unknown mode and missing segment distance block complete emissions total',()=>{
  for(const segment of [{mode:'TRANSIT',vehicle:'FERRY',metres:200},{mode:'TRANSIT',vehicle:'BUS',metres:null},{mode:'UNKNOWN',metres:10}])
    assert.equal(operationalCarbon({...base,segments:[segment]},8,1,true).kg,null);
  assert.equal(operationalCarbon(base,8,1,true).kg,null);
});
test('reference scenario requires opt-in and valid occupancy; savings can be negative',()=>{
  const car={status:'available',mode:'driving',distance:10000};
  assert.equal(operationalCarbon(car,8,2,false).kg,null);
  assert.equal(operationalCarbon(car,8,0,true).kg,null);
  assert.equal(operationalCarbon(car,8,2,true).kg,0.8*dataset.factors.petrol.value/2);
  assert.equal(operationalCarbon({status:'unavailable',mode:'walking'},8,1,true).kg,null);
});
test('missing transit distance stays null, not zero',()=>{
  const segments=extractSegments({legs:[{steps:[{travelMode:'TRANSIT',transitDetails:{transitLine:{vehicle:{type:'BUS'}}}}]}]});
  assert.equal(segments[0].metres,null);
  assert.equal(operationalCarbon({...base,segments},8,1,true).status,'unavailable');
});
