function asNumber(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a finite number`);
  }
  return numeric;
}

function asNonNegativeNumber(value, label) {
  const numeric = asNumber(value, label);
  if (numeric < 0) {
    throw new Error(`${label} must be >= 0`);
  }
  return numeric;
}

function assertPercentage(value, label) {
  const numeric = asNonNegativeNumber(value, label);
  if (numeric > 100) {
    throw new Error(`${label} must be <= 100`);
  }
  return numeric;
}

function assertCountMatchesArray(count, values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  if (count !== values.length) {
    throw new Error(`${label} count mismatch (${count}/${values.length})`);
  }
}

export function assertDecisionKpiContract(decisionKpis) {
  if (!decisionKpis || typeof decisionKpis !== 'object') {
    throw new Error('architecture-service-ops-live-report.decisionKpis must be present');
  }

  const targets = decisionKpis.targets || {};
  asNumber(targets.timeToFirstPrioritySec, 'decisionKpis.targets.timeToFirstPrioritySec');
  asNumber(targets.timeToRationaleSec, 'decisionKpis.targets.timeToRationaleSec');
  asNumber(targets.clicksToOwnerAction, 'decisionKpis.targets.clicksToOwnerAction');
  assertPercentage(targets.drilldownRateMin, 'decisionKpis.targets.drilldownRateMin');

  for (const section of ['baselineBeforeRefactor', 'postRefactorBaseline']) {
    const row = decisionKpis[section] || {};
    asNumber(row.timeToFirstPrioritySec, `decisionKpis.${section}.timeToFirstPrioritySec`);
    asNumber(row.timeToRationaleSec, `decisionKpis.${section}.timeToRationaleSec`);
    asNumber(row.clicksToOwnerAction, `decisionKpis.${section}.clicksToOwnerAction`);
    assertPercentage(row.drilldownRate, `decisionKpis.${section}.drilldownRate`);
  }
}

export function assertServiceCoverageContract(serviceCoverage, summary = null) {
  if (!serviceCoverage || typeof serviceCoverage !== 'object') {
    throw new Error('architecture-service-ops-live-report.serviceCoverage must be present');
  }

  const detectedCount = asNonNegativeNumber(serviceCoverage.detectedCount, 'serviceCoverage.detectedCount');
  const monitoredCount = asNonNegativeNumber(serviceCoverage.monitoredCount, 'serviceCoverage.monitoredCount');
  const matchedCount = asNonNegativeNumber(serviceCoverage.matchedCount, 'serviceCoverage.matchedCount');
  const missingMonitoringCount = asNonNegativeNumber(
    serviceCoverage.missingMonitoringCount,
    'serviceCoverage.missingMonitoringCount'
  );
  const monitoredWithoutDetectionCount = asNonNegativeNumber(
    serviceCoverage.monitoredWithoutDetectionCount,
    'serviceCoverage.monitoredWithoutDetectionCount'
  );
  const platformMonitoredOnlyCount = asNonNegativeNumber(
    serviceCoverage.platformMonitoredOnlyCount,
    'serviceCoverage.platformMonitoredOnlyCount'
  );
  const unexpectedMonitoredWithoutDetectionCount = asNonNegativeNumber(
    serviceCoverage.unexpectedMonitoredWithoutDetectionCount,
    'serviceCoverage.unexpectedMonitoredWithoutDetectionCount'
  );

  assertPercentage(serviceCoverage.detectionCoveragePct, 'serviceCoverage.detectionCoveragePct');
  assertPercentage(serviceCoverage.monitoringPrecisionPct, 'serviceCoverage.monitoringPrecisionPct');

  if (matchedCount > detectedCount) {
    throw new Error('serviceCoverage.matchedCount must be <= detectedCount');
  }
  if (missingMonitoringCount > detectedCount) {
    throw new Error('serviceCoverage.missingMonitoringCount must be <= detectedCount');
  }
  if (monitoredWithoutDetectionCount > monitoredCount) {
    throw new Error('serviceCoverage.monitoredWithoutDetectionCount must be <= monitoredCount');
  }
  if (platformMonitoredOnlyCount > monitoredWithoutDetectionCount) {
    throw new Error('serviceCoverage.platformMonitoredOnlyCount must be <= monitoredWithoutDetectionCount');
  }
  if (unexpectedMonitoredWithoutDetectionCount > monitoredWithoutDetectionCount) {
    throw new Error('serviceCoverage.unexpectedMonitoredWithoutDetectionCount must be <= monitoredWithoutDetectionCount');
  }
  if (platformMonitoredOnlyCount + unexpectedMonitoredWithoutDetectionCount !== monitoredWithoutDetectionCount) {
    throw new Error(
      'serviceCoverage.platformMonitoredOnlyCount + unexpectedMonitoredWithoutDetectionCount must equal monitoredWithoutDetectionCount'
    );
  }

  assertCountMatchesArray(matchedCount, serviceCoverage.matched, 'serviceCoverage.matched');
  assertCountMatchesArray(missingMonitoringCount, serviceCoverage.missingMonitoring, 'serviceCoverage.missingMonitoring');
  assertCountMatchesArray(
    monitoredWithoutDetectionCount,
    serviceCoverage.monitoredWithoutDetection,
    'serviceCoverage.monitoredWithoutDetection'
  );
  assertCountMatchesArray(
    platformMonitoredOnlyCount,
    serviceCoverage.platformMonitoredOnly,
    'serviceCoverage.platformMonitoredOnly'
  );
  assertCountMatchesArray(
    unexpectedMonitoredWithoutDetectionCount,
    serviceCoverage.unexpectedMonitoredWithoutDetection,
    'serviceCoverage.unexpectedMonitoredWithoutDetection'
  );

  if (summary && typeof summary === 'object') {
    const summaryExternalDetected = asNonNegativeNumber(
      summary.externalServicesDetected,
      'summary.externalServicesDetected'
    );
    const summaryServicesMonitored = asNonNegativeNumber(summary.servicesMonitored, 'summary.servicesMonitored');
    const summaryServicesMatched = asNonNegativeNumber(summary.servicesMatched, 'summary.servicesMatched');
    const summaryServicesMissingMonitoring = asNonNegativeNumber(
      summary.servicesMissingMonitoring,
      'summary.servicesMissingMonitoring'
    );
    const summaryMonitoredNotDetected = asNonNegativeNumber(summary.monitoredNotDetected, 'summary.monitoredNotDetected');
    const summaryPlatformMonitoredOnly = asNonNegativeNumber(
      summary.platformMonitoredOnly,
      'summary.platformMonitoredOnly'
    );
    const summaryUnexpectedMonitoredNotDetected = asNonNegativeNumber(
      summary.unexpectedMonitoredNotDetected,
      'summary.unexpectedMonitoredNotDetected'
    );

    if (summaryExternalDetected !== detectedCount) {
      throw new Error('summary.externalServicesDetected must match serviceCoverage.detectedCount');
    }
    if (summaryServicesMonitored !== monitoredCount) {
      throw new Error('summary.servicesMonitored must match serviceCoverage.monitoredCount');
    }
    if (summaryServicesMatched !== matchedCount) {
      throw new Error('summary.servicesMatched must match serviceCoverage.matchedCount');
    }
    if (summaryServicesMissingMonitoring !== missingMonitoringCount) {
      throw new Error('summary.servicesMissingMonitoring must match serviceCoverage.missingMonitoringCount');
    }
    if (summaryMonitoredNotDetected !== monitoredWithoutDetectionCount) {
      throw new Error('summary.monitoredNotDetected must match serviceCoverage.monitoredWithoutDetectionCount');
    }
    if (summaryPlatformMonitoredOnly !== platformMonitoredOnlyCount) {
      throw new Error('summary.platformMonitoredOnly must match serviceCoverage.platformMonitoredOnlyCount');
    }
    if (summaryUnexpectedMonitoredNotDetected !== unexpectedMonitoredWithoutDetectionCount) {
      throw new Error(
        'summary.unexpectedMonitoredNotDetected must match serviceCoverage.unexpectedMonitoredWithoutDetectionCount'
      );
    }
  }
}

export function assertServiceOpsSummary(summary, serviceCoverage = null) {
  if (!summary || typeof summary !== 'object') {
    throw new Error('architecture-service-ops-live-report.summary must be present');
  }

  const totalServices = asNonNegativeNumber(summary.totalServices, 'summary.totalServices');
  const healthy = asNonNegativeNumber(summary.healthy, 'summary.healthy');
  const runtimeDegraded = asNonNegativeNumber(summary.runtimeDegraded, 'summary.runtimeDegraded');
  const unconfigured = asNonNegativeNumber(summary.unconfigured, 'summary.unconfigured');
  const down = asNonNegativeNumber(summary.down, 'summary.down');
  const unknown = asNonNegativeNumber(summary.unknown, 'summary.unknown');
  const degraded = asNonNegativeNumber(summary.degraded, 'summary.degraded');

  if (healthy + runtimeDegraded + unconfigured + down + unknown !== totalServices) {
    throw new Error('summary service state counts must add up to totalServices');
  }
  if (runtimeDegraded > degraded) {
    throw new Error('summary.runtimeDegraded must be <= summary.degraded');
  }
  if (!Array.isArray(summary.topRiskServices)) {
    throw new Error('summary.topRiskServices must be an array');
  }

  if (serviceCoverage) {
    assertServiceCoverageContract(serviceCoverage, summary);
  }
}

export function assertServiceOpsGuardrails(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('architecture-service-ops-live-report must be present');
  }
  assertDecisionKpiContract(report.decisionKpis);
  assertServiceOpsSummary(report.summary, report.serviceCoverage);
}
