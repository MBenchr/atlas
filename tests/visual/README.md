# Atlas Visual Baselines

Purpose:
- keep deterministic visual signatures for critical decision views
- detect structural UI regressions without relying on live datasets

Files:
- `tests/visual/baselines/view-signatures.json`: baseline signatures
- `tests/visual/generate-view-signatures.mjs`: regenerate baseline from fixture runtime

Regeneration:

```bash
cd /Users/mohyi/atlas
node tests/visual/generate-view-signatures.mjs
```

Policy:
- update baselines only when UI structure changes are intentional
- pair baseline updates with scenario tests in `tests/e2e/*.spec.test.mjs`
