#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  computeAlertDecisionPriority,
  computeDomainDecisionPriority,
  sortByDecisionPriority
} from './lib/decision-priority-score.mjs';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(relativePath, value) {
  const filePath = path.join(ROOT, relativePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function mapSeverityFromSignals({ driftRow, gapSeverity, policySeverity, strategySeverity = 'none', overrideSeverity = '' }) {
  const rank = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

  const candidates = [
    String(driftRow?.riskLevel || 'none').toLowerCase(),
    String(gapSeverity || 'none').toLowerCase(),
    String(policySeverity || 'none').toLowerCase(),
    String(strategySeverity || 'none').toLowerCase()
  ];
  if (overrideSeverity) candidates.push(String(overrideSeverity).toLowerCase());

  return candidates.reduce((best, current) => (rank[current] > rank[best] ? current : best), 'none');
}

function normalizeSeverityToken(value) {
  const token = String(value || '').trim().toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'none'].includes(token)) return token;
  return '';
}

function normalizePriorityToken(value) {
  const token = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(token)) return token;
  return '';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function buildPilotConfig(atlasData) {
  const rollout = atlasData?.pilotRollout;
  const tuning = rollout?.decisionPriorityTuning || {};

  const strategyPrioritySeverityMap = {
    high: normalizeSeverityToken(tuning?.strategyPrioritySeverityMap?.high) || 'medium',
    medium: normalizeSeverityToken(tuning?.strategyPrioritySeverityMap?.medium) || 'low',
    low: normalizeSeverityToken(tuning?.strategyPrioritySeverityMap?.low) || 'none'
  };

  const domainOverrides = new Map();
  for (const row of rollout?.domainOverrides || []) {
    const key = toKey(row?.domain);
    if (!key) continue;
    domainOverrides.set(key, {
      severity: normalizeSeverityToken(row?.severity),
      strategicPriority: normalizePriorityToken(row?.strategicPriority),
      strategicImportance: Number.isFinite(Number(row?.strategicImportance)) ? Number(row.strategicImportance) : null,
      priorityBoost: Number.isFinite(Number(row?.priorityBoost)) ? Number(row.priorityBoost) : 0
    });
  }

  return {
    strategyPrioritySeverityMap,
    domainOverrides
  };
}

function applyPriorityBoost(entry, boost) {
  const numericBoost = Number(boost || 0);
  if (!numericBoost) return entry;

  const nextScore = Number(clamp(Number(entry?.score || 0) + numericBoost, 0, 100).toFixed(1));
  return {
    ...entry,
    score: nextScore,
    tuning: {
      ...(entry?.tuning || {}),
      priorityBoost: Number(numericBoost.toFixed(2))
    },
    signals: {
      ...(entry?.signals || {}),
      priorityBoost: Number(numericBoost.toFixed(2))
    }
  };
}

function buildTrendDeltaMap(history) {
  const snapshots = Array.isArray(history?.snapshots) ? history.snapshots : [];
  if (snapshots.length < 2) return new Map();

  const first = snapshots[0]?.summary?.domainScores || {};
  const last = snapshots[snapshots.length - 1]?.summary?.domainScores || {};
  const allDomains = [...new Set([...Object.keys(first), ...Object.keys(last)])];

  return new Map(
    allDomains.map((domain) => [
      String(domain).toLowerCase(),
      Number((Number(last[domain] || 0) - Number(first[domain] || 0)).toFixed(2))
    ])
  );
}

function ageHours(isoDate) {
  const ts = Date.parse(String(isoDate || ''));
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
}

function severityRank(severity) {
  return { critical: 4, high: 3, medium: 2, low: 1, none: 0 }[String(severity || 'none').toLowerCase()] || 0;
}

function toKey(value) {
  return String(value || '').toLowerCase();
}

function buildBaseAlerts({ drift, atlasData, policy }) {
  const alerts = [];

  for (const [domain, row] of Object.entries(drift?.domains || {})) {
    const findings = Number(row?.totalFindings || 0);
    if (findings <= 0) continue;
    alerts.push({
      id: `drift:${domain}`,
      domain,
      severity: row?.riskLevel || 'medium',
      type: 'drift',
      explanation: `Drift findings=${findings}`,
      actionabilityBoost: 0.6
    });
  }

  for (const gap of atlasData?.gaps || []) {
    alerts.push({
      id: `gap:${gap.domain}:${gap.type}`,
      domain: gap.domain,
      severity: gap.severity || 'medium',
      type: 'gap',
      explanation: gap.message,
      actionabilityBoost: 0.4
    });
  }

  for (const violation of policy?.violations || []) {
    alerts.push({
      id: `policy:${violation.domain}:${violation.policyId}`,
      domain: violation.domain,
      severity: violation.severity || 'medium',
      type: 'policy',
      explanation: violation.whyItMatters,
      actionabilityBoost: 0.5
    });
  }

  return alerts;
}

