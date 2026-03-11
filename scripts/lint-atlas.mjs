#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();

const REQUIRED_PATHS = [
  'AGENTS.md',
  'docs/atlas-decision-stack.md',
  'docs/atlas-execution-board.md',
  'docs/data-contracts.md',
  'docs/atlas-data-contracts.md',
  'docs/projection-registry.md',
  'docs/consumer-contract-matrix.md',
  'docs/non-regression-matrix.md',
  'docs/data-freshness-sla.md',
  'docs/alerts-taxonomy.md',
  'docs/ownership-and-actions.md',
  'docs/decision-kpis.md',
  'docs/trends-correlation.md',
  'docs/portfolio-view.md',
  'docs/graph-radar-secondary-context.md',
  'docs/evidence-audit-space.md',
  'docs/migration-plan.md',
  'docs/rollout-flags.md',
  'docs/pilot-payments-widgets.md',
  'docs/top5-rollout.md',
  'docs/final-governance-audit.md',
  'docs/readiness-signoff.md',
  'tests/visual/README.md',
  'tests/visual/_view-signatures.mjs',
  'tests/visual/baselines/view-signatures.json',
  'tests/visual/generate-view-signatures.mjs',
  'tests/e2e/_atlas-fixture.mjs',
  'tests/e2e/_atlas-runtime-harness.mjs',
  'tests/e2e/cockpit.spec.test.mjs',
  'tests/e2e/alerts.spec.test.mjs',
  'tests/e2e/domain.spec.test.mjs',
  'tests/e2e/portfolio.spec.test.mjs',
  'tests/e2e/visual-regression.spec.test.mjs',
  'tests/contracts/service-ops.contract.test.mjs',
  'data/architecture-service-ops-live-report.json',
  'data/contracts/manifest.json',
  'data/history/atlas-audit-index.json',
  'scripts/generate-audit-index.mjs',
  'scripts/validate-atlas-contracts.mjs',
  'scripts/lint-canonical-guardrails.mjs',
  'scripts/lib/service-ops-guardrails.mjs'
];

async function assertExists(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  await fs.access(filePath);
}

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function main() {
  const missing = [];
  for (const requiredPath of REQUIRED_PATHS) {
    try {
      await assertExists(requiredPath);
    } catch {
      missing.push(requiredPath);
    }
  }

  if (missing.length > 0) {
    console.error('Missing required governance/contract files:');
    for (const file of missing) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  const manifest = await readJson('data/contracts/manifest.json');
  const datasetEntries = Object.entries(manifest.datasets || {});

  if (datasetEntries.length !== 6) {
    console.error(`Expected 6 datasets in contract manifest, got ${datasetEntries.length}`);
    process.exit(1);
  }

  for (const [datasetName, config] of datasetEntries) {
    if (!config.currentSchemaVersion || !config.dataFile || !config.schemaFile) {
      console.error(`Dataset ${datasetName} is missing required manifest fields`);
      process.exit(1);
    }

    await assertExists(config.dataFile);
    await assertExists(config.schemaFile);

    await readJson(config.dataFile);
    await readJson(config.schemaFile);
  }

  await assertExists('scripts/lint-canonical-guardrails.mjs');

  console.log(`Atlas lint checks passed (${datasetEntries.length} contract datasets validated as JSON).`);
}

main().catch((error) => {
  console.error('Atlas lint failed:', error?.message || error);
  process.exit(1);
});
