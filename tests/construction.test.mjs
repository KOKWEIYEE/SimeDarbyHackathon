import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionEstimate } from '../src/features/sustainability/construction.js';
test('blank and nonnumeric factors never become zero while explicit zero remains valid', () => {
  for (const factor of [' ', '\t', false, null, undefined]) {
    assert.equal(constructionEstimate({rows:[{quantity:10,factor,rate:factor}]}).carbon,null);
    assert.equal(constructionEstimate({rows:[{quantity:10,factor,rate:factor}]}).cost,null);
  }
  assert.equal(constructionEstimate({rows:[{quantity:10,factor:0,rate:0}]}).carbon,0);
  assert.equal(constructionEstimate({rows:[]}).cost,null);
});
test('material totals use mass independently of plan area', () => {
  const result = constructionEstimate({ length: 100, width: 2, rows: [{ quantity: 1000, factor: 0.2, rate: 3, source: 'Product EPD A1-A3' }] });
  assert.equal(result.area, 200);
  assert.equal(result.carbon, 200);
  assert.equal(result.cost, 3000);
});
test('missing data does not become zero or a partial total', () => {
  const result = constructionEstimate({ length: '', width: 2, rows: [{ quantity: 10, factor: 1, rate: 2, source: 'EPD' }, { quantity: 20, factor: '', rate: '', source: '' }] });
  assert.equal(result.area, null);
  assert.equal(result.carbon, null);
  assert.equal(result.cost, null);
});
test('manual unsourced assumptions calculate but retain missing provenance', () => {
  const result = constructionEstimate({ rows: [{ quantity: 10, factor: 2, rate: 3, source: '' }, { quantity: '', factor: '', rate: '' }] });
  assert.equal(result.items[0].carbon, 20);
  assert.equal(result.items[0].sourceProvided, false);
  assert.equal(result.carbonSubtotal, 20);
  assert.equal(result.costSubtotal, 30);
  assert.equal(result.missingCarbon, 1);
  assert.equal(result.cost, null);
  assert.equal(constructionEstimate({ rows: [{ quantity: -1, factor: 1 }] }).carbon, null);
});
