export const DEFAULT_FRESHNESS_SLA_HOURS = {
  normal: 24,
  degraded: 48
};

export function clampHours(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
}

export function parseIsoTimestamp(value) {
  const iso = String(value || '');
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return { iso, timestamp: ts };
}

export function computeAgeHours(isoDate, nowMs = Date.now()) {
  const parsed = parseIsoTimestamp(isoDate);
  if (!parsed) return null;
  const age = (Number(nowMs) - parsed.timestamp) / (1000 * 60 * 60);
  return clampHours(Math.max(0, age));
}

export function freshnessStatusFromAge(ageHours, slaHours = DEFAULT_FRESHNESS_SLA_HOURS) {
  const age = Number(ageHours);
  const normal = Number(slaHours?.normal ?? DEFAULT_FRESHNESS_SLA_HOURS.normal);
  const degraded = Number(slaHours?.degraded ?? DEFAULT_FRESHNESS_SLA_HOURS.degraded);

  if (!Number.isFinite(age)) return 'stale';
  if (age <= normal) return 'normal';
  if (age <= degraded) return 'degraded';
  return 'stale';
}

export function severityFromFreshness(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'stale') return 'critical';
  if (key === 'degraded') return 'high';
  return 'low';
}

export function summarizeGlobalStatus(datasetStatuses) {
  const rank = { normal: 0, degraded: 1, stale: 2 };
  let winner = 'normal';
  for (const status of datasetStatuses || []) {
    const key = String(status || 'normal').toLowerCase();
    if ((rank[key] ?? 0) > rank[winner]) winner = key;
  }
  return winner;
}

export function buildFreshnessContract({ datasets, slaHours = DEFAULT_FRESHNESS_SLA_HOURS, generatedAt = new Date().toISOString() }) {
  const normalizedRows = (datasets || []).map((dataset) => {
    const ageHours = computeAgeHours(dataset.generatedAt);
    const status = freshnessStatusFromAge(ageHours, slaHours);
    return {
      dataset: String(dataset.dataset || ''),
      file: String(dataset.file || ''),
      generatedAt: String(dataset.generatedAt || ''),
      ageHours: Number(ageHours ?? 0),
      status
    };
  });

  const globalStatus = summarizeGlobalStatus(normalizedRows.map((row) => row.status));
  const staleDatasets = normalizedRows.filter((row) => row.status === 'stale');
  const alerts = staleDatasets.map((row) => ({
    id: `freshness:${row.dataset}`,
    type: 'freshness',
    dataset: row.dataset,
    domain: 'platform',
    severity: severityFromFreshness(row.status),
    status: row.status,
    ageHours: row.ageHours,
    generatedAt: row.generatedAt,
    explanation: `Dataset ${row.dataset} stale (${row.ageHours}h).`,
    action: `Rafraîchir ${row.dataset} puis revalider les quality gates.`
  }));

  return {
    generatedAt,
    slaHours: {
      normal: Number(slaHours.normal),
      degraded: Number(slaHours.degraded)
    },
    globalStatus,
    datasets: normalizedRows,
    staleDatasetCount: staleDatasets.length,
    alerts
  };
}
