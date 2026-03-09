# Decision KPI Instrumentation

Ticket:
- `MBE-1106`

Goal:
- measure decision efficiency on Atlas cockpit with explicit operator metrics
- keep the metric contract local, testable, and aligned with V3 doctrine

Doctrine:
- `Core decides. Projections explain. Apps render.`
- KPI instrumentation observes UX behavior only; it does not recompute business truth

## KPI contract (`30s/60s/2 clics`)

Session metrics:
- `time-to-first-priority` (target: `<= 30s`)
- `time-to-rationale` (target: `<= 60s`)
- `clicks-to-owner-action` (target: `<= 2`)
- `drilldown-rate` (target: `>= 25%`)

Baseline source:
- `/Users/mohyi/atlas/data/architecture-service-ops-live-report.json` (`decisionKpis`)

Baseline values:
- before refactor: `86.4s`, `142.6s`, `5.8`, `18%`
- after refactor baseline: `34.1s`, `63.8s`, `2.4`, `29%`

## Event map (UI)

Priority events:
- navigation to alerts/domains from decision cards
- interaction with top actions and alert/domain action cards

Rationale events:
- proof drawer openings
- evidence/graph/radar contextual drill-down
- direct proof JSON/source opening

Owner action events:
- alert state transitions (`open`, `in-progress`, `done`)

Drill-down events:
- evidence, graph, radar, proof detail opens

## Implementation notes

Files:
- `/Users/mohyi/atlas/app.js`
- `/Users/mohyi/atlas/styles.css`
- `/Users/mohyi/atlas/data/architecture-service-ops-live-report.json`

Runtime behavior:
- telemetry is session-local in browser runtime
- session/history persistence uses `localStorage` key `atlas.decision-kpi.v1`
- dashboard is rendered in `overview` via `renderDecisionKpiDashboard()`

## Guardrails

Required quality proof:
- `npm run test:smoke`
- `npm run test:e2e`
- `npm run check`

Smoke must fail if:
- KPI dashboard wiring markers are missing
- `decisionKpis` contract is missing/invalid in service ops report

## Contract impact

- dataset contracts (`data/contracts/manifest.json`) unchanged
- shared projection semantics unchanged
- compatibility impact: `patch`
