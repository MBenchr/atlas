# Atlas Execution Board (V3)

This is the active execution path for `atlas`.
Snapshot date: 2026-03-10 (updated after closing the Atlas next-wave cleanup batch).

## Board rules

- This board is the default source for "what next" in Atlas.
- Tickets outside this board are triage/debt/proposal by default.
- Keep active wave small and executable.
- Any optional improvement goes to `queue:codex-proposal`.
- Any irreducibly human-gated blocker goes to `queue:human-only`.
- Enforce doctrine on every task: `Core decides. Projections explain. Apps render.`

## Active project (Linear)

- Project: `Atlas`
- Current wave status:
  - all active Atlas execution tickets are consolidated under the single `Atlas` project
  - previous hardening tickets remain in review inside the same project
  - residual-gap tickets (`MBE-1223`..`MBE-1226`) were folded back into `Atlas`, executed, and closed in the same project
- dual-machine pattern used in this wave:
  - `main` local implementation
  - `mohyi-pro` support lane for review / validation / read-only inspection
- archived projects:
  - `[ARCHIVED] Atlas Next Wave`
  - `[ARCHIVED] Atlas Expert Hardening`
  - `[ARCHIVED] Atlas Decision Cockpit V3`
  - `[ARCHIVED] Atlas Cost Governance`

## Current wave (Now)

- no active `phase:now` execution ticket is open in Atlas
- the next implementation batch must be opened only from a newly confirmed gap

## Active lane split (2026-03-10)

### `main`

- ticket actif:
  - aucun
- scope:
  - lane locale terminée pour `MBE-1223`, `MBE-1225`, `MBE-1226`
  - preuves poussées dans Linear
  - validations locales terminées

### `mohyi-pro`

- ticket actif:
  - aucun
- repo:
  - `~/work/atlas__next_wave`
- branche:
  - `codex/atlas-next-wave-review`
- scope:
  - lane distante terminée pour la revue indépendante
  - validation E2E distante sans collision avec la lane locale

Parallelism rule used:
- `main` modifie le shell et le consumer Atlas
- `mohyi-pro` vérifie la wave en lecture seule et challenge la sémantique métier
- aucun edit concurrent sur la meme famille de fichiers

## Current status

Previous wave in review:
1. `MBE-1216` - `In Review`
2. `MBE-1217` - `In Review`
3. `MBE-1218` - `In Review`
4. `MBE-1219` - `In Review`
5. `MBE-1220` - `In Review`
6. `MBE-1221` - `In Review`
7. `MBE-1222` - `In Review`

Current execution wave:
1. `MBE-1223` - shell/operator language cleanup (`Done`)
2. `MBE-1224` - monitoring semantics hardening (`Done`)
3. `MBE-1225` - topbar urgency semantics (`Done`)
4. `MBE-1226` - residual alert recomposition cleanup (`Done`)

## Completed baseline

- `MBE-1091` - Baseline gouvernance repo
- `MBE-1092` - Contrat de donnees Atlas
- `MBE-1093` - Registre des projections + consumer contract matrix Atlas
- `MBE-1094` - Matrice de non-regression et quality gates cockpit
- `MBE-1095` - Decision Priority Score
- `MBE-1096` - Taxonomie d'alertes operationnelles + enrichissement action
- `MBE-1097` - Freshness contract et stale-data guardrail
- `MBE-1098` - Correlation temporelle 7/30/90j
- `MBE-1099` - Home cockpit P0
- `MBE-1100` - Alerts as operational queue
- `MBE-1101` - Portfolio view
- `MBE-1102` - Domain master sheet
- `MBE-1103` - Graph/radar in secondary context
- `MBE-1104` - Dedicated preuves/audit space
- `MBE-1105` - Owner + next-action wiring
- `MBE-1106` - KPI instrumentation 30s/60s/2 clics
- `MBE-1107` - E2E + visual regression suite
- `MBE-1108` - Migration plan + feature flags
- `MBE-1109` - High-risk pilot and top-5 extension
- `MBE-1110` - Final governance audit + readiness signoff

## Post-signoff notes

- `MBE-1127` - Post-signoff KPI optimization (`queue:codex-proposal`, `Done`)
- Le hardening actuel existe pour corriger les ruptures de contrat et les signaux encore trop approximatifs, pas pour reouvrir le programme clos.
- `MBE-1217` a retabli une taxonomie providers canonique partagee entre scan et service-ops.
- `MBE-1222` a confirme les faux signaux P0 et a motive le retrait des fallbacks non canoniques en UI.
- `MBE-1223`..`MBE-1226` ont ferme la wave residuelle: plus de vue de comparaison dediee, plus d urgence topbar approximative, plus de faux gaps de coverage, plus de recomposition locale silencieuse des alertes.

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
