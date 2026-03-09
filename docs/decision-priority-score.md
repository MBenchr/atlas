# Atlas Decision Priority Score

Issue:
- `MBE-1095`

Doctrine:
- `Core decides. Projections explain. Apps render.`

Goal:
- define a deterministic and auditable decision priority score
- rank domains and architecture alerts with the same canonical model
- avoid UI-local or ad-hoc prioritization logic drift

## Canonical implementation

Source of truth:
- `/Users/mohyi/atlas/scripts/lib/decision-priority-score.mjs`

Data producer:
- `/Users/mohyi/atlas/scripts/generate-decision-priority.mjs`

Consumer surfaces:
- `/Users/mohyi/atlas/data/atlas-data.json` (`decisionPriority`)
- `/Users/mohyi/atlas/data/architecture-drift.json` (`decisionPriority.domains`)
- `/Users/mohyi/atlas/app.js` (overview, domain matrix, focus lists, alerts table)

## Formula

Raw formula:

```text
priority_raw = severity * impact * degradation * blast_radius * actionability
```

Normalization:

```text
priority_score = log-normalized(priority_raw) in [0..100]
```

Factor scales:
- severity: `none=1`, `low=2`, `medium=3`, `high=4`, `critical=5`
- impact: mix of business criticality and strategic importance
- degradation: projected drop + negative trend + drift findings
- blast radius: consumer count + cross-domain imports + coordination cost
- actionability: existence of concrete remediation handles (findings, gaps, policy violations, owner, projection, actions)

Tie-break order:
1. freshness
2. strategic priority
3. strategic importance

## Alert priority model

Alert score is computed from:
- alert severity
- domain decision-priority factors
- actionability boost by alert type (drift/gap/policy)

This ensures that critical alerts in critical domains rise first, without dropping context.

## Generation workflow

```bash
cd /Users/mohyi/atlas
node scripts/generate-decision-priority.mjs
```

Inputs:
- `data/atlas-data.json`
- `data/architecture-drift.json`
- `data/architecture-strategy-report.json`
- `data/atlas-history.json`
- `data/architecture-policy-report.json`

Outputs:
- updates `data/atlas-data.json`
- updates `data/architecture-drift.json`

## Quality proof

Unit tests:

```bash
cd /Users/mohyi/atlas
node --test tests/unit/decision-priority-score.test.mjs
```

Covered assertions:
- severity ordering monotonicity
- high-impact degraded domain outranks healthy low-impact domain
- tie-break stability on equal scores
- alert severity effect on score
