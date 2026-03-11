# Atlas Lessons

Purpose:
- keep anti-regression memory local to Atlas
- record concrete failures, root cause, and permanent guardrails
- prevent repeated architecture drift and execution mistakes

Usage rules:
- append-only (do not rewrite history)
- each lesson must include proof artifact(s)
- each lesson must define the guardrail (test/check/process) that prevents recurrence

## Entry template

Date:
Issue:
Context:
Failure mode:
Root cause:
Guardrail added:
Proof:
Follow-up:

---

## 2026-03-09 - Governance bootstrap

Date:
2026-03-09

Issue:
`MBE-1091`

Context:
Atlas had code/data surfaces but no repo-local governance scaffold (`AGENTS.md`, local decision stack, local execution board, lessons memory).

Failure mode:
Execution could drift toward ad-hoc ticket picking and UI-local business fallback decisions.

Root cause:
Missing local operating contract in the repository.

Guardrail added:
- repo-local `AGENTS.md` with V3 doctrine and Linear routing
- `docs/atlas-decision-stack.md`
- `docs/atlas-execution-board.md`
- this `tasks/lessons.md` anti-regression log

Proof:
- files created in repo root and `docs/` + `tasks/`

Follow-up:
- execute `MBE-1092`, `MBE-1093`, `MBE-1094` before major UI refactors

---

## 2026-03-09 - Data contracts baseline

Date:
2026-03-09

Issue:
`MBE-1092`

Context:
Atlas datasets were consumed directly without versioned schema contracts or local compatibility validation.

Failure mode:
Silent shape drift could break cockpit rendering and decision flows without early detection.

Root cause:
No explicit contract manifest and no local gate to validate generated JSON artifacts.

Guardrail added:
- `data/contracts/manifest.json` as dataset contract source of truth
- `data/contracts/schemas/v1/*.schema.json` for 6 Atlas datasets
- `scripts/validate-atlas-contracts.mjs` local contract gate
- `docs/atlas-data-contracts.md` compatibility and versioning policy

Proof:
- `node /Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs` passes on current snapshots

Follow-up:
- align projection registry and consumer matrix in `MBE-1093`
- plug contract validation into quality gates in `MBE-1094`

---

## 2026-03-09 - Projection registry and consumer matrix

Date:
2026-03-09

Issue:
`MBE-1093`

Context:
Atlas consumed canonical projections but had no local contract artifact proving declared consumers and compatibility posture.

Failure mode:
Critical reads could drift from canonical registry/matrix without failing early.

Root cause:
No repo-local projection registry + no contract tests for multi-consumer surfaces.

Guardrail added:
- `docs/projection-registry.md`
- `docs/consumer-contract-matrix.md`
- `tests/contracts/atlas-projection-contracts.json`
- `tests/contracts/projection-registry.contract.test.mjs`
- `tests/contracts/consumer-contract-matrix.contract.test.mjs`

Proof:
- `node --test /Users/mohyi/atlas/tests/contracts/*.test.mjs` passes

Follow-up:
- integrate these tests in quality gates (`MBE-1094`)

---

## 2026-03-09 - Non-regression quality gates baseline

Date:
2026-03-09

Issue:
`MBE-1094`

Context:
Atlas had no single executable quality pipeline combining lint/typecheck/contracts/smoke/e2e-targeted checks.

Failure mode:
Regressions could be merged without deterministic local proof, especially on decision UI flows and contract surfaces.

Root cause:
No repo-local quality gate scripts and no CI workflow aligned with local execution order.

Guardrail added:
- `package.json` quality scripts (`lint`, `typecheck`, `test:contracts`, `test:smoke`, `test:e2e`, `check`)
- `scripts/lint-atlas.mjs`
- `scripts/typecheck-atlas.mjs`
- `scripts/smoke-atlas.mjs`
- `tests/e2e/*.test.mjs`
- `docs/non-regression-matrix.md`
- `.github/workflows/atlas-quality.yml`

Proof:
- `npm run check` passes locally

Follow-up:
- extend E2E from marker checks to browser-flow checks when Playwright baseline is introduced

---

## 2026-03-09 - Decision Priority Score baseline

Date:
2026-03-09

Issue:
`MBE-1095`

