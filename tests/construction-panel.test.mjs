import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { constructionEstimate } from '../src/features/sustainability/construction.js';
import { presetPlans } from '../src/features/sustainability/walkway-presets.js';

test('rendered modes are separate and manual starts empty without automatic assumptions', async () => {
  const output = new URL(`./.construction-panel-${process.pid}.mjs`, import.meta.url);
  try {
    const bundle = await build({ entryPoints: ['src/features/sustainability/ConstructionPanel.jsx'], bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic' });
    await writeFile(output, bundle.outputFiles[0].contents);
    const { default: Panel } = await import(output.href);
    const markup = renderToStaticMarkup(createElement(Panel, { origin: { name: 'Origin', coords: [101.7, 3.1] }, destination: null }));
    assert.ok(markup.includes('Automatic estimate'));
    assert.ok(markup.includes('Manual comparison'));
    const manual = markup.slice(markup.indexOf('<h3>Manual construction comparison</h3>'));
    assert.ok(manual.includes('No carbon estimate yet'));
    assert.ok(manual.includes('No price estimate yet'));
    assert.ok(manual.includes('value=""'));
    assert.ok(!manual.includes('41.7%'));
    assert.ok(!manual.includes('RC32/40'));
    assert.ok(!markup.includes('RM 0.00'));
    assert.ok(!markup.includes('quantity ? factor'));
  } finally { await unlink(output).catch(() => {}); }
});

test('automatic quote computes only priced items and never populates independent manual quantities', () => {
  const manual = [{ quantity: '', factor: '', rate: '' }];
  const plans = presetPlans(208.1, 2, 0.1);
  plans[0][0].rate = '300';
  const result = constructionEstimate({ rows: plans[0] });
  assert.ok(Math.abs(result.items[0].carbon - 13984.32) < 0.00001);
  assert.ok(Math.abs(result.costSubtotal - 12486) < 0.00001);
  assert.equal(result.cost, null);
  assert.equal(result.missingCost, 1);
  assert.equal(constructionEstimate({ rows: manual }).carbon, null);
  assert.equal(constructionEstimate({ rows: manual }).cost, null);
  plans[0][0].rate = '0';
  assert.equal(constructionEstimate({ rows: plans[0] }).items[0].cost, 0);
});
