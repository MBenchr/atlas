export const ALERT_TYPES = {
  DOMAIN_DRIFT: 'domain-drift',
  POLICY_WARNING: 'policy-warning',
  COUPLING_REGRESSION: 'coupling-regression',
  PROJECTED_SCORE_DROP: 'projected-score-drop',
  SNAPSHOT_STALE: 'snapshot-stale',
  HIGH_GAP_UNRESOLVED: 'high-gap-unresolved',
  STRATEGY_ROADMAP_DIVERGENCE: 'strategy-roadmap-divergence'
};

export function normalizeSeverity(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'critical' || key === 'blocking') return 'critical';
  if (key === 'high') return 'high';
  if (key === 'medium' || key === 'warn' || key === 'warning') return 'medium';
  return 'low';
}

export function severityRank(severity) {
  const key = normalizeSeverity(severity);
  if (key === 'critical') return 4;
  if (key === 'high') return 3;
  if (key === 'medium') return 2;
  return 1;
}

export function sanitizeAction(text, fallback) {
  const value = String(text || '').trim();
  if (!value || /^no action\.?$/i.test(value)) return fallback;
  return value;
}

export function buildOwnerMap(atlasData) {
  const map = new Map();
  for (const row of atlasData?.domainOwnership || []) {
    const domain = String(row?.domain || '').toLowerCase();
    if (!domain) continue;
    map.set(domain, String(row?.owner || '').trim() || 'atlas-ops');
  }
  return map;
}

export function buildRoadmapMap(atlasData) {
  const map = new Map();
  for (const step of atlasData?.roadmap || []) {
    const domain = String(step?.domain || '').toLowerCase();
    if (!domain) continue;
    map.set(domain, step);
  }
  return map;
}

export function buildDecisionPriorityMap(atlasData) {
  const map = new Map();
  for (const row of atlasData?.decisionPriority?.domains || []) {
    const domain = String(row?.domain || '').toLowerCase();
    if (!domain) continue;
    map.set(domain, Number(row?.score || 0));
  }
  return map;
}

export function summarizeTaxonomy(alerts) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};

  for (const alert of alerts || []) {
    const severity = normalizeSeverity(alert.severity);
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  }

  return {
    total: (alerts || []).length,
    bySeverity,
    byType
  };
}
