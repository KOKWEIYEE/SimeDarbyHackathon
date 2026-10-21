import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCoordinates,searchPlace} from '../src/features/map/services/geocodingService.js';
import {resolveRouteAction} from '../src/features/ai/routeAction.js';

test('latitude-longitude input becomes longitude-latitude geometry',()=>{
  assert.deepEqual(parseCoordinates('3.0664, 101.6421').coords,[101.6421,3.0664]);
  assert.deepEqual(parseCoordinates('Custom Location (3.0664, 101.6421)').coords,[101.6421,3.0664]);
  assert.equal(parseCoordinates('KL Sentral'),null);
  assert.throws(()=>parseCoordinates('101.6421, 3.0664'),/Invalid coordinates/);
});
test('coordinate search never calls the geocoder',async()=>{
  const previous=global.fetch;
  global.fetch=()=>{throw new Error('Network should not be called');};
  try {assert.deepEqual((await searchPlace('3.0664, 101.6421')).coords,[101.6421,3.0664]);}
  finally {global.fetch=previous;}
});
test('chat route accepts coordinate endpoints without geocoding',async()=>{
  const previous=global.fetch;
  const urls=[];
  global.fetch=async url=>{
    urls.push(String(url));
    return {ok:true,json:async()=>({code:'Ok',routes:[{distance:1200,duration:900}]})};
  };
  try {
    const r=await resolveRouteAction({type:'route',origin:'3.0664, 101.6421',destination:'3.1, 101.7',mode:'walking'},{mapbox:'test'});
    assert.equal(r.route.status,'available');
    assert.equal(urls.length,1);
    assert.ok(urls[0].includes('101.6421,3.0664;101.7,3.1'));
  } finally {global.fetch=previous;}
});


test('Merdeka aliases resolve locally without geocoder access', async()=>{
 const previous=global.fetch;
 global.fetch=()=>{throw new Error('Unexpected network request');};
 try {
  for (const query of ['MRT Merdeka','Merdeka MRT station','Stesen MRT Merdeka','merdeka']) {
   const result=await searchPlace(query);
   assert.deepEqual(result.coords,[101.70205,3.141969]);
   assert.match(result.note,/not a verified entrance/);
  }
 } finally {global.fetch=previous;}
});
