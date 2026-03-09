import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAtlasFixture } from './_atlas-fixture.mjs';
import { applyFixture, loadAtlasRuntime } from './_atlas-runtime-harness.mjs';

let runtime;
let fixture;

test.before(async () => {
  runtime = await loadAtlasRuntime();
  fixture = buildAtlasFixture();
});

test('portfolio filter keeps quadrant-specific decision rows', () => {
  applyFixture(runtime, fixture);
  const { renderPortfolioView, state } = runtime;

  state.portfolioQuadrantFilter = 'agir-maintenant';
  let html = renderPortfolioView(state.data);
  assert.ok(html.includes('agir-maintenant'), 'agir-maintenant quadrant should be present');
  assert.ok(html.includes('<strong>payments</strong>'), 'payments should remain in high-risk/high-importance filter');

  state.portfolioQuadrantFilter = 'extraire';
  html = renderPortfolioView(state.data);
  assert.ok(html.includes('extraire'), 'extraire quadrant should be rendered');
  assert.ok(html.includes('<strong>analytics</strong>'), 'analytics should be visible in extraire quadrant for fixture');
});
