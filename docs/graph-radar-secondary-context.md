# Graph/Radar Secondary Context Contract (ATLAS-13)

Ticket:
- `MBE-1103`

Objective:
- keep graph/radar diagnostic power while removing them from first decision navigation
- expose graph/radar only as contextual investigation (L3)

Rules:
- primary decision views stay `overview`, `alerts`, `portfolio`, `domains`, `projections`, `history`, `roadmap`
- graph/radar are opened from:
  - alerts queue cards
  - domain master cards
- investigation context must carry at least:
  - `domain`
  - `source`
  - optional `alertId`

Graph context behavior:
- apply a domain-centered preset:
  - keep the selected domain node
  - keep first-hop neighbor nodes (repo/projection/provider)
  - keep edges inside this contextual subset
- still honor graph type filters (`repo/domain/projection/provider`)

Radar context behavior:
- if context domain exists, render radar only for that domain
- allow direct switch back to graph context and context exit

Guardrails:
- no business scoring recomputation in graph/radar
- no dependency from Home/Cockpit to graph rendering
- smoke/e2e markers enforce contextual investigation wiring

Proof:
- `npm run check`