Context:
Atlas had multiple local prioritization heuristics in UI flows, but no canonical model to rank domain execution urgency and architecture alerts consistently.

Failure mode:
Teams could prioritize different domains for the same dataset depending on which cockpit view was used.

Root cause:
No shared scoring formula and no generated decision-priority projection consumed by all decision surfaces.

Guardrail added:
- `scripts/lib/decision-priority-score.mjs` canonical scoring library
- `scripts/generate-decision-priority.mjs` generator updating governed datasets
- `tests/unit/decision-priority-score.test.mjs` anti-regression unit tests
- `docs/decision-priority-score.md` formula and operational guide
- `app.js` wiring for overview/domain-matrix/focus/alerts priority rendering

Proof:
- `node /Users/mohyi/atlas/scripts/generate-decision-priority.mjs`
- `node --test /Users/mohyi/atlas/tests/unit/decision-priority-score.test.mjs`

Follow-up:
- consume score rank in roadmap/execution wave recommendations if ticket sequencing is automated

---

## 2026-03-09 - Freshness contract and stale guardrail baseline

Date:
2026-03-09

Issue:
`MBE-1097`

Context:
Freshness checks existed in smoke gates but were not exposed as a canonical decision contract and not surfaced in cockpit top-bar/alerts as first-class action signals.

Failure mode:
Teams could pass quality checks yet miss stale-data urgency during cockpit operation because freshness status was not explicit in the decision UI.

Root cause:
No canonical freshness SLA projection (`normal/degraded/stale`) consumed by UI and alerts flow.

Guardrail added:
- `scripts/lib/data-freshness.mjs` canonical freshness scoring
- `scripts/generate-freshness-contract.mjs` contract generation in governed datasets
- `docs/data-freshness-sla.md` SLA policy and operating guide
- `tests/unit/data-freshness.test.mjs` non-regression freshness tests
- `app.js` top-bar freshness badge + stale freshness alert injection
- `scripts/smoke-atlas.mjs` freshness contract validation

Proof:
- `node /Users/mohyi/atlas/scripts/generate-freshness-contract.mjs`
- `node --test /Users/mohyi/atlas/tests/unit/data-freshness.test.mjs`
- `npm run check`

Follow-up:
- include freshness status and stale count in roadmap prioritization hints for wave sequencing

---

## 2026-03-09 - Operational alerts taxonomy baseline

Date:
2026-03-09

Issue:
`MBE-1096`

Context:
Alert generation mixed heterogeneous heuristics and produced rows without stable type/owner/proof fields, making triage and remediation inconsistent across views.

Failure mode:
Operational alerts could be displayed without explicit owner, projected impact, or proof path, which slowed execution and caused triage ambiguity.

Root cause:
No canonical alerts taxonomy projection and no contract-level guardrail preventing mute alerts.

Guardrail added:
- `scripts/lib/alerts-taxonomy.mjs` type/severity normalization helpers
- `scripts/generate-alerts-taxonomy.mjs` canonical taxonomy generator
- `docs/alerts-taxonomy.md` taxonomy contract and required fields
- `tests/unit/alerts-taxonomy.test.mjs` normalization/summary unit tests
- `app.js` alert center filters by `severity/domain/owner` and taxonomy-first rendering
- `scripts/smoke-atlas.mjs` guardrail for owner/action/proof completeness

Proof:
- `node /Users/mohyi/atlas/scripts/generate-alerts-taxonomy.mjs`
- `npm run check`

Follow-up:
- map alert `state` to execution workflow (`open/in-progress/done`) when ticket linkage is automated

---

## 2026-03-09 - Cockpit P0 decision-first home baseline

Date:
2026-03-09

Issue:
`MBE-1099`

Context:
Overview surfaces existed but decision-critical signals were still scattered across multiple sections before exposing the first actionable subject.

Failure mode:
Operators could lose time identifying the #1 topic because owner/action/proof were not grouped in a first-read cockpit block.

Root cause:
No dedicated P0 section combining ranked action queue + top-bar operational context + explicit change recap.

Guardrail added:
- `index.html` top-bar now exposes status + active alerts + scope + period
- `app.js` adds `renderTopActionsNow`, `renderPortfolioRiskImportance`, `renderWhatChanged`
- top actions are ranked from canonical alerts taxonomy and always include owner/action/proof
- top-bar context refresh is centralized in `updateTopbarContext()`

