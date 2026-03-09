# Top-5 Rollout Plan

Ticket:
- `MBE-1109`

Date:
- `2026-03-09`

Goal:
- move from 2-domain pilot to a governed top-5 execution set
- keep rollout reversible via flags and measurable via KPI instrumentation

## Baseline and target

Before (pre-pilot top-5):
- `payments`, `pages`, `documents`, `machine`, `devices`

Pilot + tuning target top-5:
- `widgets`, `payments`, `workitems`, `pages`, `machine`

Immediate next candidate:
- `analytics` (rank 6 after pilot tuning)

## Rollout waves

1. Wave A (already active)
- `payments`, `widgets`
- objective: prove time-to-priority and owner-action reductions

2. Wave B (extension top-5)
- add `workitems`, `pages`, `machine`
- keep `analytics` as first follow-up slot

3. Wave C (post top-5)
- reintegrate remaining domains by decision score and governance readiness

## Operational controls

Feature flags used for safe rollout:
- `ff_cockpit_v3`
- `ff_evidence`
- `ff_investigation`
- `ff_decision_kpi`

Rollback policy:
- disable secondary surfaces first (`evidence`, `investigation`, `decision_kpi`)
- if needed, fallback to bridge mode (`ff_cockpit_v3=0`)

## Exit criteria for extension

- top-5 queue reflects tuned ranking in generated dataset
- alerts queue prioritizes extension domains (`workitems/pages/machine`) before non-target domains
- KPI trend remains in target corridor (or explicit variance explanation attached)
- `npm run check` passes on final dataset

## Commands

```bash
cd /Users/mohyi/atlas
npm run generate:priority
npm run generate:alerts
npm run check
```
