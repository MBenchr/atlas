import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

test('alerts flow keeps filters and remediation CTA markers', async () => {
  const [appJs, stylesCss] = await Promise.all([read('app.js'), read('styles.css')]);

  assert.ok(appJs.includes('alertSeverityFilter'), 'alert severity filtering state must exist');
  assert.ok(appJs.includes('alertDomainFilter'), 'alert domain filtering state must exist');
  assert.ok(appJs.includes('alertOwnerFilter'), 'alert owner filtering state must exist');
  assert.ok(appJs.includes('alertTypeFilter'), 'alert type filtering state must exist');
  assert.ok(appJs.includes('alertStateFilter'), 'alert state filtering state must exist');
  assert.ok(appJs.includes('buildArchitectureAlerts'), 'alert builder function must exist');
  assert.ok(appJs.includes('Action recommandée'), 'remediation CTA copy must exist');
  assert.ok(appJs.includes('data-alert-domain-filter'), 'domain filter control marker must exist');
  assert.ok(appJs.includes('data-alert-owner-filter'), 'owner filter control marker must exist');
  assert.ok(appJs.includes('data-alert-type-filter'), 'type filter control marker must exist');
  assert.ok(appJs.includes('data-alert-state-filter'), 'state filter control marker must exist');
  assert.ok(appJs.includes('data-alert-proof-open'), 'proof drawer trigger marker must exist');
  assert.ok(appJs.includes('owner-action,priority'), 'owner action KPI instrumentation marker must exist');
  assert.ok(appJs.includes('priority,rationale,drilldown'), 'drilldown KPI instrumentation marker must exist');

  assert.ok(stylesCss.includes('.alert-toolbar'), 'alert toolbar styles must exist');
  assert.ok(stylesCss.includes('.alert-filter-btn'), 'alert filter styles must exist');
  assert.ok(stylesCss.includes('.alert-select'), 'alert select styles must exist');
  assert.ok(stylesCss.includes('.alert-queue'), 'alert queue styles must exist');
  assert.ok(stylesCss.includes('.alert-proof-drawer'), 'alert proof drawer styles must exist');
});

test('domain drill-down keeps details and ownership signals', async () => {
  const appJs = await read('app.js');

  assert.ok(appJs.includes('function getDomainProfile'), 'domain profile accessor must exist');
  assert.ok(appJs.includes('function getDriftDomain'), 'drift domain accessor must exist');
  assert.ok(appJs.includes('function renderDomainMaster'), 'domain master rendering must exist');
  assert.ok(appJs.includes('data-domain-master-filter'), 'domain master filter marker must exist');
  assert.ok(appJs.includes('data-domain-proof-open'), 'domain proof drawer marker must exist');
  assert.ok(appJs.includes('owner-missing'), 'owner escalation marker must exist');
  assert.ok(appJs.includes('AHS détails'), 'domain drilldown detail payload must exist');
  assert.ok(appJs.includes('Consommateurs:'), 'consumer ownership marker must exist');
});
