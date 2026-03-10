import fs from 'node:fs/promises';
import path from 'node:path';

import { buildAtlasFixture } from '../e2e/_atlas-fixture.mjs';
import { applyFixture, buildVisualSignature, loadAtlasRuntime } from '../e2e/_atlas-runtime-harness.mjs';

const ROOT = process.cwd();
export const BASELINE_FILE = path.join(ROOT, 'tests/visual/baselines/view-signatures.json');

function buildViewHtml(runtime) {
  const { state } = runtime;
  return {
    shell: buildShellHtml(runtime),
    overview:
      runtime.renderExecutiveBoard(state.data) +
      runtime.renderTopActionsNow(state.data) +
      runtime.renderDecisionKpiDashboard() +
      runtime.renderOverview(state.data),
    alerts: runtime.renderArchitectureAlerts(state.data),
    domains: runtime.renderDomainMaster(state.data),
    portfolio: runtime.renderPortfolioView(state.data),
    evidence: runtime.renderEvidenceAudit(state.data),
    projections: runtime.renderProjectionRegistry(state.data),
  };
}

function buildShellHtml(runtime) {
  const { state } = runtime;
  const contract = runtime.resolveFreshnessContract(state.data, state.history);
  runtime.state.freshnessContract = contract;
  runtime.updateFreshnessPill(contract);
  runtime.render();

  const doc = runtime.__document;
  return [
    doc.getElementById('atlas-refresh-btn').innerHTML,
    doc.getElementById('freshness-status').textContent,
    doc.getElementById('active-alerts-status').textContent,
    doc.getElementById('scope-status').textContent,
    doc.getElementById('period-status').textContent,
    doc.getElementById('nav').innerHTML,
    doc.getElementById('view').innerHTML,
  ].join('\n');
}

export async function computeViewSignatures() {
  const runtime = await loadAtlasRuntime();
  const fixture = buildAtlasFixture();
  applyFixture(runtime, fixture);

  const htmlByView = buildViewHtml(runtime);
  return Object.fromEntries(Object.entries(htmlByView).map(([key, html]) => [key, buildVisualSignature(html)]));
}

export async function writeViewSignatures(signatures) {
  await fs.writeFile(BASELINE_FILE, `${JSON.stringify(signatures, null, 2)}\n`, 'utf8');
}

export async function readViewSignatures() {
  const raw = await fs.readFile(BASELINE_FILE, 'utf8');
  return JSON.parse(raw);
}
