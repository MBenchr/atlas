# Pilot Payments + Widgets

Ticket:
- `MBE-1109`

Date:
- `2026-03-09`

Goal:
- validate decision efficiency gains on the highest-risk operator path before broad rollout
- prove the cockpit decision loop for `payments` and `widgets`

Doctrine:
- `Core decides. Projections explain. Apps render.`

## 5-question gate

1. Canonical business truth:
- `NEXORA/core-platform` domains `payments` and `widgets` (write-path + canonical projections)

2. Canonical write-path:
- core routes/services in `NEXORA/apps/core-platform/src/routes/*` + domain services

3. Canonical projections consumed:
- `payments_checkout_status`
- `widgets_runtime_context`

4. Authorized consumers:
- `widgets-cdn`
- `dashboard`
- `moniteur` (payments status)

5. Proof against local business recomputation:
- decision priority and alerts are generated in data-plane scripts (`generate-decision-priority`, `generate-alerts-taxonomy`)
- UI reads generated projections and taxonomy; no local priority recomputation introduced in pilot

## Pilot scope

Primary domains:
- `payments`
- `widgets`

Pilot tuning (stored in `atlas-data.json > pilotRollout`):
- `widgets`: severity override `high`, strategic priority override `high`, priority boost `+14`
- `payments`: strategic confirmation and priority boost `+4`
- strategy-priority severity mapping: `high -> medium`, `medium -> low`, `low -> none`

## KPI before/after

Source:
- `atlas-data.json > pilotRollout.kpiMeasurements`

| KPI | Before | After pilot | Delta |
|---|---:|---:|---:|
| time-to-first-priority | `86.4s` | `31.8s` | `-63.2%` |
| time-to-rationale | `142.6s` | `56.4s` | `-60.4%` |
| clicks-to-owner-action | `5.8` | `2.1` | `-63.8%` |
| drilldown-rate | `18%` | `34%` | `+88.9%` |

Interpretation:
- pilot meets the intended directional target (`30s/60s/2-clicks` zone, with strong drilldown increase)
- operator navigation burden drops materially on high-risk flows

## Ranking impact

After pilot tuning (`generate:priority`):
- `1. widgets (67.9)`
- `2. payments (66.6)`
- `3. workitems (65.1)`
- `4. pages (64.0)`
- `5. machine (63.5)`
- `6. analytics (61.0)`

Operational alerts after tuning (`generate:alerts`):
- top queue includes `payments`, `workitems`, `pages`, `machine`, then `analytics`

## Validation commands

```bash
cd /Users/mohyi/atlas
npm run generate:priority
npm run generate:alerts
npm run test:e2e
npm run check
```
