# Ownership and Actions Policy (Atlas)

Purpose:
- ensure each critical architecture signal has an explicit owner and next action
- keep decision views action-first and compatible with V3 doctrine

Scope:
- cockpit top actions (`overview`)
- alerts operational queue (`alerts`)
- domain master cards (`domains`)

## Normalized action state

- `open`: action identified, not started
- `in-progress`: remediation started
- `done`: remediation completed

State source:
- canonical alert payload (`alertsTaxonomy.alerts[].state`) when available
- UI override map for local triage execution (`state.alertStateOverrides`)

## Owner requirements

- Every high/critical signal must include an owner.
- Missing owner is rendered as escalation:
  - `owner-missing`
  - visual warning in decision views
  - explicit reminder: escalation required before execution

## Next-action requirements

Each signal shown in decision views must expose:
- `what`: domain + alert type
- `why`: short explanation
- `impact`: projected impact
- `owner`: accountable team/person
- `action`: next remediation step
- `proof`: one-click proof/source path

## Anti-drift rule

- Atlas renders canonical projections and action metadata.
- Atlas must not invent business truth when canonical fields exist.
- If owner/action/proof is missing upstream, the fix path is:
  - enrich canonical projection/contracts upstream
  - do not add hidden fallback business logic in UI
