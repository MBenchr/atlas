#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MAX_AGE_HOURS = Number(process.env.ATLAS_MAX_DATA_AGE_HOURS || 48);

const REQUIRED_APP_MARKERS = [
  'id: "overview"',
  'id: "alerts"',
  'id: "portfolio"',
  'id: "evidence"',
  'id: "domains"',
  'id: "projections"',
  'function renderOverview',
  'function renderPortfolioView',
  'function renderEvidenceAudit',
  'function renderDecisionKpiDashboard',
  'function renderActionPlanner',
  'function renderDomainMatrix',
  'function renderGraph',
  'function renderRadar',
  'function bindInvestigationActions',
  'data-kpi-event',
  'function trackDecisionKpiInteraction',
  'data-open-evidence-context',
  'data-open-graph-context',
  'data-open-radar-context',
  'function renderTrendsCorrelation',
  'function renderProjectionRegistry',
  'Action recommandée'
];

const REQUIRED_HTML_MARKERS = [
  'id="app"',
  'Mettre à jour',
  'NEXORA V3'
];

const REQUIRED_STYLE_MARKERS = [
  '.alert-toolbar',
  '.action-grid',
  '.domain-matrix',
  '.evidence-toolbar',
  '.decision-kpi-card'
];

async function readText(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function assertContains(content, markers, sourceName) {
  for (const marker of markers) {
    if (!content.includes(marker)) {
      throw new Error(`${sourceName} is missing marker: ${marker}`);
    }
  }
}

function parseGeneratedAt(datasetName, payload) {
  if (typeof payload.generatedAt === 'string') return payload.generatedAt;

  if (datasetName === 'atlas-history') {
    const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
    const latest = snapshots[snapshots.length - 1];
    if (latest && typeof latest.generatedAt === 'string') return latest.generatedAt;
  }

  return null;
}

function assertFresh(datasetName, isoDate) {
  if (!isoDate) {
    throw new Error(`${datasetName}: no generatedAt timestamp found`);
  }

  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${datasetName}: invalid generatedAt timestamp (${isoDate})`);
  }

  const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  if (ageHours > MAX_AGE_HOURS) {
    throw new Error(
      `${datasetName}: stale data (${ageHours.toFixed(1)}h old, threshold=${MAX_AGE_HOURS}h)`
    );
  }
}

function assertFreshnessContract(atlasData) {
  const contract = atlasData?.freshnessContract;
  if (!contract || typeof contract !== 'object') {
    throw new Error('atlas-data.freshnessContract must be present');
  }

  const status = String(contract.globalStatus || '');
  if (!['normal', 'degraded', 'stale'].includes(status)) {
    throw new Error(`atlas-data.freshnessContract.globalStatus invalid (${status})`);
  }

  if (!Array.isArray(contract.datasets) || contract.datasets.length === 0) {
    throw new Error('atlas-data.freshnessContract.datasets must be non-empty');
  }

  for (const row of contract.datasets) {
    if (!row.dataset || !row.file || !row.generatedAt) {
      throw new Error('atlas-data.freshnessContract.datasets contains an incomplete row');
    }
    if (!['normal', 'degraded', 'stale'].includes(String(row.status || ''))) {
      throw new Error(`atlas-data.freshnessContract.datasets status invalid (${row.status})`);
    }
  }

  if (!Array.isArray(contract.alerts)) {
    throw new Error('atlas-data.freshnessContract.alerts must be an array');
  }

  const staleRows = contract.datasets.filter((row) => row.status === 'stale');
  if (Number(contract.staleDatasetCount || 0) !== staleRows.length) {
    throw new Error('atlas-data.freshnessContract.staleDatasetCount mismatch');
  }
}

function assertAlertsTaxonomy(atlasData) {
  const taxonomy = atlasData?.alertsTaxonomy;
  if (!taxonomy || typeof taxonomy !== 'object') {
    throw new Error('atlas-data.alertsTaxonomy must be present');
  }
  if (!Array.isArray(taxonomy.alerts)) {
    throw new Error('atlas-data.alertsTaxonomy.alerts must be an array');
  }
  for (const alert of taxonomy.alerts) {
    if (!alert.id || !alert.type || !alert.domain || !alert.owner || !alert.severity) {
      throw new Error('atlas-data.alertsTaxonomy contains incomplete alerts');
    }
    if (!alert.action || /^no action\.?$/i.test(String(alert.action))) {
      throw new Error(`atlas-data.alertsTaxonomy contains mute action alert (${alert.id})`);
    }
    if (!alert.proofLink) {
      throw new Error(`atlas-data.alertsTaxonomy missing proofLink (${alert.id})`);
    }
  }
}

function assertTrendsCorrelation(atlasHistory) {
  const projection = atlasHistory?.trendsCorrelation;
  if (!projection || typeof projection !== 'object') {
    throw new Error('atlas-history.trendsCorrelation must be present');
  }

  const windows = projection.windows || {};
  for (const key of ['7d', '30d', '90d']) {
    const row = windows[key];
    if (!row) throw new Error(`atlas-history.trendsCorrelation.windows.${key} missing`);
    if (!row.fromGeneratedAt || !row.toGeneratedAt) {
      throw new Error(`atlas-history.trendsCorrelation.windows.${key} missing period bounds`);
    }
    if (!row.deltas || typeof row.deltas !== 'object') {
      throw new Error(`atlas-history.trendsCorrelation.windows.${key}.deltas missing`);
    }
  }

  if (!Array.isArray(projection.notableEvents)) {
    throw new Error('atlas-history.trendsCorrelation.notableEvents must be an array');
  }
  if (!projection.domainWindows || typeof projection.domainWindows !== 'object') {
    throw new Error('atlas-history.trendsCorrelation.domainWindows must be an object');
  }
}

function assertAuditIndex(auditIndex, atlasHistory) {
  if (!auditIndex || typeof auditIndex !== 'object') {
    throw new Error('atlas-audit-index payload must be present');
  }
  if (!Array.isArray(auditIndex.artifacts) || auditIndex.artifacts.length === 0) {
    throw new Error('atlas-audit-index.artifacts must be a non-empty array');
  }

  const datasetArtifact = auditIndex.artifacts.find((row) => row?.id === 'dataset:atlas-data');
  if (!datasetArtifact) {
    throw new Error('atlas-audit-index missing dataset:atlas-data artifact');
  }

  const snapshotArtifacts = auditIndex.artifacts.filter((row) => row?.type === 'snapshot');
  const snapshotCount = Number(atlasHistory?.snapshots?.length || 0);
  if (snapshotCount > 0 && snapshotArtifacts.length < snapshotCount) {
    throw new Error(
      `atlas-audit-index snapshot coverage incomplete (${snapshotArtifacts.length}/${snapshotCount})`
    );
  }
}

function assertDecisionKpis(serviceOpsReport) {
  const decisionKpis = serviceOpsReport?.decisionKpis;
  if (!decisionKpis || typeof decisionKpis !== 'object') {
    throw new Error('architecture-service-ops-live-report.decisionKpis must be present');
  }

  const targets = decisionKpis.targets || {};
  if (!Number.isFinite(Number(targets.timeToFirstPrioritySec))) {
    throw new Error('decisionKpis.targets.timeToFirstPrioritySec invalid');
  }
  if (!Number.isFinite(Number(targets.timeToRationaleSec))) {
    throw new Error('decisionKpis.targets.timeToRationaleSec invalid');
  }
  if (!Number.isFinite(Number(targets.clicksToOwnerAction))) {
    throw new Error('decisionKpis.targets.clicksToOwnerAction invalid');
  }
  if (!Number.isFinite(Number(targets.drilldownRateMin))) {
    throw new Error('decisionKpis.targets.drilldownRateMin invalid');
  }

  for (const section of ['baselineBeforeRefactor', 'postRefactorBaseline']) {
    const row = decisionKpis[section] || {};
    if (!Number.isFinite(Number(row.timeToFirstPrioritySec))) {
      throw new Error(`decisionKpis.${section}.timeToFirstPrioritySec invalid`);
    }
    if (!Number.isFinite(Number(row.timeToRationaleSec))) {
      throw new Error(`decisionKpis.${section}.timeToRationaleSec invalid`);
    }
    if (!Number.isFinite(Number(row.clicksToOwnerAction))) {
      throw new Error(`decisionKpis.${section}.clicksToOwnerAction invalid`);
    }
    if (!Number.isFinite(Number(row.drilldownRate))) {
      throw new Error(`decisionKpis.${section}.drilldownRate invalid`);
    }
  }
}

async function main() {
  const manifest = await readJson('data/contracts/manifest.json');

  for (const [datasetName, config] of Object.entries(manifest.datasets || {})) {
    const payload = await readJson(config.dataFile);
    const generatedAt = parseGeneratedAt(datasetName, payload);
    assertFresh(datasetName, generatedAt);
  }

  const atlasData = await readJson('data/atlas-data.json');
  if (!Array.isArray(atlasData.domainProfiles) || atlasData.domainProfiles.length === 0) {
    throw new Error('atlas-data.domainProfiles must be non-empty');
  }
  if (!Array.isArray(atlasData.projectionRegistry) || atlasData.projectionRegistry.length === 0) {
    throw new Error('atlas-data.projectionRegistry must be non-empty');
  }
  if (!Array.isArray(atlasData.roadmap) || atlasData.roadmap.length === 0) {
    throw new Error('atlas-data.roadmap must be non-empty');
  }
  assertFreshnessContract(atlasData);
  assertAlertsTaxonomy(atlasData);
  const atlasHistory = await readJson('data/atlas-history.json');
  assertTrendsCorrelation(atlasHistory);
  const auditIndex = await readJson('data/history/atlas-audit-index.json');
  assertAuditIndex(auditIndex, atlasHistory);
  const serviceOpsReport = await readJson('data/architecture-service-ops-live-report.json');
  assertDecisionKpis(serviceOpsReport);

  const [appJs, indexHtml, stylesCss] = await Promise.all([
    readText('app.js'),
    readText('index.html'),
    readText('styles.css')
  ]);

  assertContains(appJs, REQUIRED_APP_MARKERS, 'app.js');
  assertContains(indexHtml, REQUIRED_HTML_MARKERS, 'index.html');
  assertContains(stylesCss, REQUIRED_STYLE_MARKERS, 'styles.css');

  console.log(`Atlas smoke checks passed (freshness <= ${MAX_AGE_HOURS}h + UI critical markers).`);
}

main().catch((error) => {
  console.error('Atlas smoke failed:', error?.message || error);
  process.exit(1);
});
