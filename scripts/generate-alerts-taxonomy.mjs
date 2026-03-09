#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  ALERT_TYPES,
  buildDecisionPriorityMap,
  buildOwnerMap,
  buildRoadmapMap,
  normalizeSeverity,
  sanitizeAction,
  severityRank,
  summarizeTaxonomy
} from './lib/alerts-taxonomy.mjs';

const ROOT = process.cwd();

async function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function writeJson(relativePath, payload) {
  const filePath = path.join(ROOT, relativePath);
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function computeDropSeverity(drop) {
  if (drop >= 25) return 'critical';
  if (drop >= 12) return 'high';
  if (drop >= 6) return 'medium';
  return 'low';
}

function computeCouplingSeverity(importCount) {
  if (importCount >= 6) return 'critical';
  if (importCount >= 3) return 'high';
  return 'medium';
}

function pushAlert(alerts, ownerMap, priorityMap, payload) {
  const domain = String(payload.domain || 'platform').toLowerCase();
  const owner = String(payload.owner || ownerMap.get(domain) || 'atlas-ops');
  const severity = normalizeSeverity(payload.severity);
  const priorityScore = Number(payload.priorityScore ?? priorityMap.get(domain) ?? 0);
  const action = sanitizeAction(payload.action, `Traiter l'alerte ${payload.type} sur ${domain}.`);
  const alert = {
    id: String(payload.id),
    type: String(payload.type),
    domain,
    severity,
    owner,
    state: 'open',
    priorityScore: Number((priorityScore + severityRank(severity) * 6).toFixed(1)),
    projectedImpact: String(payload.projectedImpact || 'impact non quantifie'),
    projectedImpactScore: Number(payload.projectedImpactScore || 0),
    action,
    proofLink: String(payload.proofLink || ''),
    sourceFile: String(payload.sourceFile || ''),
    sourcePath: String(payload.sourcePath || ''),
    explanation: String(payload.explanation || '')
  };
  alerts.push(alert);
}

function buildTaxonomyAlerts({ atlasData, drift, policy, strategy }) {
  const alerts = [];
  const ownerMap = buildOwnerMap(atlasData);
  const roadmapMap = buildRoadmapMap(atlasData);
  const priorityMap = buildDecisionPriorityMap(atlasData);

  for (const [domain, row] of Object.entries(drift?.domains || {})) {
    const findings = Number(row?.totalFindings || 0);
    const crossImports = Number(row?.crossDomainImports || 0);
    const current = Number(row?.healthImpact?.currentScore || 0);
    const projected = Number(row?.healthImpact?.projectedScore || 0);
    const scoreDrop = Math.max(0, current - projected);

    if (findings > 0) {
      pushAlert(alerts, ownerMap, priorityMap, {
        id: `alert:${ALERT_TYPES.DOMAIN_DRIFT}:${domain}`,
        type: ALERT_TYPES.DOMAIN_DRIFT,
        domain,
        severity: row?.riskLevel || 'medium',
        projectedImpact: `Derive active (${findings} constats)`,
        projectedImpactScore: findings,
        action: "Isoler la logique metier, retablir la projection canonique et ajouter les contract tests.",
        proofLink: '/Users/mohyi/atlas/data/architecture-drift.json',
        sourceFile: 'data/architecture-drift.json',
        sourcePath: `/domains/${domain}`,
        explanation: `Derive detectee: projectionBypass=${row?.projectionBypassCount || 0}, unregisteredEvents=${row?.unregisteredEvents || 0}, crossDomainImports=${crossImports}.`
      });
    }

    if (crossImports > 0) {
      pushAlert(alerts, ownerMap, priorityMap, {
        id: `alert:${ALERT_TYPES.COUPLING_REGRESSION}:${domain}`,
        type: ALERT_TYPES.COUPLING_REGRESSION,
        domain,
        severity: computeCouplingSeverity(crossImports),
        projectedImpact: `Couplage cross-domain (${crossImports} imports)`,
        projectedImpactScore: crossImports * 4,
        action: 'Remplacer les imports cross-domain directs par ports/adapters et projections autorisees.',
        proofLink: '/Users/mohyi/atlas/data/architecture-drift.json',
        sourceFile: 'data/architecture-drift.json',
        sourcePath: `/domains/${domain}/crossDomainImports`,
        explanation: `Regression de couplage detectee sur ${crossImports} import(s) cross-domain.`
      });
    }

    if (scoreDrop > 0) {
      pushAlert(alerts, ownerMap, priorityMap, {
        id: `alert:${ALERT_TYPES.PROJECTED_SCORE_DROP}:${domain}`,
        type: ALERT_TYPES.PROJECTED_SCORE_DROP,
        domain,
        severity: computeDropSeverity(scoreDrop),
        projectedImpact: `Chute projetee ${current} -> ${projected}`,
        projectedImpactScore: scoreDrop,
        action: 'Appliquer un plan de stabilisation court terme avant nouvelle extraction.',
        proofLink: '/Users/mohyi/atlas/data/architecture-drift.json',
        sourceFile: 'data/architecture-drift.json',
        sourcePath: `/domains/${domain}/healthImpact`,
        explanation: `La projection de score indique une chute de ${scoreDrop} points.`
      });
    }
  }

  const policyChecks = Array.isArray(policy?.checks) ? policy.checks : [];
  for (let index = 0; index < policyChecks.length; index += 1) {
    const check = policyChecks[index];
    const status = String(check?.status || '').toLowerCase();
    if (status === 'pass') continue;

    pushAlert(alerts, ownerMap, priorityMap, {
      id: `alert:${ALERT_TYPES.POLICY_WARNING}:${check.domain}:${check.policyId}:${index}`,
      type: ALERT_TYPES.POLICY_WARNING,
      domain: check.domain,
      severity: check.severity || 'high',
      projectedImpact: `Violation policy ${check.policyId}`,
      projectedImpactScore: status === 'fail' ? 30 : 18,
      action: check.recommendedFix,
      proofLink: '/Users/mohyi/atlas/data/architecture-policy-report.json',
      sourceFile: 'data/architecture-policy-report.json',
      sourcePath: `/checks/${index}`,
      explanation: check.whyItMatters || `Violation policy ${check.policyId}`
    });
  }

  for (let index = 0; index < (atlasData?.gaps || []).length; index += 1) {
    const gap = atlasData.gaps[index];
    const severity = normalizeSeverity(gap.severity);
    if (severityRank(severity) < severityRank('high')) continue;

    pushAlert(alerts, ownerMap, priorityMap, {
      id: `alert:${ALERT_TYPES.HIGH_GAP_UNRESOLVED}:${gap.domain}:${gap.type}:${index}`,
      type: ALERT_TYPES.HIGH_GAP_UNRESOLVED,
      domain: gap.domain,
      severity,
      projectedImpact: `Gap ${gap.type} non traite`,
      projectedImpactScore: severity === 'critical' ? 35 : 20,
      action: 'Traiter le gap structurel (domain/application/ports/adapters) avant tout ajout de feature.',
      proofLink: '/Users/mohyi/atlas/data/atlas-data.json',
      sourceFile: 'data/atlas-data.json',
      sourcePath: `/gaps/${index}`,
      explanation: String(gap.message || '').trim()
    });
  }

  for (let index = 0; index < (atlasData?.freshnessContract?.alerts || []).length; index += 1) {
    const stale = atlasData.freshnessContract.alerts[index];
    pushAlert(alerts, ownerMap, priorityMap, {
      id: `alert:${ALERT_TYPES.SNAPSHOT_STALE}:${stale.dataset}:${index}`,
      type: ALERT_TYPES.SNAPSHOT_STALE,
      domain: stale.domain || 'platform',
      severity: stale.severity || 'critical',
      projectedImpact: `Snapshot stale (${stale.ageHours}h)`,
      projectedImpactScore: Number(stale.ageHours || 0),
      action: stale.action,
      proofLink: '/Users/mohyi/atlas/data/atlas-data.json',
      sourceFile: 'data/atlas-data.json',
      sourcePath: `/freshnessContract/alerts/${index}`,
      explanation: stale.explanation || 'Snapshot stale detecte'
    });
  }

  for (let index = 0; index < (strategy?.domains || []).length; index += 1) {
    const row = strategy.domains[index];
    const domain = String(row?.domain || '').toLowerCase();
    if (!domain) continue;

    const roadmap = roadmapMap.get(domain);
    const requiresExecution = String(row?.strategy || '').toLowerCase() === 'extract-service' || String(row?.priority || '').toLowerCase() === 'high';
    const hasTicket = roadmap && String(roadmap.ticket || '').trim() && String(roadmap.ticket || '').toUpperCase() !== 'TBD';
    const roadmapReady = roadmap && ['ready', 'done', 'in-progress'].includes(String(roadmap.status || '').toLowerCase());

    if (requiresExecution && (!roadmap || !hasTicket || !roadmapReady)) {
      pushAlert(alerts, ownerMap, priorityMap, {
        id: `alert:${ALERT_TYPES.STRATEGY_ROADMAP_DIVERGENCE}:${domain}:${index}`,
        type: ALERT_TYPES.STRATEGY_ROADMAP_DIVERGENCE,
        domain,
        severity: 'high',
        projectedImpact: 'Divergence strategie vs roadmap',
        projectedImpactScore: Number(row?.strategicImportanceScore || 0),
        action: 'Aligner roadmap avec ticket executable/owner/DoD avant execution.',
        proofLink: '/Users/mohyi/atlas/data/architecture-strategy-report.json',
        sourceFile: 'data/architecture-strategy-report.json',
        sourcePath: `/domains/${index}`,
        explanation: `Strategie=${row?.strategy}, priority=${row?.priority}, roadmapTicket=${roadmap?.ticket || 'missing'}, roadmapStatus=${roadmap?.status || 'missing'}.`
      });
    }
  }

  alerts.sort((a, b) => {
    const priorityDelta = Number(b.priorityScore || 0) - Number(a.priorityScore || 0);
    if (priorityDelta !== 0) return priorityDelta;
    return severityRank(b.severity) - severityRank(a.severity);
  });

  return alerts.map((alert, index) => ({
    ...alert,
    rank: index + 1
  }));
}

async function main() {
  const [atlasData, drift, policy, strategy] = await Promise.all([
    readJson('data/atlas-data.json'),
    readJson('data/architecture-drift.json'),
    readJson('data/architecture-policy-report.json'),
    readJson('data/architecture-strategy-report.json')
  ]);

  const generatedAt = new Date().toISOString();
  const alerts = buildTaxonomyAlerts({ atlasData, drift, policy, strategy });
  const summary = summarizeTaxonomy(alerts);
  const typeDefinitions = {
    [ALERT_TYPES.DOMAIN_DRIFT]: 'Derive domaine detectee dans le scan d architecture.',
    [ALERT_TYPES.POLICY_WARNING]: 'Violation ou warning de policy de gouvernance.',
    [ALERT_TYPES.COUPLING_REGRESSION]: 'Augmentation du couplage cross-domain non conforme.',
    [ALERT_TYPES.PROJECTED_SCORE_DROP]: 'Baisse projetee du score de sante domaine.',
    [ALERT_TYPES.SNAPSHOT_STALE]: 'Snapshot data stale au-dela du SLA freshness.',
    [ALERT_TYPES.HIGH_GAP_UNRESOLVED]: 'Gap high/critical non traite.',
    [ALERT_TYPES.STRATEGY_ROADMAP_DIVERGENCE]: 'Incoherence entre priorite strategique et execution roadmap.'
  };

  atlasData.alertsTaxonomy = {
    generatedAt,
    version: 'v1',
    typeDefinitions,
    summary,
    alerts
  };

  drift.operationalAlerts = alerts.filter((alert) =>
    [
      ALERT_TYPES.DOMAIN_DRIFT,
      ALERT_TYPES.COUPLING_REGRESSION,
      ALERT_TYPES.PROJECTED_SCORE_DROP,
      ALERT_TYPES.SNAPSHOT_STALE,
      ALERT_TYPES.HIGH_GAP_UNRESOLVED
    ].includes(alert.type)
  );
  drift.operationalAlertsSummary = summarizeTaxonomy(drift.operationalAlerts);

  policy.operationalAlerts = alerts.filter((alert) => alert.type === ALERT_TYPES.POLICY_WARNING);
  policy.operationalAlertsSummary = summarizeTaxonomy(policy.operationalAlerts);

  strategy.operationalAlerts = alerts.filter((alert) => alert.type === ALERT_TYPES.STRATEGY_ROADMAP_DIVERGENCE);
  strategy.operationalAlertsSummary = summarizeTaxonomy(strategy.operationalAlerts);

  await Promise.all([
    writeJson('data/atlas-data.json', atlasData),
    writeJson('data/architecture-drift.json', drift),
    writeJson('data/architecture-policy-report.json', policy),
    writeJson('data/architecture-strategy-report.json', strategy)
  ]);

  console.log(`Alerts taxonomy generated (total=${summary.total}, critical=${summary.bySeverity.critical}, high=${summary.bySeverity.high}).`);
}

main().catch((error) => {
  console.error('Failed to generate alerts taxonomy:', error?.message || error);
  process.exit(1);
});
