import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAtlasFixture } from './_atlas-fixture.mjs';
import { applyFixture, extractAlertCardDomains, loadAtlasRuntime } from './_atlas-runtime-harness.mjs';

let runtime;
let fixture;

test.before(async () => {
  runtime = await loadAtlasRuntime();
  fixture = buildAtlasFixture();
});

test('alerts queue is sorted by decision priority and severity', () => {
  applyFixture(runtime, fixture);
  const { renderArchitectureAlerts, state } = runtime;

  const html = renderArchitectureAlerts(state.data);
  const domains = extractAlertCardDomains(html);

  assert.ok(domains.length >= 3, 'fixture must render at least three alert cards');
  assert.equal(domains[0], 'payments', 'first alert must be payments on highest priority score');
  assert.ok(html.includes('owner=team-payments'), 'owner metadata must be visible on alert card');
});

test('alerts state filter and proof drawer support alert->preuve flow', () => {
  applyFixture(runtime, fixture);
  const { renderArchitectureAlerts, state } = runtime;

  state.alertStateFilter = 'done';
  let html = renderArchitectureAlerts(state.data);
  assert.ok(html.includes('analytics · watch'), 'done filter should retain done analytics alert');
  assert.ok(!html.includes('payments · snapshot-stale'), 'done filter should hide open alerts');

  state.alertStateFilter = 'all';
  state.activeAlertProofId = 'alert:payments:stale';
  html = renderArchitectureAlerts(state.data);
  assert.ok(html.includes('Preuve · payments · snapshot-stale'), 'proof drawer must open for selected alert');
  assert.ok(html.includes('data-open-evidence-context="payments"'), 'proof drawer must expose evidence deep-link');
});
