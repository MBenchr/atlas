# Atlas Expert Audit

Date:
- `2026-03-10`

Scope:
- unify Atlas operator entrypoint
- verify canonical metrics against generated artifacts
- identify false positives, false negatives, and blind spots
- define an expert-level remediation program

Doctrine:
- `Core decides. Projections explain. Apps render.`

## What Already Existed

- Atlas V3 cockpit surfaces in `/Users/mohyi/atlas/app.js`
- canonical generation chain in `/Users/mohyi/mcp` via `atlas:generate`
- local quality gates in `/Users/mohyi/atlas/package.json`
- fusion shell in `/Users/mohyi/atlas/scripts/fusion-atlas-serve.mjs`

## What Was Missing

- a true single operator entrypoint; the shell still exposed modern and legacy as two destinations
- canonical `decisionKpis` in service-ops output
- stable service keys in `atlas-data.externalServices` to correlate Atlas scan output with service-ops runtime data
- full refresh chaining from `mcp generate` to Atlas local enrichments

## What Was Fixed In This Batch

1. Canonical `decisionKpis` were restored in `/Users/mohyi/mcp/scripts/architecture-service-ops-live.mjs`.
2. Stable `key` / `providerKey` were added to `externalServices` in `/Users/mohyi/mcp/scripts/atlas-scan.mjs`.
3. The fusion shell was reworked into a single Atlas entrypoint with integrated modes (`Cockpit`, `Comparer`, `Legacy lens`) in `/Users/mohyi/atlas/scripts/fusion-atlas-serve.mjs`.
4. Refresh chaining now runs:
   - `mcp atlas:generate`
   - site/data sync to Atlas
   - `generate:freshness`
   - `generate:priority`
   - `generate:alerts`
   - `generate:trends`
   - `generate:audit`

## Findings

### P1 - Refresh used to leave Atlas in a partially regenerated state

Evidence:
- the previous fusion shell only ran `atlas:generate` and copied data
- it did not rerun Atlas local enrichments
- this produced stale or missing `freshnessContract`, `decisionPriority`, `alertsTaxonomy`, and audit projections after sync

Status:
- fixed in this batch

### P1 - Decision KPI contract had drifted out of the canonical source

Evidence:
- `architecture-service-ops-live-report.json` no longer exposed `decisionKpis`
- Atlas UI silently fell back to local defaults
- `npm run check` failed on smoke because the contract was missing

Status:
- fixed in this batch

### P1 - External service scan output could not be joined to service-ops runtime status

Evidence:
- `atlas-data.externalServices` had no stable provider key
- service-ops report uses normalized connector keys
- this prevented reliable correlation between “referenced in code” and “operationally monitored”

Status:
- fixed in this batch

### P2 - Projection discipline is under-discriminating

Evidence:
- all 10 domains currently score `100` on projection discipline
- the score is derived mainly from:
  - projection presence
  - absence of consumer drift signals
- this does not prove projection quality, consumer contract depth, or projection freshness

Risk:
- Atlas can overstate architecture health and miss weak but real projection problems

Recommended action:
- add penalties for:
  - projection without contract tests
  - projection without multi-consumer compatibility declaration
  - projection inferred only from weak textual evidence

### P2 - Service-ops health has poor signal-to-noise

Observed:
- `27` services
- `7` healthy
- `20` degraded
- `0` down

Risk:
- “degraded” currently mixes:
  - unconfigured connector
  - missing env bindings
  - auth absence
  - runtime/API degradation
- operators cannot quickly distinguish “real incident” from “not configured here”

Recommended action:
- split status semantics into:
  - `healthy`
  - `warning`
  - `unconfigured`
  - `degraded`
  - `down`

### P2 - Provider normalization is still too raw

Evidence:
- scan output includes raw providers like `Apple`, `APNS`, `Gmail`, `Google`, `FCM`, `WebPush`
- service-ops normalizes some of these to operator surfaces (`app-store-connect`, `google-workspace`, `firebase`)

Risk:
- duplicated or fragmented provider reporting
- inflated external-risk counts

Recommended action:
- normalize scan-side provider taxonomy to the same operator model as service-ops

### P2 - Linear governance drift exists upstream

Evidence:
- generated drift report currently flags `MBE-1214`
- reason: executable issue missing V3 taxonomy labels

Risk:
- active execution board quality degrades
- Atlas governance dashboards can present “healthy” repo metrics while Linear control plane is inconsistent

Recommended action:
- normalize ticket labels before keeping the issue in execution flow

## Urgent Metrics To Watch

1. `decisionKpis` contract presence in `architecture-service-ops-live-report.json`
2. `freshnessContract.globalStatus` and `staleDatasetCount`
3. `alertsTaxonomy.summary.bySeverity`
4. `serviceOps.summary.degraded/down`
5. ratio of `externalServices` detected vs services actually monitored
6. count of uniform scores across domains (`projectionDiscipline`, `validationMaturity`, etc.) as a blind-spot indicator

## Current Validation Proof

Executed:
- `npm --prefix /Users/mohyi/mcp run atlas:generate`
- Atlas post-sync generators
- `npm run check`

Result:
- `PASS`

## Suggested Remediation Program

Suggested project name:
- `Atlas Expert Hardening`

Suggested execution items:

1. `Atlas: normalize provider taxonomy between scan and service-ops`
2. `Atlas: split service-ops status into configured vs degraded runtime`
3. `Atlas: strengthen projection-discipline scoring with proof-weighted penalties`
4. `Atlas: add correlation coverage metric scan services vs monitored services`
5. `Atlas: add regression tests for fusion shell integrated modes`
6. `Atlas: remove remaining operator-facing mentions of /modern and /legacy routes`
7. `Atlas: surface configuration-vs-incident distinction in topbar urgency`
8. `Atlas: enforce V3 taxonomy completeness for Atlas-adjacent execution issues`

## Linear Status

Current limitation at audit time:
- Linear MCP was not yet applied in the Codex session when the audit started

Status after follow-up configuration:
- Linear MCP is now declared in Codex config and aligned on bearer-token configuration via `LINEAR_API_KEY`
- remaining step: restart Codex Desktop so the refreshed environment is picked up consistently by new sessions
