import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { buildAtlasFixture } from './_atlas-fixture.mjs';
import { applyFixture, loadAtlasRuntime } from './_atlas-runtime-harness.mjs';

let runtime;
let fixture;

test.before(async () => {
  runtime = await loadAtlasRuntime();
  fixture = buildAtlasFixture();
});

test('home cockpit renders decision-first blocks with KPI dashboard', () => {
  applyFixture(runtime, fixture);
  const { renderExecutiveBoard, renderTopActionsNow, renderDecisionKpiDashboard, renderOverview, state } = runtime;

  const html =
    renderExecutiveBoard(state.data) +
    renderTopActionsNow(state.data) +
    renderDecisionKpiDashboard() +
    renderOverview(state.data);

  assert.ok(html.includes('Top 5 actions maintenant'), 'top actions block must be present');
  assert.ok(html.includes('KPI décision (30s/60s/2 clics)'), 'decision KPI dashboard must be present');
  assert.ok(html.includes('#1 payments'), 'payments should be top-ranked first action in fixture');
  assert.ok(html.includes('Scorecards domaines (priorité décisionnelle)'), 'overview should include domain scorecards');
});

test('critical cockpit render functions stay within perceived TTI budget', () => {
  applyFixture(runtime, fixture);
  const { renderOverview, renderArchitectureAlerts, renderDomainMaster, renderPortfolioView, renderEvidenceAudit, state } = runtime;

  const cases = [
    { label: 'overview', fn: () => renderOverview(state.data), budgetMs: 35 },
    { label: 'alerts', fn: () => renderArchitectureAlerts(state.data), budgetMs: 35 },
    { label: 'domains', fn: () => renderDomainMaster(state.data), budgetMs: 35 },
    { label: 'portfolio', fn: () => renderPortfolioView(state.data), budgetMs: 45 },
    { label: 'evidence', fn: () => renderEvidenceAudit(state.data), budgetMs: 45 },
  ];

  for (const scenario of cases) {
    const samples = [];
    for (let i = 0; i < 30; i += 1) {
      const start = performance.now();
      const html = scenario.fn();
      const elapsed = performance.now() - start;
      samples.push(elapsed);
      assert.ok(typeof html === 'string' && html.length > 0, `${scenario.label} render must return html`);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1] ?? samples[samples.length - 1];
    assert.ok(
      p95 <= scenario.budgetMs,
      `${scenario.label} p95 render time ${p95.toFixed(2)}ms exceeded budget ${scenario.budgetMs}ms`
    );
  }
});

test('rollout flags filter visible views and expose rollback summary', () => {
  applyFixture(runtime, fixture);
  const { buildVisibleViews, renderMigrationBanner, state } = runtime;

  state.rolloutFlags = {
    cockpitV3Enabled: true,
    legacyTabBridgeEnabled: true,
    evidenceSpaceEnabled: false,
    secondaryInvestigationEnabled: true,
    decisionKpiEnabled: false,
  };

  const visibleIds = buildVisibleViews(state.rolloutFlags).map((view) => view.id);
  assert.ok(!visibleIds.includes('evidence'), 'evidence view must be hidden when evidence flag is disabled');

  const banner = renderMigrationBanner();
  assert.ok(banner.includes('Rollback actif: evidence, decision_kpi'), 'banner must expose disabled rollout flags');
});

test('rollout fallback prevents disabled evidence and investigation navigations', () => {
  applyFixture(runtime, fixture);
  const { setEvidenceContext, setInvestigationContext, state } = runtime;

  state.activeView = 'alerts';
  state.rolloutFlags = {
    cockpitV3Enabled: true,
    legacyTabBridgeEnabled: true,
    evidenceSpaceEnabled: false,
    secondaryInvestigationEnabled: false,
    decisionKpiEnabled: true,
  };

  setEvidenceContext({ domain: 'payments', source: 'alerts' });
  assert.equal(state.activeView, 'alerts', 'evidence context must fallback to alerts when evidence is disabled');

  setInvestigationContext({ domain: 'payments', source: 'alerts', view: 'graph' });
  assert.equal(state.activeView, 'domains', 'investigation context must fallback to domains when investigation is disabled');
});

test('legacy bridge mode remaps active view to an allowed surface', () => {
  applyFixture(runtime, fixture);
  const { render, buildVisibleViews, state } = runtime;

  state.rolloutFlags = {
    cockpitV3Enabled: false,
    legacyTabBridgeEnabled: true,
    evidenceSpaceEnabled: true,
    secondaryInvestigationEnabled: true,
    decisionKpiEnabled: true,
  };
  state.activeView = 'portfolio';

  render();

  const visibleIds = buildVisibleViews(state.rolloutFlags).map((view) => view.id);
  assert.equal(visibleIds.join(','), 'overview,history,domains,roadmap');
  assert.equal(state.activeView, 'overview', 'active view must fallback to first legacy bridge view');
});
