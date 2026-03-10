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

test('canonical metrics surfaces switch to explicit degraded state when datasets are missing', () => {
  applyFixture(runtime, fixture);
  const {
    state,
    buildCanonicalDataStatus,
    resolveFreshnessContract,
    resolveAuditIndex,
    resolveDecisionKpiContract,
    updateFreshnessPill,
    renderDecisionKpiDashboard,
    renderEvidenceAudit,
  } = runtime;

  state.data.freshnessContract = null;
  state.auditIndex = null;
  state.serviceOpsReport = null;
  state.decisionKpiContract = null;
  state.canonicalDataStatus = buildCanonicalDataStatus();
  state.freshnessContract = resolveFreshnessContract(state.data, state.history);

  assert.equal(resolveFreshnessContract(state.data, state.history), null);
  assert.equal(resolveAuditIndex(state.data, state.history), null);
  assert.equal(resolveDecisionKpiContract(), null);

  updateFreshnessPill(state.freshnessContract);
  const freshnessNode = runtime.document.getElementById('freshness-status');
  assert.ok(String(freshnessNode?.textContent || '').includes('indisponible'), 'freshness pill must expose non-canonical state');

  const kpiHtml = renderDecisionKpiDashboard();
  assert.ok(kpiHtml.includes('Projection indisponible'), 'KPI dashboard must expose missing canonical source');
  assert.ok(kpiHtml.includes('non canonique'), 'KPI dashboard must mark the state as non canonical');

  const evidenceHtml = renderEvidenceAudit(state.data);
  assert.ok(evidenceHtml.includes("Index d'audit canonique indisponible"), 'evidence audit must expose missing audit index');
  assert.ok(evidenceHtml.includes('contrat canonique manquant'), 'audit checks must expose missing freshness contract');
});
