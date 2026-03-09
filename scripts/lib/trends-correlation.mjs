const HOUR_MS = 1000 * 60 * 60;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function averageDomainScore(domainScores = {}) {
  const values = Object.values(domainScores || {}).map((value) => toNumber(value));
  if (!values.length) return 0;
  const total = values.reduce((acc, value) => acc + value, 0);
  return Number((total / values.length).toFixed(2));
}

export function normalizeHistorySnapshots(history) {
  const snapshots = Array.isArray(history?.snapshots) ? history.snapshots : [];
  return snapshots
    .map((snapshot) => {
      const generatedAt = String(snapshot?.generatedAt || "");
      const timestamp = Date.parse(generatedAt);
      if (Number.isNaN(timestamp)) return null;
      const summary = snapshot?.summary || {};
      return {
        generatedAt,
        timestamp,
        file: String(snapshot?.file || ""),
        avgScore: averageDomainScore(summary.domainScores || {}),
        gaps: toNumber(summary.gapCount),
        services: toNumber(summary.servicesCount),
        graphNodes: toNumber(summary.graphNodes),
        graphEdges: toNumber(summary.graphEdges),
        domainScores: summary.domainScores || {},
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function toChangedDomains(previous = {}, current = {}) {
  const domainKeys = [...new Set([...Object.keys(previous), ...Object.keys(current)])];
  return domainKeys
    .map((domain) => {
      const prevScore = toNumber(previous[domain]);
      const currScore = toNumber(current[domain]);
      const scoreDelta = Number((currScore - prevScore).toFixed(2));
      return {
        domain,
        previousScore: prevScore,
        currentScore: currScore,
        scoreDelta,
      };
    })
    .filter((row) => row.scoreDelta !== 0)
    .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta));
}

function eventImpactScore(signals = {}) {
  const score = Math.abs(toNumber(signals.avgScoreDelta)) * 8 +
    Math.abs(toNumber(signals.gapDelta)) * 14 +
    Math.abs(toNumber(signals.graphEdgesDelta)) * 0.5 +
    Math.abs(toNumber(signals.graphNodesDelta)) * 0.6 +
    Math.abs(toNumber(signals.servicesDelta)) * 10 +
    (Array.isArray(signals.changedDomains) ? signals.changedDomains.length * 4 : 0);
  return Math.max(0, Math.min(100, Number(score.toFixed(1))));
}

function impactLevel(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function detectPrimaryDriver(signals = {}) {
  const candidates = [
    { key: "gapDelta", score: Math.abs(toNumber(signals.gapDelta)), label: "gaps" },
    { key: "graphEdgesDelta", score: Math.abs(toNumber(signals.graphEdgesDelta)), label: "couplage" },
    { key: "avgScoreDelta", score: Math.abs(toNumber(signals.avgScoreDelta)), label: "sante" },
    { key: "servicesDelta", score: Math.abs(toNumber(signals.servicesDelta)), label: "services" },
  ].sort((a, b) => b.score - a.score);
  return candidates[0]?.label || "signals";
}

export function buildNotableEvents(points = []) {
  const events = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const changedDomains = toChangedDomains(previous.domainScores, current.domainScores);
    const signals = {
      avgScoreDelta: Number((current.avgScore - previous.avgScore).toFixed(2)),
      gapDelta: Number((current.gaps - previous.gaps).toFixed(2)),
      graphEdgesDelta: Number((current.graphEdges - previous.graphEdges).toFixed(2)),
      graphNodesDelta: Number((current.graphNodes - previous.graphNodes).toFixed(2)),
      servicesDelta: Number((current.services - previous.services).toFixed(2)),
      changedDomains: changedDomains.slice(0, 5),
    };

    const hasAnyDelta =
      signals.avgScoreDelta !== 0 ||
      signals.gapDelta !== 0 ||
      signals.graphEdgesDelta !== 0 ||
      signals.graphNodesDelta !== 0 ||
      signals.servicesDelta !== 0 ||
      changedDomains.length > 0;
    if (!hasAnyDelta) continue;

    const score = eventImpactScore(signals);
    const driver = detectPrimaryDriver(signals);
    const level = impactLevel(score);
    const id = `event:${current.generatedAt}`;
    const whatChanged =
      driver === "gaps"
        ? `Variation des gaps (${signals.gapDelta > 0 ? "+" : ""}${signals.gapDelta})`
        : driver === "couplage"
          ? `Variation du couplage graph edges (${signals.graphEdgesDelta > 0 ? "+" : ""}${signals.graphEdgesDelta})`
          : driver === "sante"
            ? `Variation du score moyen (${signals.avgScoreDelta > 0 ? "+" : ""}${signals.avgScoreDelta})`
            : `Variation des services externes (${signals.servicesDelta > 0 ? "+" : ""}${signals.servicesDelta})`;

    events.push({
      id,
      timestamp: current.generatedAt,
      whatChanged,
      signals,
      impactScore: score,
      impactLevel: level,
      whyLikely: `Driver principal: ${driver}. Deltas agrégés corrélés sur snapshot N vs N-1.`,
      source: {
        currentSnapshotFile: current.file,
        previousSnapshotFile: previous.file,
      },
    });
  }

  return events.sort((a, b) => {
    const impactDelta = Number(b.impactScore || 0) - Number(a.impactScore || 0);
    if (impactDelta !== 0) return impactDelta;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function pointsInWindow(points = [], windowHours, nowTs) {
  if (!points.length) return [];
  const lastTs = Number(nowTs || points[points.length - 1].timestamp);
  const threshold = lastTs - windowHours * HOUR_MS;
  const filtered = points.filter((row) => row.timestamp >= threshold);
  return filtered.length ? filtered : points.slice(-Math.min(points.length, 2));
}

function windowSparkline(points = [], key) {
  return points.map((point) => toNumber(point[key]));
}

export function buildWindowSummary(points = [], events = [], windowHours = 24 * 7, windowKey = "7d") {
  if (!points.length) {
    return {
      windowKey,
      windowHours,
      sampleCount: 0,
      fromGeneratedAt: null,
      toGeneratedAt: null,
      deltas: {},
      impactScore: 0,
      impactLevel: "low",
      sparkline: { avgScore: [], gaps: [], graphEdges: [] },
      notableEvents: [],
      causalRead: "No snapshots in this window.",
    };
  }

  const windowPoints = pointsInWindow(points, windowHours, points[points.length - 1].timestamp);
  const first = windowPoints[0];
  const last = windowPoints[windowPoints.length - 1];
  const deltas = {
    avgScoreDelta: Number((last.avgScore - first.avgScore).toFixed(2)),
    gapDelta: Number((last.gaps - first.gaps).toFixed(2)),
    graphEdgesDelta: Number((last.graphEdges - first.graphEdges).toFixed(2)),
    graphNodesDelta: Number((last.graphNodes - first.graphNodes).toFixed(2)),
    servicesDelta: Number((last.services - first.services).toFixed(2)),
  };
  const inRangeEvents = events
    .filter((event) => {
      const ts = Date.parse(String(event?.timestamp || ""));
      return !Number.isNaN(ts) && ts >= first.timestamp && ts <= last.timestamp;
    })
    .slice(0, 8);
  const score = eventImpactScore({
    ...deltas,
    changedDomains: inRangeEvents.flatMap((event) => event.signals?.changedDomains || []),
  });

  return {
    windowKey,
    windowHours,
    sampleCount: windowPoints.length,
    fromGeneratedAt: first.generatedAt,
    toGeneratedAt: last.generatedAt,
    deltas,
    impactScore: score,
    impactLevel: impactLevel(score),
    sparkline: {
      avgScore: windowSparkline(windowPoints, "avgScore"),
      gaps: windowSparkline(windowPoints, "gaps"),
      graphEdges: windowSparkline(windowPoints, "graphEdges"),
    },
    notableEvents: inRangeEvents.map((event) => event.id),
    causalRead:
      `Fenêtre ${windowKey}: score ${deltas.avgScoreDelta > 0 ? "+" : ""}${deltas.avgScoreDelta},` +
      ` gaps ${deltas.gapDelta > 0 ? "+" : ""}${deltas.gapDelta},` +
      ` graphEdges ${deltas.graphEdgesDelta > 0 ? "+" : ""}${deltas.graphEdgesDelta}.`,
  };
}

function resolveDomainWindowDelta(points = [], domain, windowHours) {
  const domainPoints = points
    .map((point) => ({
      generatedAt: point.generatedAt,
      timestamp: point.timestamp,
      score: toNumber(point.domainScores?.[domain]),
    }));
  const filtered = pointsInWindow(domainPoints, windowHours, domainPoints[domainPoints.length - 1]?.timestamp);
  if (!filtered.length) return 0;
  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  return Number((last.score - first.score).toFixed(2));
}

export function buildDomainWindows(points = [], windows = [{ key: "7d", hours: 24 * 7 }, { key: "30d", hours: 24 * 30 }, { key: "90d", hours: 24 * 90 }]) {
  const lastPoint = points[points.length - 1];
  const domains = Object.keys(lastPoint?.domainScores || {});
  const output = {};

  for (const domain of domains) {
    const windowsByKey = {};
    for (const windowDef of windows) {
      const delta = resolveDomainWindowDelta(points, domain, windowDef.hours);
      windowsByKey[windowDef.key] = {
        scoreDelta: delta,
        trend: delta < 0 ? "down" : delta > 0 ? "up" : "flat",
      };
    }
    output[String(domain).toLowerCase()] = windowsByKey;
  }

  return output;
}

export function buildTrendsCorrelation(history, options = {}) {
  const points = normalizeHistorySnapshots(history);
  const events = buildNotableEvents(points);
  const windows = [
    { key: "7d", hours: 24 * 7 },
    { key: "30d", hours: 24 * 30 },
    { key: "90d", hours: 24 * 90 },
  ];

  const windowSummaries = Object.fromEntries(
    windows.map((windowDef) => [
      windowDef.key,
      buildWindowSummary(points, events, windowDef.hours, windowDef.key),
    ])
  );

  const domainWindows = buildDomainWindows(points, windows);

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    version: 1,
    windows: windowSummaries,
    notableEvents: events.slice(0, 24),
    domainWindows,
    source: {
      totalSnapshots: points.length,
      latestGeneratedAt: points[points.length - 1]?.generatedAt || null,
    },
  };
}

