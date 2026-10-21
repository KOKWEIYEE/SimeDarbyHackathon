import test from 'node:test';
import assert from 'node:assert/strict';
import {transitInstructions} from '../src/features/sustainability/model.js';
test('transit itinerary uses provider boarding, direction and alighting information',()=>{
 const result=transitInstructions({legs:[{steps:[{travelMode:'WALK',distanceMeters:80},{travelMode:'TRANSIT',transitDetails:{transitLine:{name:'LRT Kelana Jaya Line'},headsign:'Gombak',stopDetails:{departureStop:{name:'KL Sentral'},arrivalStop:{name:'KLCC'}},stopCount:5}}]}]});
 assert.equal(result[0],'Walk 80 m.');
 assert.match(result[1],/Gombak/);assert.match(result[1],/KL Sentral/);assert.match(result[1],/KLCC/);
 assert.deepEqual(transitInstructions({}),[]);
});
