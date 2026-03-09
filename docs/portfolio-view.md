# Portfolio View Contract (ATLAS-11)

Ticket:
- `MBE-1101`

Objective:
- provide a dedicated manager/architect portfolio surface to arbitrate where to act first
- keep portfolio decisions projection-first and graph-independent

Canonical reads:
- `atlas-data.decisionPriority.domains` for ranking, risk, strategic importance
- `atlas-data.domainProfiles` and `atlas-data.domainOwnership` for consumer/owner context
- `atlas-history.trendsCorrelation.domainWindows` + `atlas-history.snapshots` for temporal trajectories

Consumer:
- Atlas `portfolio` view only (render layer)

Decision semantics (UI only, no canonical rewrite):
- `quadrant=agir-maintenant` when `risk>=55` and `importance>=70`
- `quadrant=stabiliser` when `risk>=55` and `importance<70`
- `quadrant=extraire` when `risk<55` and `importance>=70`
- `quadrant=hold` otherwise

Sections:
- priority table (sorted from canonical rank/score)
- domain×signals heatmap
- strategic-importance×risk scatter
- domain sparklines (score trajectory)
- stable reference domains

Guardrails:
- no dependency on network graph data for portfolio decisions
- no local replacement of canonical priority score
- smoke/e2e markers enforce `portfolio` navigation and `renderPortfolioView` wiring

Proof:
- `npm run check`
