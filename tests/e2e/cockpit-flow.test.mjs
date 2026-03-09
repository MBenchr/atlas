import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

function assertMarkers(content, markers, label) {
  for (const marker of markers) {
    assert.ok(content.includes(marker), `${label} missing marker: ${marker}`);
  }
}

test('cockpit shell exposes expected primary navigation', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    [
      'id: "overview"',
      'id: "alerts"',
      'id: "portfolio"',
      'id: "evidence"',
      'id: "domains"',
      'id: "projections"',
      'id: "history"',
      'id: "roadmap"'
    ],
    'app.js NAV_ITEMS'
  );
});

test('cockpit rendering pipeline keeps decision-first views', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    [
      'function renderOverview',
      'function renderExecutiveBoard',
      'function renderPortfolioView',
      'function renderEvidenceAudit',
      'function renderDecisionKpiDashboard',
      'function renderActionPlanner',
      'function renderDomainMatrix',
      'function renderTrendsCorrelation',
      'function renderProjectionRegistry'
    ],
    'app.js render functions'
  );
});

test('decision KPI instrumentation stays wired in cockpit shell', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    [
      'function trackDecisionKpiInteraction',
      'function bindDecisionKpiEvents',
      'function initializeDecisionKpiTelemetry',
      'data-kpi-event',
      'data-kpi-reset'
    ],
    'app.js decision KPI instrumentation'
  );
});

test('graph and radar stay available only as secondary contextual investigation tools', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    [
      'function renderGraph',
      'function renderRadar',
      'function bindInvestigationActions',
      'data-open-evidence-context',
      'data-open-graph-context',
      'data-open-radar-context',
      'data-clear-investigation-context'
    ],
    'app.js contextual investigation wiring'
  );
});

test('drill-down and recommended action surfaces stay wired', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    [
      'function showDetailPanel',
      'data-detail-text',
      'Action recommandée'
    ],
    'app.js detail interactions'
  );
});

test('main html shell keeps app mount points', async () => {
  const html = await read('index.html');

  assertMarkers(
    html,
    ['id="app"', 'id="atlas-refresh-btn"', 'id="freshness-status"', "Atlas NEXORA V3"],
    'index.html'
  );
});

test('freshness status badge stays wired in cockpit bootstrap', async () => {
  const appJs = await read('app.js');

  assertMarkers(
    appJs,
    ['resolveFreshnessContract', 'updateFreshnessPill', 'freshness-status'],
    'app.js freshness wiring'
  );
});
