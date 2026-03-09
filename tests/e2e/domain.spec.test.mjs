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

test('domain master renders owner + next-action and supports preuve drawer', () => {
  applyFixture(runtime, fixture);
  const { renderDomainMaster, state } = runtime;

  state.domainMasterFilter = 'payments';
  let html = renderDomainMaster(state.data);
  assert.ok(html.includes('owner=team-payments'), 'payments owner must be visible');
  assert.ok(html.includes('Espace preuves'), 'domain cards must expose evidence deep-link action');
  assert.ok(html.includes('Enquête graphe'), 'domain cards must expose graph contextual action');

  state.activeDomainProofDomain = 'payments';
  html = renderDomainMaster(state.data);
  assert.ok(html.includes('Preuves domaine · payments'), 'domain proof drawer must open for selected domain');
  assert.ok(html.includes('data-evidence-source="domain-proof-drawer"'), 'proof drawer must keep evidence source context');
});
