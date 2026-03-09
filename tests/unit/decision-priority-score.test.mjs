import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeAlertDecisionPriority,
  computeDomainDecisionPriority,
  severityToFactor,
  sortByDecisionPriority
} from '../../scripts/lib/decision-priority-score.mjs';

test('severity factor ordering is monotonic', () => {
  assert.ok(severityToFactor('critical') > severityToFactor('high'));
  assert.ok(severityToFactor('high') > severityToFactor('medium'));
  assert.ok(severityToFactor('medium') > severityToFactor('low'));
  assert.ok(severityToFactor('low') > severityToFactor('none'));
});

test('domain priority favors active high-impact degradation', () => {
  const healthyDomain = computeDomainDecisionPriority({
    domain: 'forms',
    severity: 'low',
    strategicImportance: 40,
    businessCriticality: 'low',
    projectedDrop: 0,
    trendDown: 0,
    driftFindings: 0,
    consumers: 1,
    crossDomainImports: 0,
    coordinationCost: 1,
    hasCanonicalProjection: true,
    hasOwner: true,
    recommendedActionsCount: 1,
    gapCount: 0,
    policyViolationCount: 0,
    currentScore: 96,
    projectedScore: 96,
    freshnessHours: 1,
    strategicPriority: 'low'
  });

  const activeHighRiskDomain = computeDomainDecisionPriority({
    domain: 'payments',
    severity: 'high',
    strategicImportance: 100,
    businessCriticality: 'critical',
    projectedDrop: 28,
    trendDown: 2,
    driftFindings: 14,
    consumers: 3,
    crossDomainImports: 14,
    coordinationCost: 5,
    hasCanonicalProjection: true,
    hasOwner: true,
    recommendedActionsCount: 3,
    gapCount: 1,
    policyViolationCount: 1,
    currentScore: 96,
    projectedScore: 68,
    freshnessHours: 1,
    strategicPriority: 'high'
  });

  assert.ok(activeHighRiskDomain.score > healthyDomain.score);
});

test('tie-break keeps higher strategic priority first when scores are equal', () => {
  const sorted = sortByDecisionPriority([
    {
      domain: 'widgets',
      score: 70,
      tieBreak: { freshness: 90, strategicPriority: 1, strategicImportance: 60 }
    },
    {
      domain: 'payments',
      score: 70,
      tieBreak: { freshness: 90, strategicPriority: 3, strategicImportance: 100 }
    }
  ]);

  assert.equal(sorted[0].domain, 'payments');
});

test('alert score inherits domain priority and severity', () => {
  const domainPriority = computeDomainDecisionPriority({
    domain: 'payments',
    severity: 'high',
    strategicImportance: 100,
    businessCriticality: 'critical',
    projectedDrop: 20,
    trendDown: 1,
    driftFindings: 10,
    consumers: 3,
    crossDomainImports: 10,
    coordinationCost: 4,
    hasCanonicalProjection: true,
    hasOwner: true,
    recommendedActionsCount: 2,
    gapCount: 1,
    policyViolationCount: 1,
    currentScore: 96,
    projectedScore: 76,
    freshnessHours: 2,
    strategicPriority: 'high'
  });

  const criticalAlert = computeAlertDecisionPriority({
    alertId: 'a1',
    domain: 'payments',
    severity: 'critical',
    domainPriority,
    actionabilityBoost: 0.5
  });

  const mediumAlert = computeAlertDecisionPriority({
    alertId: 'a2',
    domain: 'payments',
    severity: 'medium',
    domainPriority,
    actionabilityBoost: 0
  });

  assert.ok(criticalAlert.score > mediumAlert.score);
});
