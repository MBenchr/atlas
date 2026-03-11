import test from 'node:test';
import assert from 'node:assert/strict';

import { assertServiceOpsGuardrails } from '../../scripts/lib/service-ops-guardrails.mjs';

function buildValidReport() {
  return {
    decisionKpis: {
      targets: {
        timeToFirstPrioritySec: 30,
        timeToRationaleSec: 60,
        clicksToOwnerAction: 2,
        drilldownRateMin: 40,
      },
      baselineBeforeRefactor: {
        timeToFirstPrioritySec: 120,
        timeToRationaleSec: 180,
        clicksToOwnerAction: 5,
        drilldownRate: 10,
      },
      postRefactorBaseline: {
        timeToFirstPrioritySec: 25,
        timeToRationaleSec: 40,
        clicksToOwnerAction: 2,
        drilldownRate: 65,
      },
    },
    summary: {
      totalServices: 4,
      healthy: 2,
      degraded: 1,
      runtimeDegraded: 1,
      unconfigured: 1,
      down: 0,
      unknown: 0,
      externalServicesDetected: 2,
      servicesMonitored: 3,
      servicesMatched: 2,
      servicesMissingMonitoring: 0,
      monitoredNotDetected: 1,
      platformMonitoredOnly: 1,
      unexpectedMonitoredNotDetected: 0,
      topRiskServices: ['Linear'],
    },
    serviceCoverage: {
      detectedCount: 2,
      monitoredCount: 3,
      matchedCount: 2,
      missingMonitoringCount: 0,
      monitoredWithoutDetectionCount: 1,
      platformMonitoredOnlyCount: 1,
      unexpectedMonitoredWithoutDetectionCount: 0,
      detectionCoveragePct: 100,
      monitoringPrecisionPct: 66.7,
      matched: ['Linear', 'GitHub'],
      missingMonitoring: [],
      monitoredWithoutDetection: ['Figma'],
      platformMonitoredOnly: ['Figma'],
      unexpectedMonitoredWithoutDetection: [],
    },
  };
}

test('service-ops guardrails accept a coherent canonical report', () => {
  assert.doesNotThrow(() => assertServiceOpsGuardrails(buildValidReport()));
});

test('service-ops guardrails reject incoherent service coverage counts', () => {
  const report = buildValidReport();
  report.serviceCoverage.platformMonitoredOnlyCount = 2;
  assert.throws(
    () => assertServiceOpsGuardrails(report),
    /must equal monitoredWithoutDetectionCount|must be <= monitoredWithoutDetectionCount/
  );
});
