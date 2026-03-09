export const SEVERITY_FACTOR = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1
};

export const BUSINESS_CRITICALITY_FACTOR = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  unknown: 2.5
};

export const PRIORITY_MAX_RAW = 5 ** 5;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function severityToFactor(severity) {
  const key = String(severity || 'none').toLowerCase();
  return SEVERITY_FACTOR[key] ?? SEVERITY_FACTOR.none;
}

export function businessCriticalityToFactor(level) {
  const key = String(level || 'unknown').toLowerCase();
  return BUSINESS_CRITICALITY_FACTOR[key] ?? BUSINESS_CRITICALITY_FACTOR.unknown;
}

function normalizeLog(raw) {
  const safeRaw = Math.max(1, Number(raw) || 1);
  const normalized = Math.log(safeRaw) / Math.log(PRIORITY_MAX_RAW);
  return clamp(normalized, 0, 1);
}

export function scoreFromRaw(raw) {
  return Math.round(normalizeLog(raw) * 1000) / 10;
}

export function computeDecisionPriorityRaw({
  severityFactor,
  impactFactor,
  degradationFactor,
  blastRadiusFactor,
  actionabilityFactor
}) {
  const factors = [severityFactor, impactFactor, degradationFactor, blastRadiusFactor, actionabilityFactor].map((value) =>
    clamp(Number(value) || 1, 1, 5)
  );

  return factors.reduce((acc, value) => acc * value, 1);
}

export function computeDomainDecisionPriority(input) {
  const {
    domain,
    severity = 'none',
    strategicImportance = 50,
    businessCriticality = 'unknown',
    projectedDrop = 0,
    trendDown = 0,
    driftFindings = 0,
    consumers = 0,
    crossDomainImports = 0,
    coordinationCost = 0,
    hasCanonicalProjection = false,
    hasOwner = false,
    recommendedActionsCount = 0,
    gapCount = 0,
    policyViolationCount = 0,
    currentScore = 0,
    projectedScore = 0,
    freshnessHours = 0,
    strategicPriority = 'low'
  } = input;

  const severityFactor = severityToFactor(severity);
  const strategicFactor = clamp(1 + Number(strategicImportance || 0) / 25, 1, 5);
  const criticalityFactor = businessCriticalityToFactor(businessCriticality);
  const impactFactor = clamp(criticalityFactor * 0.6 + strategicFactor * 0.4, 1, 5);

  const degradationIndex =
    Number(projectedDrop || 0) * 2 +
    Number(trendDown || 0) * 3 +
    Number(driftFindings || 0) * 2;
  const degradationFactor = clamp(1 + degradationIndex / 20, 1, 5);

  const blastIndex =
    Number(consumers || 0) * 12 +
    Number(crossDomainImports || 0) * 2 +
    Number(coordinationCost || 0) * 8;
  const blastRadiusFactor = clamp(1 + blastIndex / 50, 1, 5);

  const actionSignals =
    (Number(driftFindings || 0) > 0 ? 1 : 0) +
    (Number(gapCount || 0) > 0 ? 1 : 0) +
    (Number(policyViolationCount || 0) > 0 ? 1 : 0) +
    (Number(recommendedActionsCount || 0) > 0 ? 1 : 0) +
    (hasCanonicalProjection ? 1 : 0) +
    (hasOwner ? 1 : 0);
  const actionabilityFactor = clamp(1 + actionSignals * 0.65, 1, 5);

  const raw = computeDecisionPriorityRaw({
    severityFactor,
    impactFactor,
    degradationFactor,
    blastRadiusFactor,
    actionabilityFactor
  });

  const score = scoreFromRaw(raw);
  const freshnessTieBreaker = clamp(100 - Number(freshnessHours || 0) * 2, 0, 100);
  const strategicTieBreaker =
    strategicPriority === 'high' ? 3 : strategicPriority === 'medium' ? 2 : strategicPriority === 'low' ? 1 : 0;

  return {
    domain,
    formula: 'severity * impact * degradation * blast_radius * actionability',
    score,
    raw,
    factors: {
      severity: severityFactor,
      impact: Number(impactFactor.toFixed(3)),
      degradation: Number(degradationFactor.toFixed(3)),
      blastRadius: Number(blastRadiusFactor.toFixed(3)),
      actionability: Number(actionabilityFactor.toFixed(3))
    },
    signals: {
      severity,
      strategicImportance: Number(strategicImportance || 0),
      businessCriticality,
      projectedDrop: Number(projectedDrop || 0),
      trendDown: Number(trendDown || 0),
      driftFindings: Number(driftFindings || 0),
      consumers: Number(consumers || 0),
      crossDomainImports: Number(crossDomainImports || 0),
      coordinationCost: Number(coordinationCost || 0),
      gapCount: Number(gapCount || 0),
      policyViolationCount: Number(policyViolationCount || 0),
      hasCanonicalProjection: Boolean(hasCanonicalProjection),
      hasOwner: Boolean(hasOwner),
      recommendedActionsCount: Number(recommendedActionsCount || 0),
      currentScore: Number(currentScore || 0),
      projectedScore: Number(projectedScore || 0)
    },
    tieBreak: {
      freshness: Number(freshnessTieBreaker.toFixed(2)),
      strategicPriority: strategicTieBreaker,
      strategicImportance: Number(strategicImportance || 0)
    }
  };
}

export function computeAlertDecisionPriority({
  alertId,
  domain,
  severity = 'low',
  domainPriority,
  actionabilityBoost = 0
}) {
  const domainBase = domainPriority?.score ?? 0;
  const domainFactors = domainPriority?.factors || {};

  const severityFactor = severityToFactor(severity);
  const impactFactor = clamp(Number(domainFactors.impact || 1), 1, 5);
  const degradationFactor = clamp(Number(domainFactors.degradation || 1), 1, 5);
  const blastRadiusFactor = clamp(Number(domainFactors.blastRadius || 1), 1, 5);
  const actionabilityFactor = clamp(Number(domainFactors.actionability || 1) + Number(actionabilityBoost || 0), 1, 5);

  const raw = computeDecisionPriorityRaw({
    severityFactor,
    impactFactor,
    degradationFactor,
    blastRadiusFactor,
    actionabilityFactor
  });

  const score = Number((scoreFromRaw(raw) * 0.7 + domainBase * 0.3).toFixed(1));

  return {
    id: alertId,
    domain,
    severity,
    score,
    raw,
    factors: {
      severity: severityFactor,
      impact: Number(impactFactor.toFixed(3)),
      degradation: Number(degradationFactor.toFixed(3)),
      blastRadius: Number(blastRadiusFactor.toFixed(3)),
      actionability: Number(actionabilityFactor.toFixed(3))
    }
  };
}

export function sortByDecisionPriority(items) {
  return [...items].sort((a, b) => {
    const scoreDelta = Number(b?.score || 0) - Number(a?.score || 0);
    if (scoreDelta !== 0) return scoreDelta;

    const freshDelta = Number(b?.tieBreak?.freshness || 0) - Number(a?.tieBreak?.freshness || 0);
    if (freshDelta !== 0) return freshDelta;

    const strategicDelta = Number(b?.tieBreak?.strategicPriority || 0) - Number(a?.tieBreak?.strategicPriority || 0);
    if (strategicDelta !== 0) return strategicDelta;

    return Number(b?.tieBreak?.strategicImportance || 0) - Number(a?.tieBreak?.strategicImportance || 0);
  });
}
