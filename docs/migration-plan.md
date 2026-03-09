# Atlas Migration Plan (Legacy Tabs -> Cockpit V3)

Ticket:
- `MBE-1108`

Date:
- `2026-03-09`

Goal:
- deploy Cockpit V3 progressively with zero operator breakage
- keep an explicit rollback path at view level and feature level

Doctrine:
- `Core decides. Projections explain. Apps render.`

## Legacy mapping

| Legacy tab | Cockpit V3 layer | Why |
|---|---|---|
| `home` | `overview` | P0 decision cockpit (top actions + trend + ownership) |
| `alerts-table` | `alerts` | operational queue with owner/action/proof |
| `portfolio` | `portfolio` | manager-level arbitration by risk/importance |
| `domains` | `domains` | domain master sheet (owner, plan, proofs) |
| `graph` | `domains -> graph contextual` | L3 investigation only, no primary navigation |
| `radar` | `domains -> radar contextual` | L3 investigation only, no primary navigation |
| `history` | `history` | 7/30/90 trend and snapshot diff |
| `proofs` | `evidence` | dedicated P4 evidence/audit surface |
| `roadmap` | `roadmap` | execution readiness and wave plan |

## Rollout phases

1. `Phase A` (default)
- `cockpit_v3=on`
- `evidence=on`
- `investigation=on`
- `decision_kpi=on`
- expected UI: full V3 decision path with P0/P1/P2/P4 surfaces

2. `Phase B` (limited rollout)
- keep `cockpit_v3=on`
- disable secondary blocks by flag (`evidence=off`, `investigation=off`, or `decision_kpi=off`)
- expected UI: core decision flow remains available, non-critical surfaces are reduced

3. `Phase C` (legacy bridge rollback)
- `cockpit_v3=off`
- expected UI: safe legacy bridge with views `overview`, `domains`, `history`, `roadmap`

## Rollback policy

Immediate rollback levels:
- level 1: disable one feature (`evidence`, `investigation`, `decision_kpi`)
- level 2: disable full cockpit (`cockpit_v3=off`)

Rollback guarantees implemented in `app.js`:
- navigation is constrained to visible views only (`buildVisibleViews` + fallback)
- `setEvidenceContext` auto-falls back to `alerts/overview` when evidence is disabled
- `setInvestigationContext` auto-falls back to `domains/overview` when investigation is disabled
- `render()` always re-validates `activeView` against visible views

## Operator changelog

Operator-visible changes:
- migration banner in overview displays:
  - active mode (`v3-active` or `legacy-bridge`)
  - active view list
  - current flag state
  - current rollback summary
- evidence and investigation actions degrade safely when related flags are off
- decision KPI block can be disabled independently

## Validation checklist

- [ ] `npm run test:e2e` passes
- [ ] `npm run check` passes
- [ ] overview banner reflects flag combinations
- [ ] rollback to legacy bridge is validated (`cockpit_v3=off`)
- [ ] docs published (`migration-plan.md`, `rollout-flags.md`)