async function main() {
  const [atlasData, drift, strategy, history, policy] = await Promise.all([
    readJson('data/atlas-data.json'),
    readJson('data/architecture-drift.json'),
    readJson('data/architecture-strategy-report.json'),
    readJson('data/atlas-history.json'),
    readJson('data/architecture-policy-report.json')
  ]);

  const profileByDomain = new Map(
    (atlasData.domainProfiles || []).map((profile) => [toKey(profile.domain), profile])
  );

  const gapByDomain = new Map();
  for (const gap of atlasData.gaps || []) {
    const key = toKey(gap.domain);
    const item = gapByDomain.get(key) || { count: 0, severity: 'none' };
    item.count += 1;
    if (severityRank(gap.severity) > severityRank(item.severity)) item.severity = gap.severity;
    gapByDomain.set(key, item);
  }

  const policyByDomain = new Map();
  for (const violation of policy.violations || []) {
    const key = toKey(violation.domain);
    const item = policyByDomain.get(key) || { count: 0, severity: 'none' };
    item.count += 1;
    if (severityRank(violation.severity) > severityRank(item.severity)) item.severity = violation.severity;
    policyByDomain.set(key, item);
  }

  const strategyByDomain = new Map(
    (strategy.domains || []).map((row) => [toKey(row.domain), row])
  );

  const trendDeltaByDomain = buildTrendDeltaMap(history);
  const freshnessHours = ageHours(atlasData.generatedAt);
  const pilotConfig = buildPilotConfig(atlasData);

  const domains = (atlasData.domainProfiles || []).map((profile) => {
    const key = toKey(profile.domain);
    const driftRow = drift?.domains?.[key] || {};
    const strategyRow = strategyByDomain.get(key) || {};
    const gap = gapByDomain.get(key) || { count: 0, severity: 'none' };
    const policyRow = policyByDomain.get(key) || { count: 0, severity: 'none' };
    const domainOverride = pilotConfig.domainOverrides.get(key) || {};
    const strategyPriority = String(domainOverride.strategicPriority || strategyRow?.priority || 'low').toLowerCase();

    const currentScore = Number(profile?.overallScore || 0);
    const projectedScore = Number(driftRow?.healthImpact?.projectedScore ?? currentScore);
    const projectedDrop = Math.max(0, currentScore - projectedScore);
    const trendDelta = Number(trendDeltaByDomain.get(key) || 0);

    const computed = computeDomainDecisionPriority({
      domain: key,
      severity: mapSeverityFromSignals({
        driftRow,
        gapSeverity: gap.severity,
        policySeverity: policyRow.severity,
        strategySeverity: pilotConfig.strategyPrioritySeverityMap?.[strategyPriority] || 'none',
        overrideSeverity: domainOverride.severity
      }),
      strategicImportance: Number(domainOverride.strategicImportance ?? strategyRow?.strategicImportanceScore ?? 50),
      businessCriticality: strategyRow?.metrics?.businessCriticality || 'unknown',
      projectedDrop,
      trendDown: Math.max(0, -trendDelta),
      driftFindings: Number(driftRow?.totalFindings || 0),
      consumers: Number((profile?.consumers || []).length),
      crossDomainImports: Number(driftRow?.crossDomainImports || 0),
      coordinationCost: Number(strategyRow?.metrics?.coordinationCost || 0),
      hasCanonicalProjection: profile?.badges?.projectionCanonical === 'pass',
      hasOwner: Boolean((profile?.consumers || []).length),
      recommendedActionsCount: Number((strategyRow?.recommendedActions || []).length),
      gapCount: Number(gap.count || 0),
      policyViolationCount: Number(policyRow.count || 0),
      currentScore,
      projectedScore,
      freshnessHours,
      strategicPriority: strategyPriority
    });

    return applyPriorityBoost(computed, domainOverride.priorityBoost);
  });

  const rankedDomains = sortByDecisionPriority(domains).map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));

  const domainByName = new Map(rankedDomains.map((entry) => [toKey(entry.domain), entry]));
  const baseAlerts = buildBaseAlerts({ drift, atlasData, policy });

  const rankedAlerts = baseAlerts
    .map((alert) => {
      const domainPriority = domainByName.get(toKey(alert.domain));
      const scored = computeAlertDecisionPriority({
        alertId: alert.id,
        domain: alert.domain,
        severity: alert.severity,
        domainPriority,
        actionabilityBoost: alert.actionabilityBoost
      });
      return {
        ...alert,
        score: scored.score,
        raw: scored.raw,
        factors: scored.factors,
        domainRank: domainPriority?.rank || null
      };
    })
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const decisionPriorityPayload = {
    generatedAt: new Date().toISOString(),
    formula: 'severity * impact * degradation * blast_radius * actionability',
    normalization: 'log-scale to 0..100',
    tieBreaks: ['freshness', 'strategic priority', 'strategic importance'],
    domains: rankedDomains,
    alerts: rankedAlerts
  };

  atlasData.decisionPriority = decisionPriorityPayload;
  drift.decisionPriority = {
    generatedAt: decisionPriorityPayload.generatedAt,
    domains: rankedDomains.map((entry) => ({
      domain: entry.domain,
      rank: entry.rank,
      score: entry.score,
      factors: entry.factors,
      signals: entry.signals,
      tieBreak: entry.tieBreak
    }))
  };

  await Promise.all([
    writeJson('data/atlas-data.json', atlasData),
    writeJson('data/architecture-drift.json', drift)
  ]);

  const top = rankedDomains.slice(0, 5).map((row) => `${row.rank}. ${row.domain} (${row.score})`);
  console.log('Decision priority generated. Top domains:');
  for (const line of top) console.log(`- ${line}`);
}

main().catch((error) => {
  console.error('Failed to generate decision priority:', error?.message || error);
  process.exit(1);
});
