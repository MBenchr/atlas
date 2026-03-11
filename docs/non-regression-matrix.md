# Atlas Non-Regression Matrix

Ticket:
- `MBE-1094`

Goal:
- enforce an execution gate for every Atlas cockpit refactor
- block merges when decision surfaces, contracts, or data freshness regress

Doctrine:
- `Core decides. Projections explain. Apps render.`

## Quality gates (blocking)

| Gate | Command | Coverage | Blocking condition |
|---|---|---|---|
| Lint | `npm run lint` | governance files, contract manifest presence, JSON readability, canonical non-recompute markers | missing governance/contract files, invalid JSON, or regression on explicit non-canonical fallback markers |
| Typecheck | `npm run typecheck` | JS/MJS syntax on `app.js`, `scripts/`, `tests/` | syntax error |
| Unit | `npm run test:unit` | decision-priority scoring formula, severity ordering, tie-break stability | score ordering/tie-break regression |
| Contracts | `npm run test:contracts` | projection registry coverage, consumer authorization, compatibility policy, service-ops projection contract | missing/invalid contract declaration |
| E2E ciblées | `npm run test:e2e` | decision navigation + scenario flows (alerts/domain/portfolio/evidence), drill-down/detail panel, CTA presence, cockpit shell markers | missing decision-flow behavior markers |
| Smoke | `npm run test:smoke` | data freshness, minimal dataset integrity, critical UI markers | stale/broken data or missing critical UI anchors |

## Local execution

```bash
cd /Users/mohyi/atlas
npm run check
```

## CI execution

Workflow:
- `/Users/mohyi/atlas/.github/workflows/quality-gates.yml`

CI command:

```bash
cd /Users/mohyi/atlas
npm run ci:quality
```

## Decision-flow checks (required)

Required checks covered by tests:
- navigation principale (`home`, `alerts`, `portfolio`, `evidence`, `domains`, `history`)
- rendu portefeuille dédié (`renderPortfolioView`)
- rendu espace preuves dédié (`renderEvidenceAudit`)
- rendu instrumentation KPI décision (`renderDecisionKpiDashboard`)
- enquête secondaire contextuelle (`renderGraph`/`renderRadar` + `data-open-graph-context`)
- drill-down panel wiring (`showDetailPanel`, `data-detail-text`)
- CTA decision marker (`Action recommandée`)
- shell/app mount integrity (`id="app"`, refresh control)
- rollout/rollback flags:
  - `ff_cockpit_v3=0` force legacy bridge views only
  - `ff_evidence=0` disable evidence deep-link routing without UI breakage
  - `ff_investigation=0` disable graph/radar context routing with safe fallback
  - `ff_decision_kpi=0` hide decision KPI dashboard
- scenario suite:
  - `tests/e2e/cockpit.spec.test.mjs`
  - `tests/e2e/alerts.spec.test.mjs`
  - `tests/e2e/domain.spec.test.mjs`
  - `tests/e2e/portfolio.spec.test.mjs`
  - `tests/e2e/refresh-integrated-shell.spec.test.mjs`
- visual regression signatures:
  - baseline `tests/visual/baselines/view-signatures.json`
  - checker `tests/e2e/visual-regression.spec.test.mjs`
  - covered surfaces: integrated shell + overview + alerts + domains + portfolio + evidence + projections

## Perceived performance budget (render TTI)

E2E suite enforces local render budgets (p95, fixture runtime):
- `overview`: `<= 35ms`
- `alerts`: `<= 35ms`
- `domains`: `<= 35ms`
- `portfolio`: `<= 45ms`
- `evidence`: `<= 45ms`

## Data freshness and KPI guardrail

Smoke gate enforces:
- freshness for governed datasets from `data/contracts/manifest.json`
- freshness threshold configurable with `ATLAS_MAX_DATA_AGE_HOURS` (default `48`)
- presence and integrity of `atlas-data.freshnessContract` (`globalStatus`, per-dataset rows, stale counters)
- presence and integrity of `atlas-data.alertsTaxonomy` (owner/action/proof fields mandatory)
- presence and integrity of `atlas-history.trendsCorrelation` (windows `7d/30d/90d`, notable events, domain windows)
- presence and integrity of `data/history/atlas-audit-index.json` (artifact list + snapshot coverage)
- presence and integrity of `data/architecture-service-ops-live-report.json.decisionKpis` (targets + before/after baselines)
- semantic integrity of `data/architecture-service-ops-live-report.json.summary` and `serviceCoverage`
  - service state counts must add up to `totalServices`
  - `matchedCount <= detectedCount`
  - `platformMonitoredOnlyCount + unexpectedMonitoredWithoutDetectionCount = monitoredWithoutDetectionCount`
  - summary counters must stay aligned with `serviceCoverage`
- non-empty `domainProfiles`, `projectionRegistry`, `roadmap`

Recommended generation sequence before quality run:

```bash
cd /Users/mohyi/atlas
npm run generate:freshness
npm run generate:priority
npm run generate:alerts
npm run generate:trends
npm run generate:audit
npm run generate:visual-baseline
npm run check
```

## DoD checklist (attach to each Atlas issue)

- [ ] canonical source confirmed
- [ ] canonical write-path confirmed
- [ ] canonical projection(s) declared
- [ ] authorized consumers declared
- [ ] no local business recomputation introduced
- [ ] `npm run check` pass evidence attached
- [ ] contract impact version tagged (`patch|minor|major`) when relevant
