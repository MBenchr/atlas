# Atlas Alerts Taxonomy

Issue:
- `MBE-1096`

Goal:
- normalize operational alerts into actionable units
- guarantee each alert has `severity`, `owner`, `projectedImpact`, `action`, and `proofLink`
- keep alert semantics stable across cockpit views

## Canonical taxonomy

Generator:
- `/Users/mohyi/atlas/scripts/generate-alerts-taxonomy.mjs`

Library:
- `/Users/mohyi/atlas/scripts/lib/alerts-taxonomy.mjs`

Main projection:
- `/Users/mohyi/atlas/data/atlas-data.json` -> `alertsTaxonomy`

Source-aligned projections:
- `/Users/mohyi/atlas/data/architecture-drift.json` -> `operationalAlerts`
- `/Users/mohyi/atlas/data/architecture-policy-report.json` -> `operationalAlerts`
- `/Users/mohyi/atlas/data/architecture-strategy-report.json` -> `operationalAlerts`

## Normalized types

- `domain-drift`
- `policy-warning`
- `coupling-regression`
- `projected-score-drop`
- `snapshot-stale`
- `high-gap-unresolved`
- `strategy-roadmap-divergence`

## Required fields per alert

- `id`
- `type`
- `domain`
- `severity`
- `owner`
- `state`
- `priorityScore`
- `projectedImpact`
- `projectedImpactScore`
- `action`
- `proofLink`
- `sourceFile`
- `sourcePath`
- `explanation`

## UI behavior

Alert center consumes normalized taxonomy and keeps filters:
- severity
- domain
- owner

No mute alerts:
- every alert must have an explicit action (`action`)
- missing owner is normalized to `atlas-ops`

## Commands

Generate taxonomy:

```bash
cd /Users/mohyi/atlas
node scripts/generate-alerts-taxonomy.mjs
```

Run all gates:

```bash
cd /Users/mohyi/atlas
npm run check
```
