import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeHistorySnapshots,
  buildNotableEvents,
  buildWindowSummary,
  buildTrendsCorrelation
} from '../../scripts/lib/trends-correlation.mjs';

function sampleHistory() {
  return {
    snapshots: [
      {
        generatedAt: '2026-03-01T10:00:00.000Z',
        file: 'history/a.json',
        summary: {
          gapCount: 2,
          servicesCount: 6,
          graphNodes: 12,
          graphEdges: 25,
          domainScores: { payments: 92, pages: 89 }
        }
      },
      {
        generatedAt: '2026-03-03T10:00:00.000Z',
        file: 'history/b.json',
        summary: {
          gapCount: 4,
          servicesCount: 7,
          graphNodes: 14,
          graphEdges: 35,
          domainScores: { payments: 86, pages: 91 }
        }
      },
      {
        generatedAt: '2026-03-06T10:00:00.000Z',
        file: 'history/c.json',
        summary: {
          gapCount: 3,
          servicesCount: 8,
          graphNodes: 16,
          graphEdges: 42,
          domainScores: { payments: 88, pages: 90 }
        }
      }
    ]
  };
}

test('normalizeHistorySnapshots sorts and maps summary metrics', () => {
  const points = normalizeHistorySnapshots(sampleHistory());
  assert.equal(points.length, 3);
  assert.equal(points[0].file, 'history/a.json');
  assert.equal(points[2].graphEdges, 42);
});

test('buildNotableEvents emits causal events with impact score', () => {
  const points = normalizeHistorySnapshots(sampleHistory());
  const events = buildNotableEvents(points);
  assert.ok(events.length >= 1);
  assert.ok(events[0].impactScore >= events[events.length - 1].impactScore);
  assert.ok(events[0].whatChanged.length > 0);
});

test('buildWindowSummary computes deltas and event ids', () => {
  const points = normalizeHistorySnapshots(sampleHistory());
  const events = buildNotableEvents(points);
  const summary = buildWindowSummary(points, events, 24 * 30, '30d');
  assert.equal(summary.windowKey, '30d');
  assert.ok(Number.isFinite(summary.deltas.avgScoreDelta));
  assert.ok(Array.isArray(summary.notableEvents));
});

test('buildTrendsCorrelation returns windows and domain windows map', () => {
  const payload = buildTrendsCorrelation(sampleHistory(), { generatedAt: '2026-03-09T00:00:00.000Z' });
  assert.equal(payload.generatedAt, '2026-03-09T00:00:00.000Z');
  assert.ok(payload.windows['7d']);
  assert.ok(payload.windows['30d']);
  assert.ok(payload.windows['90d']);
  assert.ok(payload.domainWindows.payments);
});

