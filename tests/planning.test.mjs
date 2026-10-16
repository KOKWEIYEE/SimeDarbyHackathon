import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Load the Vite JSON import in Node without adding a second runtime dependency.
const catalog = readFileSync(new URL('../src/features/ai/catalog.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const source = readFileSync(new URL('../src/features/ai/index.js', import.meta.url), 'utf8').replace(/import catalog from ['"]\.\/catalog\.json['"];?/, `const catalog = ${catalog};`);
const { buildDemo, requestAnalysis } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const input = { site_id:'klcc', strategy_id:'walkway', length:500, width:2, budget:150000, carbon_target:30 };
test('500m walkway produces auditable cost and carbon, with no invented flood metric', () => {
 const result = buildDemo(input);
 assert.equal(result.kpi_metrics.estimated_cost, 145000);
 assert.equal(result.kpi_metrics.carbon_reduction, 32);
 assert.equal(result.kpi_metrics.carbon_saved, 16000);
 assert.equal(result.kpi_metrics.flood_resilience_boost, null);
});
test('budget and carbon constraints are not automatically marked satisfied', () => {
 const result = buildDemo({...input, budget:100000, carbon_target:50});
 assert.match(result.response_text, /exceeds/);
 assert.match(result.response_text, /not met/);
});
test('different sites and retrofit scenario update geometry and results', () => {
 const result = buildDemo({...input, site_id:'sentral', strategy_id:'retrofit'});
 assert.match(result.action_zone.zone_name, /KL Sentral/);
 assert.equal(result.kpi_metrics.estimated_cost, 650000);
 assert.equal(result.kpi_metrics.carbon_reduction, 40);
});
test('AI failures remain visible instead of silently generating demo data', async () => {
 const original = globalThis.fetch;
 try {
  globalThis.fetch = async () => ({ok:false, json:async () => ({detail:'Outside supported sites'})});
  await assert.rejects(requestAnalysis(input), /Outside supported sites/);
 } finally { globalThis.fetch = original; }
});
