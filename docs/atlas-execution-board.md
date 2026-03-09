# Atlas Execution Board (V3)

This is the active execution path for `atlas`.
Snapshot date: 2026-03-09 (updated after `MBE-1109`).

## Board rules

- This board is the default source for "what next" in Atlas.
- Tickets outside this board are triage/debt/proposal by default.
- Keep active wave small and executable.
- Any optional improvement goes to `queue:codex-proposal`.
- Any irreducibly human-gated blocker goes to `queue:human-only`.
- Enforce doctrine on every task: `Core decides. Projections explain. Apps render.`

## Current ticket state (Linear)

- Total Atlas tickets in project: 21
- `Needs triage`: 0
- `Triage`: 0
- `Todo`: 1 (`MBE-1110`)
- `In Progress`: 1 (`MBE-1090` epic)
- `Backlog`: 0
- `Done`: 19

## Wave 0 - Governance baseline (Now)

- `MBE-1091` - Baseline gouvernance repo (AGENTS + lessons + docs de pilotage)
- `MBE-1092` - Contrat de donnees Atlas (schemas versionnes + compatibilite)
- `MBE-1093` - Registre des projections + consumer contract matrix Atlas
- `MBE-1094` - Matrice de non-regression et quality gates cockpit

Exit criteria:
- local governance docs complete
- data/projection contracts explicit and versioned
- quality gates executable locally

## Wave 1 - Decision model foundation (Now)

- `MBE-1095` - Decision Priority Score (domaines + alertes)
- `MBE-1096` - Taxonomie d'alertes operationnelles + enrichissement action
- `MBE-1097` - Freshness contract et stale-data guardrail

Dependencies:
- requires Wave 0 contract/governance baseline

## Wave 2 - Decision-first surfaces (Now)

- `MBE-1099` - Home cockpit P0
- `MBE-1100` - Alerts as operational queue
- `MBE-1102` - Domain master sheet
- `MBE-1105` - Owner + next-action wiring

Dependencies:
- requires Wave 1 scoring/alert/freshness primitives

## Wave 3 - Secondary and scale surfaces (Next)

- `MBE-1098` - Correlation temporelle 7/30/90j (`Done`)
- `MBE-1101` - Portfolio view (`Done`)
- `MBE-1103` - Graph/radar in secondary context (`Done`)
- `MBE-1104` - Dedicated preuves/audit space (P4) (`Done`)
- `MBE-1106` - KPI instrumentation 30s/60s/2 clics (`Done`)
- `MBE-1107` - E2E + visual regression suite (`Done`)
- `MBE-1108` - Migration plan + feature flags (`Done`)
- `MBE-1109` - High-risk pilot and top-5 extension (`Done`)

## Wave 4 - Closure

- `MBE-1110` - Final governance audit + readiness signoff

## Mandatory ticket contract

Each execution ticket must declare:

- canonical source touched
- canonical write-path
- canonical projection(s)
- authorized consumers
- cross-domain coupling to reduce
- what must disappear from routes
- what must disappear from consumers
- proof of completion
- contract/E2E evidence
- version decision (`patch|minor|major`) if contract/projection touched

## Mandatory 5-question gate

Before coding, every ticket must answer:

1. Where is the canonical business truth?
2. What write-path is authorized?
3. What canonical projection is consumed?
4. Which consumer is authorized?
5. What proof prevents local business logic recreation?

If unanswered, move back to triage or split.
