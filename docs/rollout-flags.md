# Atlas Rollout Flags

Ticket:
- `MBE-1108`

Date:
- `2026-03-09`

## Flag catalog

| Flag key | Query param | localStorage key | Default | Effect |
|---|---|---|---|---|
| `cockpitV3Enabled` | `ff_cockpit_v3` | `atlas.rollout.cockpit_v3` | `true` | enables full V3 navigation; when `false`, legacy bridge view set only |
| `legacyTabBridgeEnabled` | `ff_legacy_bridge` | `atlas.rollout.legacy_bridge` | `true` | reserved bridge gate (metadata only for now) |
| `evidenceSpaceEnabled` | `ff_evidence` | `atlas.rollout.evidence` | `true` | enables dedicated evidence surface + context deep-links |
| `secondaryInvestigationEnabled` | `ff_investigation` | `atlas.rollout.investigation` | `true` | enables contextual graph/radar investigation flows |
| `decisionKpiEnabled` | `ff_decision_kpi` | `atlas.rollout.decision_kpi` | `true` | enables decision KPI dashboard in overview |

Supported boolean values:
- `on`: `1`, `true`, `on`, `yes`, `enabled`
- `off`: `0`, `false`, `off`, `no`, `disabled`

Priority order:
1. URL query param (`ff_*`)
2. `localStorage` (`atlas.rollout.*`)
3. hardcoded defaults in `app.js`

## Usage examples

Enable full V3 from URL:

```text
/index.html?ff_cockpit_v3=1&ff_evidence=1&ff_investigation=1&ff_decision_kpi=1
```

Disable evidence and KPI only:

```text
/index.html?ff_evidence=0&ff_decision_kpi=0
```

Force legacy bridge mode:

```text
/index.html?ff_cockpit_v3=0
```

Persist values in browser console:

```js
localStorage.setItem('atlas.rollout.cockpit_v3', 'off');
localStorage.setItem('atlas.rollout.evidence', 'off');
location.reload();
```

Reset persisted flags:

```js
['cockpit_v3','legacy_bridge','evidence','investigation','decision_kpi']
  .forEach((name) => localStorage.removeItem(`atlas.rollout.${name}`));
location.reload();
```

## Operational safety

Safety behaviors implemented:
- hidden view protection: active view is automatically remapped to a visible view
- evidence disabled: evidence deep-links fallback to `alerts`/`overview`
- investigation disabled: graph/radar deep-links fallback to `domains`/`overview`
- overview banner exposes active rollback flags

## Quick validation

1. `ff_cockpit_v3=0`
- expected visible views: `overview`, `domains`, `history`, `roadmap`

2. `ff_evidence=0`
- expected: no evidence view in primary nav; evidence links do not break navigation

3. `ff_investigation=0`
- expected: graph/radar context links fallback to `domains`

4. `ff_decision_kpi=0`
- expected: KPI decision dashboard hidden from overview