Proof:
- `npm run check`

Follow-up:
- instrument `30s/60s/2 clics` timing metrics in `MBE-1106` to quantify cockpit decision latency

---

## 2026-03-09 - Alerts operational queue baseline

Date:
2026-03-09

Issue:
`MBE-1100`

Context:
Alert center already exposed taxonomy and priority but still behaved mostly like a static table, not an operator queue.

Failure mode:
Triaging required extra scanning and status handling lived outside the UI flow.

Root cause:
Missing queue interactions: state filter, state transitions, and proof drawer path in one action loop.

Guardrail added:
- `app.js` adds `alertTypeFilter`, `alertStateFilter`, `alertStateOverrides`, `activeAlertProofId`
- queue rendering now includes type/state filters, state transition buttons, proof drawer, and one-click source opening
- taxonomy and fallback alerts now normalize state with UI override support
- `styles.css` adds queue card, state action, and proof drawer styles

Proof:
- `npm run check`

Follow-up:
- wire alert state overrides to a persisted action backend when execution tracking is integrated

---

## 2026-03-09 - Domain master decision cards baseline

Date:
2026-03-09

Issue:
`MBE-1102`

Context:
Domain diagnostics required reading multiple sections (matrix, ownership, write/read) before identifying first action.

Failure mode:
First diagnosis could require graph/radar navigation, delaying local domain decisions.

Root cause:
No unified domain-first card combining health trajectory, dependencies, policy violations, owner, and next action.

Guardrail added:
- `app.js` adds `buildDomainMasterRows()` and `renderDomainMaster()`
- domain master cards now include:
  - executive summary (score/risk/importance/priority)
  - trajectory (7/30/90 deltas)
  - critical dependencies (incoming/outgoing/integration links)
  - projections + consumers
  - policy violation count
  - recommended plan (`stabilize|extract|hold`)
  - owner + next action + state
- domain proof drawer + domain filter controls

Proof:
- `npm run check`

Follow-up:
- enrich trajectory with explicit change-event correlation when `MBE-1098` is implemented

---

## 2026-03-09 - Owner + next-action wiring baseline

Date:
2026-03-09

Issue:
`MBE-1105`

Context:
Owner/action existed in partial surfaces but lacked a normalized operating policy and cross-view consistency.

Failure mode:
Critical signals could be visible without a consistent ownership/action workflow between cockpit, alerts, and domain diagnostics.

Root cause:
No explicit owner/action operating policy artifact + no shared UI state model for remediation status.

Guardrail added:
- `docs/ownership-and-actions.md` policy for owner/action/state requirements
- normalized action state (`open|in-progress|done`) in alert queue
- owner + next-action present in:
  - top actions cockpit block
  - alerts queue cards
  - domain master cards
- owner-missing escalation marker enforced in domain diagnostics

Proof:
- `npm run check`
- policy doc: `/Users/mohyi/atlas/docs/ownership-and-actions.md`

Follow-up:
- persist remediation state in upstream execution system when backend linkage is available

---

## 2026-03-09 - Temporal correlation baseline (7/30/90)

Date:
2026-03-09

Issue:
`MBE-1098`

Context:
Atlas had trend charts but no canonical projection linking changes to impact across standard decision windows.

Failure mode:
Operators could see metric movement but lacked a causal read (`what changed`, `when`, `impact`) reusable by multiple views.

Root cause:
No generated correlation projection in history datasets; correlation logic stayed implicit in UI.

Guardrail added:
- `scripts/lib/trends-correlation.mjs` canonical correlation logic
- `scripts/generate-trends-correlation.mjs` projection generator
- `data/atlas-history.json` enriched with `trendsCorrelation`
- `data/history/atlas-trends-correlation.json` generated artifact
- `docs/trends-correlation.md` contract and usage rules
- `app.js` consumption in history (`renderTrendsCorrelation`) + overview/domain reuse
- smoke guardrail enforces presence/integrity of `atlas-history.trendsCorrelation`

Proof:
- `npm run generate:trends`
- `npm run check`

Follow-up:
- connect correlation events to KPI instrumentation (`MBE-1106`) for measured decision-time impact

---

## 2026-03-09 - Portfolio view baseline (manager/architecte)

