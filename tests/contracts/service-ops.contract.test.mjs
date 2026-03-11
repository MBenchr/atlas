import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { assertServiceOpsGuardrails } from '../../scripts/lib/service-ops-guardrails.mjs';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

test('service-ops report exposes canonical decision KPI and coverage guardrails', async () => {
  const report = await readJson('data/architecture-service-ops-live-report.json');
  assert.doesNotThrow(() => assertServiceOpsGuardrails(report));
});
