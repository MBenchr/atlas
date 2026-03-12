# Atlas Discipline Dashboard

Purpose:
- centralize all governance and architecture discipline rules in one report
- map each rule to executable controls
- expose exact deviation locations (file + line + failing control)

Canonical source files scanned:
- `/Users/mohyi/atlas/AGENTS.md`
- `/Users/mohyi/atlas/tasks/lessons.md`
- `/Users/mohyi/atlas/docs/atlas-decision-stack.md`
- `/Users/mohyi/atlas/docs/non-regression-matrix.md`

Additional governance files verified by controls (presence/markers/gates, not line-by-line rule extraction):
- `/Users/mohyi/atlas/docs/atlas-execution-board.md`
- `/Users/mohyi/atlas/docs/projection-registry.md`
- `/Users/mohyi/atlas/docs/consumer-contract-matrix.md`
- `/Users/mohyi/atlas/docs/discipline-dashboard.md`
- `/Users/mohyi/atlas/scripts/generate-discipline-report.mjs`
- `/Users/mohyi/atlas/scripts/lint-atlas.mjs`
- `/Users/mohyi/atlas/scripts/lint-canonical-guardrails.mjs`
- `/Users/mohyi/atlas/scripts/smoke-atlas.mjs`
- `/Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs`

Generated artifact:
- `/Users/mohyi/atlas/data/history/atlas-discipline-report.json`

## Commands

Quick report (used for regular cockpit refresh):

```bash
cd /Users/mohyi/atlas
npm run generate:discipline
```

Full report (includes full E2E gate):

```bash
cd /Users/mohyi/atlas
npm run audit:discipline
```

## Report model

Top-level fields:
- `generatedAt`: report timestamp
- `mode`: `quick` or `full`
- `summary.controls`: pass/fail/warn counts for controls
- `summary.rules`: pass/fail/warn/manual counts for extracted rules
- `summary.deviationCount`: total non-pass rule rows
- `controls[]`: executable controls, command output, evidence paths
- `rules[]`: extracted rule inventory + linked control IDs + status
- `deviations[]`: actionable list of gaps with source location
- `sourceCoverage`: overlap between scanned rule sources and control-verified governance sources
- `repoGovernance`: cross-repo governance baseline status
  (`AGENTS.md`, `tasks/lessons.md`, markers `decision-stack|linear|doctrine|local-first`)

## Deviation policy

- `fail`: at least one linked control failed
- `warn`: linked controls require manual/process verification
- `manual`: no automated control is mapped yet

`manual` rows are governance debt: create or improve an automated control until the rule is machine-verified.