Date:
2026-03-09

Issue:
`MBE-1101`

Context:
Atlas exposed a portfolio hint in Home but lacked a dedicated arbitration surface to decide quickly where to stabilize or extract at domain portfolio scale.

Failure mode:
Operators had to stitch decisions from multiple sections and could not read ranking, signals, and trajectory in one place.

Root cause:
No dedicated `portfolio` view wiring and no projection-first portfolio contract artifact.

Guardrail added:
- `app.js` adds dedicated `portfolio` navigation and `renderPortfolioView()`
- portfolio surface now includes:
  - priority table (canonical rank/risk/importance)
  - domain×signals heatmap
  - importance×risk scatter
  - domain sparklines
  - stable reference domains
- `docs/portfolio-view.md` documents canonical reads and decision semantics
- smoke/e2e markers enforce `id: "portfolio"` and `function renderPortfolioView`

Proof:
- `npm run check`

Follow-up:
- connect portfolio arbitration outcomes to KPI instrumentation (`MBE-1106`)

---

## 2026-03-09 - Graph/Radar moved to secondary contextual investigation

Date:
2026-03-09

Issue:
`MBE-1103`

Context:
Graph and radar were directly available in primary navigation, which increased cognitive load during first-pass decision workflows.

Failure mode:
Operators could jump to graph/radar too early instead of finishing decision-first triage in cockpit/alerts/domain surfaces.

Root cause:
No explicit separation between decision views (L1/L2) and investigation views (L3), and no contextual preset wiring from alerts/domains.

Guardrail added:
- removed graph/radar from primary nav entries in `VIEWS`
- added contextual investigation state (`investigationContext`) and wiring:
  - `data-open-graph-context`
  - `data-open-radar-context`
  - `data-clear-investigation-context`
- alerts and domain cards now open graph/radar with domain presets
- graph preset limits visible nodes/edges to domain-centered neighborhood
- docs contract added: `docs/graph-radar-secondary-context.md`
- smoke/e2e checks enforce contextual investigation markers

Proof:
- `npm run check`

Follow-up:
- include contextual investigation paths in full browser E2E suite (`MBE-1107`)

---

## 2026-03-09 - Dedicated Evidence/Audit space (P4)

Date:
2026-03-09

Issue:
`MBE-1104`

Context:
Proof payloads were available via local drawers (alerts/domains) but not consolidated in a dedicated audit space, creating noise in decision paths and poor artifact discoverability.

Failure mode:
Operators had to traverse decision views to inspect raw evidence and JSON exports, increasing friction for audit and post-mortem workflows.

Root cause:
No dedicated `evidence` surface with searchable inventory and no explicit audit artifact index.

Guardrail added:
- new dedicated view `evidence` (P4) for checks + inventory + raw snapshots + JSON exports
- contextual deep-links from alerts/domain cards and proof drawers to the evidence space
- `scripts/generate-audit-index.mjs` + `data/history/atlas-audit-index.json`
- `app.js` fallback logic if audit index is unavailable
- smoke/e2e markers enforce evidence-view wiring
- governance doc added: `docs/evidence-audit-space.md`

Proof:
- `npm run generate:audit`
- `npm run check`

Follow-up:
- include full evidence journey scenarios in browser E2E flows (`MBE-1107`)

---

## 2026-03-09 - Decision KPI instrumentation baseline (30s/60s/2 clics)

Date:
2026-03-09

Issue:
`MBE-1106`

Context:
Atlas had decision-first views but no explicit runtime instrumentation proving operator latency (`first priority`, `rationale`, `owner action`) and drilldown behavior against a stable before/after baseline.

Failure mode:
Refactors could claim faster decision loops without measurable proof, making readiness/signoff subjective.

Root cause:
Missing telemetry contract and missing cockpit wiring to collect decision-path events in a consistent way.

Guardrail added:
- `app.js` decision KPI telemetry runtime:
  - `trackDecisionKpiInteraction()`
  - `bindDecisionKpiEvents()`
  - `initializeDecisionKpiTelemetry()`
  - `renderDecisionKpiDashboard()`
- baseline/targets contract in `data/architecture-service-ops-live-report.json` (`decisionKpis`)
- operating contract doc: `docs/decision-kpis.md`
- smoke guardrail asserts decision KPI contract integrity
- e2e marker checks enforce KPI instrumentation wiring

