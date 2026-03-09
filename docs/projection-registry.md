# Projection Registry (Atlas Local)

This registry declares the canonical projection reads rendered by Atlas.

Hard rules:
- Atlas does not create business truth.
- Atlas only renders declared canonical projections.
- Any projection contract change must update this file, `/Users/mohyi/atlas/docs/consumer-contract-matrix.md`, and contract tests under `/Users/mohyi/atlas/tests/contracts/`.
- `Core decides. Projections explain. Apps render.`

## Sources of truth

- Global canonical source registry: `/Users/mohyi/mcp/docs/projection-registry.md`
- Atlas consumed projection snapshot: `/Users/mohyi/atlas/data/atlas-data.json` (`projectionRegistry`)
- Atlas contract source: `/Users/mohyi/atlas/tests/contracts/atlas-projection-contracts.json`

## Canonical projection entries

| Domain | Projection | Owner | Canonical source | Canonical write-path | Authorized consumers | Contract tests |
|---|---|---|---|---|---|---|
| `workitems` | `workitems_inbox` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/workitems.ts`, `/Users/mohyi/NEXORA/packages/workitems/src` | `POST /organizations/:organizationId/workitems/:workItemId/actions` | `scarabee`, `moniteur`, `dashboard` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `documents` | `documents_publication` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/forms.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/routes/workflows.ts` | document publication transitions in core routes | `moniteur`, `dashboard` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `forms` | `forms_submissions` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/forms.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/domain/forms`, `/Users/mohyi/NEXORA/packages/forms/src` | `/organizations/:organizationId/forms/*` | `abetca`, `moniteur` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `pages` | `pages_runtime` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/pages.ts`, `/Users/mohyi/NEXORA/packages/page-builder-contract/src` | page create/update/publish in core routes | `abetca`, `dashboard`, `widgets-cdn` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `comms` | `comms_conversation_queue` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/comms.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/domain/comms`, `/Users/mohyi/NEXORA/packages/comms/src` | `/organizations/:organizationId/comms/*` | `scarabee`, `moniteur` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `analytics` | `analytics_kpi` | `api data-plane` | `/Users/mohyi/api/apps/api/routers/stats.py`, `/Users/mohyi/api/apps/api/services/stats_usecase.py`, `/Users/mohyi/api/apps/api/services/metrics_core_usecase.py` | API aggregation/update pipelines (stats/metrics) | `dashboard`, `moniteur`, `abetca` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `widgets` | `widgets_runtime_context` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/widgets-admin-core-routes.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/routes/widgets-machine-context-utils.ts`, `/Users/mohyi/NEXORA/packages/widgets/src` | `/organizations/:organizationId/widgets/*` | `widgets-cdn`, `dashboard` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `machine` | `machine_entity_view` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/machine-entities.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/routes/machine-projections.ts`, `/Users/mohyi/NEXORA/packages/knowledge-core/src` | `/organizations/:organizationId/machine/*` | `widgets-cdn`, `dashboard`, `directories` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `devices` | `devices_registry_state` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/devices.ts`, `/Users/mohyi/NEXORA/packages/devices/src` | `/organizations/:organizationId/devices/*` | `dashboard`, `moniteur` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |
| `payments` | `payments_checkout_status` | `core-platform (NEXORA)` | `/Users/mohyi/NEXORA/apps/core-platform/src/routes/stripe-connect.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/routes/stripe-webhooks.ts`, `/Users/mohyi/NEXORA/apps/core-platform/src/routes/widgets-public-donation-checkout-routes.ts` | payment intent/session/webhook transitions in core routes | `widgets-cdn`, `dashboard`, `moniteur` | `/Users/mohyi/atlas/tests/contracts/projection-registry.contract.test.mjs` |

## Validation command

```bash
cd /Users/mohyi/atlas
node --test tests/contracts/projection-registry.contract.test.mjs
```
