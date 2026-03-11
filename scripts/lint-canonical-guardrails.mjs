#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const APP_PATH = path.join(ROOT, 'app.js');

const REQUIRED_MARKERS = [
  'function buildNonCanonicalAlertQueue',
  "Fraicheur: indisponible (non canonique)",
  "Projection canonique alertsTaxonomy indisponible. La queue opératoire locale n'est pas reconstruite.",
  "Projection indisponible: aucun KPI décision canonique n'a été chargé depuis le report service-ops.",
  'return buildNonCanonicalAlertQueue(data);'
];

async function main() {
  const content = await fs.readFile(APP_PATH, 'utf8');
  const missing = REQUIRED_MARKERS.filter((marker) => !content.includes(marker));
  if (missing.length > 0) {
    console.error('Missing canonical guardrail marker(s) in app.js:');
    for (const marker of missing) {
      console.error(`  - ${marker}`);
    }
    process.exit(1);
  }
  console.log(`Canonical guardrail markers passed (${REQUIRED_MARKERS.length}).`);
}

main().catch((error) => {
  console.error('Canonical guardrail lint failed:', error?.message || error);
  process.exit(1);
});
