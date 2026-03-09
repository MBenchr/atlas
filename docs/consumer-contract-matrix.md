# Consumer Contract Matrix (Atlas Local)

This matrix is the local compatibility contract for canonical projections rendered by Atlas.

Hard rules:
- No critical projection read without declared owner, version, and authorized consumers.
- Any projection contract change requires updating:
  - `/Users/mohyi/atlas/docs/projection-registry.md`
  - `/Users/mohyi/atlas/tests/contracts/atlas-projection-contracts.json`
  - contract tests under `/Users/mohyi/atlas/tests/contracts/`
- Breaking changes are `major-with-migration` only.

Canonical input:
- `/Users/mohyi/atlas/tests/contracts/atlas-projection-contracts.json`

## Compatibility policy

- `backwardCompatible`: `true`
- `forwardTolerant`: `true`
- `breakingPolicy`: `major-with-migration`
- `migrationRequired`: `true`

## Matrix

| Domain | Projection | Version | Owner | Authorized consumers | Compatibility |
|---|---|---|---|---|---|
| `workitems` | `workitems_inbox` | `v1` | `core-platform (NEXORA)` | `scarabee`, `moniteur`, `dashboard` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `documents` | `documents_publication` | `v1` | `core-platform (NEXORA)` | `moniteur`, `dashboard` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `forms` | `forms_submissions` | `v1` | `core-platform (NEXORA)` | `abetca`, `moniteur` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `pages` | `pages_runtime` | `v1` | `core-platform (NEXORA)` | `abetca`, `dashboard`, `widgets-cdn` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `comms` | `comms_conversation_queue` | `v1` | `core-platform (NEXORA)` | `scarabee`, `moniteur` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `analytics` | `analytics_kpi` | `v1` | `api data-plane` | `dashboard`, `moniteur`, `abetca` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `widgets` | `widgets_runtime_context` | `v1` | `core-platform (NEXORA)` | `widgets-cdn`, `dashboard` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `machine` | `machine_entity_view` | `v1` | `core-platform (NEXORA)` | `widgets-cdn`, `dashboard`, `directories` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `devices` | `devices_registry_state` | `v1` | `core-platform (NEXORA)` | `dashboard`, `moniteur` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |
| `payments` | `payments_checkout_status` | `v1` | `core-platform (NEXORA)` | `widgets-cdn`, `dashboard`, `moniteur` | `backwardCompatible=true`, `forwardTolerant=true`, `major-with-migration` |

## Contract tests

- `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs`
- `/Users/mohyi/atlas/tests/contracts/consumer-contract-matrix.contract.test.mjs`

Run:

```bash
cd /Users/mohyi/atlas
node --test tests/contracts/*.mjs
```
