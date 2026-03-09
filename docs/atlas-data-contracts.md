# Atlas Data Contracts

Ticket:
- `MBE-1092`

Goal:
- turn Atlas JSON datasets into explicit, versioned, and locally testable contracts

## Contract scope (v1)

The following datasets are governed by versioned schemas:

- `data/atlas-data.json`
- `data/architecture-drift.json`
- `data/architecture-policy-report.json`
- `data/architecture-strategy-report.json`
- `data/architecture-score.json`
- `data/atlas-history.json`

Operational projection note:
- `data/atlas-history.json` may include additive projection fields consumed by Atlas decision views:
  - `freshnessContract`
  - `trendsCorrelation`
- these additions are handled as `minor` contract evolution (backward-compatible additive fields).

Operational evidence note:
- `data/history/atlas-audit-index.json` is an additive operational artifact for the dedicated proof/audit view.
- it is intentionally outside the 6 governed contract datasets and can evolve without consumer-breaking semantics.

Operational KPI note:
- `data/architecture-service-ops-live-report.json` now includes additive `decisionKpis` metadata consumed by Atlas KPI dashboard.
- this observability metadata is outside the 6 governed contract datasets and follows `patch/minor` evolution unless shared consumers are introduced.

Schemas are stored in:
- `data/contracts/schemas/v1/*.schema.json`

Manifest (source of truth):
- `data/contracts/manifest.json`

## Compatibility policy

Version classification:

- `patch`: internal correction, no consumer-visible contract impact
- `minor`: backward-compatible additive change
- `major`: breaking change (rename/removal/semantic change)

Rules:

- supported contract majors: `N` and `N-1`
- minimum deprecation period before removing `N-1`: 90 days
- any `major` requires migration plan + impacted-consumer proof before merge
- compatibility posture for current Atlas contracts: backward-compatible + forward-tolerant

## Local validation

Run full contract validation:

```bash
node /Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs
```

Run one dataset only:

```bash
node /Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs --dataset architecture-score
```

The validator reads the manifest and validates data against the declared schema version.

## Governance linkage

This file and artifacts support:

- `MBE-1092` directly (contracts + compatibility)
- `MBE-1093` next (projection registry / consumer matrix alignment)
- `MBE-1094` next (quality gate integration)

Doctrine remains mandatory:
`Core decides. Projections explain. Apps render.`
