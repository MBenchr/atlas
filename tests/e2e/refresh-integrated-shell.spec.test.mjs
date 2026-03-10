import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAtlasFixture } from './_atlas-fixture.mjs';
import { applyFixture, loadAtlasRuntime } from './_atlas-runtime-harness.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonResponse(payload, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    async json() {
      return clone(payload);
    },
  };
}

test('integrated shell refresh reloads governed datasets and updates topbar state', async () => {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  runtime.render();

  const refreshedAt = '2026-03-10T09:30:00.000Z';
  const refreshedData = clone(fixture.data);
  refreshedData.generatedAt = refreshedAt;
  refreshedData.freshnessContract = {
    generatedAt: refreshedAt,
    slaHours: { normal: 24, degraded: 48 },
    globalStatus: 'degraded',
    staleDatasetCount: 0,
    datasets: [
      {
        dataset: 'atlas-data',
        file: 'data/atlas-data.json',
        generatedAt: refreshedAt,
        ageHours: 26,
        status: 'degraded',
      },
      {
        dataset: 'atlas-history',
        file: 'data/atlas-history.json',
        generatedAt: refreshedAt,
        ageHours: 26,
        status: 'degraded',
      },
    ],
    alerts: [],
  };

  const refreshedHistory = clone(fixture.history);
  refreshedHistory.snapshots[1].generatedAt = refreshedAt;
  const previousSnapshotPath = `./data/${refreshedHistory.snapshots[0].file}`;
  const fetchByUrl = new Map([
    ['./api/refresh', jsonResponse({ ok: true })],
    ['./data/atlas-data.json', jsonResponse(refreshedData)],
    ['./data/architecture-score.json', jsonResponse(fixture.architectureScore)],
    ['./data/architecture-drift.json', jsonResponse(fixture.driftReport)],
    ['./data/architecture-time-machine.json', jsonResponse({ snapshots: [] })],
    ['./data/atlas-history.json', jsonResponse(refreshedHistory)],
    [previousSnapshotPath, jsonResponse(fixture.previousSnapshot)],
    ['./data/history/atlas-audit-index.json', jsonResponse(fixture.auditIndex)],
    ['./data/architecture-service-ops-live-report.json', jsonResponse(fixture.serviceOpsReport)],
  ]);

  runtime.__setFetchImplementation(async (url) => {
    const response = fetchByUrl.get(String(url));
    if (!response) throw new Error(`Unexpected fetch: ${url}`);
    return response;
  });

  await runtime.__dispatch('atlas-refresh-btn', 'click');

  assert.equal(runtime.state.refreshInFlight, false, 'refresh lock must be released after reload');
  assert.equal(runtime.state.data.generatedAt, refreshedAt, 'refresh must replace atlas dataset in state');
  assert.equal(runtime.state.freshnessContract.globalStatus, 'degraded', 'refresh must keep canonical freshness contract');
  assert.match(
    runtime.__document.getElementById('generated-at').textContent,
    /^Généré:/,
    'generated-at pill must be updated after refresh'
  );
  assert.equal(
    runtime.__document.getElementById('freshness-status').textContent,
    'Fraicheur: degradee',
    'freshness pill must reflect refreshed degraded contract'
  );
  assert.ok(
    runtime.__document.getElementById('atlas-refresh-btn').innerHTML.includes('Atlas à jour'),
    'refresh button must acknowledge successful refresh'
  );
  assert.match(
    runtime.__document.getElementById('scope-status').textContent,
    /^Scope: 2 repos · 3 domaines$/,
    'integrated shell topbar must still reflect rendered dataset scope'
  );
});

test('integrated shell refresh failure surfaces server requirement instead of hiding the absence', async () => {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  runtime.render();
  runtime.__setFetchImplementation(async (url) => {
    if (String(url) === './api/refresh') {
      return jsonResponse({ ok: false, message: 'refresh endpoint unavailable' }, false, 404);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  await runtime.__dispatch('atlas-refresh-btn', 'click');

  assert.equal(runtime.state.refreshInFlight, false, 'refresh lock must be released after failure');
  assert.ok(
    runtime.__document.getElementById('atlas-refresh-btn').innerHTML.includes('Échec mise à jour'),
    'button must expose refresh failure'
  );
  assert.equal(
    runtime.__document.getElementById('detail-overlay').getAttribute('aria-hidden'),
    'false',
    'failure must open the pedagogical detail panel'
  );
  assert.ok(
    runtime.__document.getElementById('detail-body').innerHTML.includes('endpoint /api/refresh'),
    'failure detail must explain the missing canonical refresh server'
  );
});

test('freshness missing contract stays explicitly non-canonical and preserves absence visibility', async () => {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  runtime.state.data = {
    ...clone(fixture.data),
    generatedAt: '2026-03-01T00:00:00.000Z',
  };
  delete runtime.state.data.freshnessContract;
  runtime.state.history = null;

  const contract = runtime.resolveFreshnessContract(runtime.state.data, runtime.state.history);
  runtime.updateFreshnessPill(contract);
  const checks = runtime.buildAuditCheckRows(runtime.state.data, []);
  const freshnessCheck = checks.find((row) => row.id === 'check:freshness');

  assert.equal(contract, null, 'missing canonical freshness contract must stay unresolved');
  assert.equal(freshnessCheck.value, 'indisponible', 'audit proof must not reconstruct a fake dataset contract');
  assert.equal(freshnessCheck.detail, 'contrat canonique manquant', 'audit proof must expose the missing canonical contract');
  assert.equal(
    runtime.__document.getElementById('freshness-status').textContent,
    'Fraicheur: indisponible (non canonique)',
    'freshness pill must expose the non-canonical absence explicitly'
  );
});

test('projection registry renders non-canonical degraded entries explicitly', async () => {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  const degradedData = clone(fixture.data);
  degradedData.projectionRegistry = [
    ...degradedData.projectionRegistry,
    {
      domain: 'billing',
      projection: 'billing_status_v1',
      consumers: ['atlas'],
      owner: '',
      canonical: false,
      status: 'missing',
    },
  ];

  const html = runtime.renderProjectionRegistry(degradedData);

  assert.ok(html.includes('billing_status_v1'), 'new degraded projection entry must be visible');
  assert.ok(html.includes('❌ manquante'), 'missing projection must render with explicit degraded status');
  assert.ok(html.includes('<span class="badge fail">non</span>'), 'non-canonical entry must not be upgraded visually');
  assert.ok(html.includes('<td>n/d</td>'), 'missing owner metadata must stay visible as missing');
});

test('alerts queue stays explicitly non-canonical when alerts taxonomy is missing', async () => {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  const degradedData = clone(fixture.data);
  delete degradedData.alertsTaxonomy;

  const html = runtime.renderArchitectureAlerts(degradedData);

  assert.ok(html.includes('non canonique'), 'alerts queue must expose non-canonical status');
  assert.ok(html.includes('alertsTaxonomy'), 'missing canonical projection must be named');
  assert.ok(
    html.includes("Atlas n'expose pas de queue opératoire reconstruite localement"),
    'local recomposition must be rejected explicitly'
  );
});
