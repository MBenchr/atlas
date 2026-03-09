import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERT_TYPES,
  normalizeSeverity,
  sanitizeAction,
  summarizeTaxonomy
} from '../../scripts/lib/alerts-taxonomy.mjs';

test('normalizeSeverity maps blocking/warning values to supported severities', () => {
  assert.equal(normalizeSeverity('blocking'), 'critical');
  assert.equal(normalizeSeverity('warning'), 'medium');
  assert.equal(normalizeSeverity('high'), 'high');
  assert.equal(normalizeSeverity('unknown'), 'low');
});

test('sanitizeAction rejects mute actions and enforces fallback', () => {
  const fallback = 'Execute remediation playbook.';
  assert.equal(sanitizeAction('No action.', fallback), fallback);
  assert.equal(sanitizeAction('', fallback), fallback);
  assert.equal(sanitizeAction('Fix projection ownership.', fallback), 'Fix projection ownership.');
});

test('taxonomy summary counts by severity and type', () => {
  const summary = summarizeTaxonomy([
    { type: ALERT_TYPES.DOMAIN_DRIFT, severity: 'high' },
    { type: ALERT_TYPES.DOMAIN_DRIFT, severity: 'critical' },
    { type: ALERT_TYPES.POLICY_WARNING, severity: 'medium' }
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.bySeverity.critical, 1);
  assert.equal(summary.bySeverity.high, 1);
  assert.equal(summary.bySeverity.medium, 1);
  assert.equal(summary.byType[ALERT_TYPES.DOMAIN_DRIFT], 2);
  assert.equal(summary.byType[ALERT_TYPES.POLICY_WARNING], 1);
});