Proof:
- `npm run generate:freshness && npm run generate:priority && npm run generate:alerts && npm run generate:trends && npm run generate:audit`
- `npm run check`

Follow-up:
- extend `MBE-1107` with browser-flow assertions on actual KPI values (not only wiring markers)

---

## 2026-03-09 - E2E scenario suite and visual regression baseline

Date:
2026-03-09

Issue:
`MBE-1107`

Context:
Atlas quality gates had marker-level E2E checks but lacked scenario coverage for decision flows and lacked deterministic visual baselines for critical views.

Failure mode:
UI behavior and layout structure could regress while marker tests still passed, especially on alert/domain drill-down paths and portfolio filtering.

Root cause:
No stable fixture runtime for render-path validation and no versioned baseline for visual structure comparisons.

Guardrail added:
- fixture-driven E2E runtime harness:
  - `tests/e2e/_atlas-fixture.mjs`
  - `tests/e2e/_atlas-runtime-harness.mjs`
- scenario suites:
  - `tests/e2e/cockpit.spec.test.mjs`
  - `tests/e2e/alerts.spec.test.mjs`
  - `tests/e2e/domain.spec.test.mjs`
  - `tests/e2e/portfolio.spec.test.mjs`
- visual regression baseline:
  - `tests/visual/baselines/view-signatures.json`
  - `tests/e2e/visual-regression.spec.test.mjs`
  - `tests/visual/generate-view-signatures.mjs`
- perceived render budget assertions (p95) for critical decision views

Proof:
- `npm run test:e2e`
- `npm run check`

Follow-up:
- when Playwright browser baseline is introduced, map signature checks to full screenshot diff workflow

---

## 2026-03-09 - Migration flags and rollback bridge baseline

Date:
2026-03-09

Issue:
`MBE-1108`

Context:
Atlas V3 decision surfaces were delivered, but rollout and rollback controls were not fully explicit for operators (legacy mapping, feature-level kill switches, and safe fallback routing).

Failure mode:
Disabling a surface (evidence/investigation/KPI) could create ambiguous navigation expectations without formal operator documentation and explicit fallback guarantees.

Root cause:
Partial feature-flag wiring existed in `app.js`, but rollout policy and rollback procedures were not yet codified and guarded by dedicated tests.

Guardrail added:
- `docs/migration-plan.md` legacy->V3 mapping, phased rollout, rollback policy, operator changelog
- `docs/rollout-flags.md` flag catalog (`ff_*` + `localStorage`) with safety behaviors
- `app.js` safe navigation fallback (`resolveVisibleFallbackView`, `switchViewSafely`) + guarded evidence/investigation routing
- `tests/e2e/cockpit.spec.test.mjs` rollout regression tests (flag filtering + fallback behavior + legacy bridge remap)
- `scripts/lint-atlas.mjs` now requires migration docs

Proof:
- `node --test /Users/mohyi/atlas/tests/e2e/cockpit.spec.test.mjs`
- `npm run test:e2e`
- `npm run check`

Follow-up:
- execute `MBE-1109` pilot (payments/widgets) using these flags as rollout controls
- close `MBE-1110` with final governance audit signoff and rollback evidence

---

## 2026-03-09 - High-risk pilot and top-5 rollout tuning

Date:
2026-03-09

Issue:
`MBE-1109`

Context:
Decision priority ranking did not reflect pilot intent (`payments/widgets`) nor extension execution domains (`analytics/pages/workitems/machine`) in operational ordering.

Failure mode:
Top actions could prioritize structurally noisy domains while missing pilot friction hotspots, reducing decision-loop effectiveness for target execution waves.

Root cause:
Priority generation relied only on drift/gap/policy severity and strategic metadata without pilot-specific severity/tuning overlays.

Guardrail added:
- `data/atlas-data.json` now includes `pilotRollout` block (domain overrides, KPI before/after, target top-5 plan)
- `scripts/generate-decision-priority.mjs` now supports pilot tuning inputs:
  - strategy priority -> severity mapping
  - per-domain overrides (`severity`, `strategicPriority`, `strategicImportance`, `priorityBoost`)
