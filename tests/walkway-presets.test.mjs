import test from 'node:test';
import assert from 'node:assert/strict';
import { presetPlans } from '../src/features/sustainability/walkway-presets.js';
import { constructionEstimate } from '../src/features/sustainability/construction.js';
test('route geometry drives volume and same-scope concrete comparison', () => {
  const plans = presetPlans(100, 2, 0.1);
  const results = plans.map(rows => constructionEstimate({ length: 100, width: 2, rows }));
  assert.equal(plans[0][0].unit, 'm3');
  assert.equal(plans[0][0].quantity, 20);
  assert.equal(results[0].items[0].carbon, 6720);
  assert.equal(results[1].items[0].carbon, 3920);
  assert.equal(results[0].carbon, null);
  assert.equal(results[0].cost, null);
  assert.equal(presetPlans(200, 2, 0.1)[0][0].quantity, 40);
});
test('invalid dimensions stay unavailable and shelter does not get invented quantities', () => {
  for (const length of ['', 0, -1, Infinity]) assert.equal(presetPlans(length, 2, 0.1), null);
  const plan = presetPlans(100, 2, 0.1, true)[0];
  assert.equal(plan.length, 4);
  assert.equal(plan[2].quantity, '');
  assert.equal(plan[3].factor, '');
});
