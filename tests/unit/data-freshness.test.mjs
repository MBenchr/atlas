import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreshnessContract,
  computeAgeHours,
  freshnessStatusFromAge
} from '../../scripts/lib/data-freshness.mjs';

test('freshnessStatusFromAge follows normal -> degraded -> stale thresholds', () => {
  assert.equal(freshnessStatusFromAge(4, { normal: 24, degraded: 48 }), 'normal');
  assert.equal(freshnessStatusFromAge(30, { normal: 24, degraded: 48 }), 'degraded');
  assert.equal(freshnessStatusFromAge(72, { normal: 24, degraded: 48 }), 'stale');
});

test('computeAgeHours returns null for invalid date and positive value for valid date', () => {
  assert.equal(computeAgeHours('not-a-date'), null);
  const age = computeAgeHours('2026-03-09T00:00:00.000Z', Date.parse('2026-03-09T06:00:00.000Z'));
  assert.equal(age, 6);
});

test('buildFreshnessContract emits stale alerts automatically', () => {
  const contract = buildFreshnessContract({
    slaHours: { normal: 24, degraded: 48 },
    generatedAt: '2026-03-09T12:00:00.000Z',
    datasets: [
      {
        dataset: 'atlas-data',
        file: 'data/atlas-data.json',
        generatedAt: '2026-03-09T11:00:00.000Z'
      },
      {
        dataset: 'atlas-history',
        file: 'data/atlas-history.json',
        generatedAt: '2026-03-05T11:00:00.000Z'
      }
    ]
  });

  assert.equal(contract.globalStatus, 'stale');
  assert.equal(contract.staleDatasetCount, 1);
  assert.equal(contract.alerts.length, 1);
  assert.equal(contract.alerts[0].id, 'freshness:atlas-history');
});
