# Atlas Data Freshness SLA

Issue:
- `MBE-1097`

Goal:
- expose data freshness in a decision-first way
- classify freshness by SLA levels: `normal`, `degraded`, `stale`
- auto-generate stale alerts for operator action

## Canonical freshness contract

Projection:
- `/Users/mohyi/atlas/data/atlas-data.json` -> `freshnessContract`

History companion:
- `/Users/mohyi/atlas/data/atlas-history.json` -> `freshnessContract`

Generator:
- `/Users/mohyi/atlas/scripts/generate-freshness-contract.mjs`

Scoring library:
- `/Users/mohyi/atlas/scripts/lib/data-freshness.mjs`

## SLA levels

Default thresholds:
- `normal`: `ageHours <= 24`
- `degraded`: `24 < ageHours <= 48`
- `stale`: `ageHours > 48`

Overrides (optional):
- `ATLAS_FRESHNESS_NORMAL_HOURS`
- `ATLAS_FRESHNESS_DEGRADED_HOURS`

## Contract shape (atlas-data)

`freshnessContract` contains:
- `generatedAt`: freshness contract generation timestamp
- `slaHours`: `{ normal, degraded }`
- `globalStatus`: `normal | degraded | stale`
- `staleDatasetCount`: integer
- `datasets[]`: per-dataset status row (`dataset`, `file`, `generatedAt`, `ageHours`, `status`)
- `alerts[]`: auto-generated stale alerts (for cockpit alerts queue)

## UI consumption

Top bar freshness badge:
- `index.html` -> `#freshness-status`
- `app.js` -> `updateFreshnessPill(...)`

Alerts integration:
- stale rows from `freshnessContract.alerts` are injected into `buildArchitectureAlerts(...)`

## Validation

Generate contract:

```bash
cd /Users/mohyi/atlas
node scripts/generate-freshness-contract.mjs
```

Unit tests:

```bash
cd /Users/mohyi/atlas
node --test tests/unit/data-freshness.test.mjs
```

Full gates:

```bash
cd /Users/mohyi/atlas
npm run check
```