- `docs/pilot-payments-widgets.md` captures pilot evidence and KPI deltas
- `docs/top5-rollout.md` defines phased extension governance
- `scripts/lint-atlas.mjs` requires both new docs

Proof:
- `npm run generate:priority`
- `npm run generate:alerts`
- `npm run check`

Follow-up:
- execute final closure `MBE-1110` with governance/readiness signoff based on pilot evidence and tuned top-5 ordering

---

## 2026-03-09 - Final governance signoff closure

Date:
2026-03-09

Issue:
`MBE-1110`

Context:
All execution waves were implemented, but closure required explicit proof that governance, contract integrity, anti-drift discipline, and decision KPI objectives remained valid at final snapshot.

Failure mode:
Program closure could be declared without auditable signoff artifacts, leaving ambiguity on readiness state and post-program routing.

Root cause:
No dedicated closure artifacts (`final audit` + `readiness signoff`) with unified evidence and backlog routing policy.

Guardrail added:
- `docs/final-governance-audit.md` with final governance evidence and verdict
- `docs/readiness-signoff.md` with closure checklist and readiness decision
- `scripts/lint-atlas.mjs` now requires both closure docs
- explicit post-program routing policy (`queue:codex-proposal` vs `queue:human-only`)

Proof:
- `npm run check`
- `data/architecture-drift.json` summary (`totalFindings=0`)
- `data/atlas-data.json` (`projection canonical coverage=100%`, top-5 pilot ordering)

Follow-up:
- close Epic `MBE-1090`
- route only proposal/human-only items outside active execution board unless explicitly reprioritized

---

## 2026-03-09 - Post-program Atlas triage routing

Date:
2026-03-09

Context:
After closure (`MBE-1090`, `MBE-1110` done), Atlas needed an explicit triage pass to keep execution wave clean and route only residual non-blocking work.

Guardrail applied:
- verified open Atlas `queue:execution` items = `0`
- verified Atlas `queue:human-only` blockers = `0`
- created/routed `MBE-1127` in `queue:codex-proposal` for KPI residual variance optimization

Proof:
- Linear labels/status sweep (`alignment:atlas`, `repo:atlas`, `queue:*`)
- board snapshot updated in `docs/atlas-execution-board.md`

---

## 2026-03-09 - KPI residual gap closed with direct owner-action path

Date:
2026-03-09

Issue:
`MBE-1127`

Context:
Post-signoff KPI evidence still showed a minor gap on first-priority latency and owner-action clicks (`31.8s`, `2.1`) on pilot domains.

Root cause:
- top-priority action required extra navigation in common path (`overview` -> `alerts` -> state action)
- first-priority timestamp depended on explicit interaction despite immediate top-priority visibility in cockpit

Guardrail added:
- direct owner-action CTA on top action cards in `overview` (single-step state transition to `in-progress`)
- explicit priority auto-surface timestamp when top-priority cards are already visible on first render
- new evidence slice `pilotRollout.kpiMeasurements.afterOptimization` in `data/atlas-data.json`
- governance docs updated with strict target compliance proof

Proof:
- `npm run check`
- `data/atlas-data.json > pilotRollout.kpiMeasurements.afterOptimization`

---

## 2026-03-11 - Service-ops semantic guardrails

Date:
2026-03-11

Context:
Atlas already validated the presence of `decisionKpis`, `freshnessContract`, and `alertsTaxonomy`, but key `service-ops` operator semantics were still protected mostly by convention.

Failure mode:
`architecture-service-ops-live-report.json` could drift semantically while staying syntactically present, producing false-green smoke runs and silent degradation on service coverage semantics.

Root cause:
No shared local guardrail asserted:
- service state counts vs `totalServices`
- semantic alignment between `summary` and `serviceCoverage`
- bounded coverage counters (`matched`, `platformMonitoredOnly`, `unexpectedMonitoredWithoutDetection`)

Guardrail added:
- shared validator: `scripts/lib/service-ops-guardrails.mjs`
- local contract test: `tests/contracts/service-ops.contract.test.mjs`
- smoke now reuses the same semantic validator
- non-regression matrix updated with service-ops semantic assertions

Proof:
- `npm run test:contracts`
- `npm run test:smoke`
- `npm run check`

Follow-up:
- keep future `service-ops` field additions on the same shared validator path instead of introducing parallel checks
