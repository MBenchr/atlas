# Atlas Instructions

Global policy lives in `/Users/mohyi/.codex/AGENTS.md`.
Cross-repo canonical docs live in `/Users/mohyi/mcp/docs/`.

## Canonical decision sources

- Decision stack (global): `/Users/mohyi/mcp/docs/codex-decision-stack.md`
- Decision stack (Atlas local): `/Users/mohyi/atlas/docs/atlas-decision-stack.md`
- V3 architecture and governance: `/Users/mohyi/mcp/docs/v3-architecture-and-linear-governance.md`
- Real active path (global): `/Users/mohyi/mcp/docs/linear-v3-execution-board.md`
- Real active path (Atlas local): `/Users/mohyi/atlas/docs/atlas-execution-board.md`

## Repo role

`atlas` is the architecture decision cockpit projection for V3.

It owns:
- decision-first UI surfaces (Cockpit, Alerts, Domain, Portfolio, Evidence navigation)
- rendering and orchestration of canonical generated datasets
- operator-facing drill-down and audit navigation

It does not own:
- canonical business truth
- canonical write-paths
- canonical event semantics
- consumer-side business re-decision for shared domains

Doctrine is mandatory:
`Core decides. Projections explain. Apps render.`

## Active Linear anchors

- `MBE-1090` - ATLAS EPIC, cockpit refactor program
- `MBE-1091` - governance baseline (this bootstrap)
- `MBE-1092` - data contracts and compatibility
- `MBE-1093` - projection registry + consumer contract matrix
- `MBE-1094` - non-regression matrix and quality gates

Reference board is `/Users/mohyi/atlas/docs/atlas-execution-board.md`.

## Repo-specific rules

- Atlas is a rendering/projection repo, not a source-of-truth repo.
- If a canonical projection exists, Atlas must consume it and render it; no local recomputation of statuses/rules/priorities.
- If required data is missing, create/enrich upstream contract/projection work; do not invent fallback business logic in UI.
- Keep decision layer first and evidence layer second-level (do not mix proof payload into first-read decision cards).
- Keep local-first execution. Do not push/deploy/mutate remote systems unless explicitly requested.
- Any change touching shared read semantics must include contract impact (`patch|minor|major`) and compatibility proof.

## Human-Only and proposal routing

- Automation-first always: try MCP/CLI/scripts before declaring a blocker.
- `Human-Only` is valid only for irreducibly human-gated actions after automation attempts.
- Non-critical improvements go to `queue:codex-proposal`, not execution wave.
- Active wave remains proof-driven and minimal; avoid backlog noise.

## Autonomous Linear execution

Before each implementation batch:

1. Start from `/Users/mohyi/atlas/docs/atlas-execution-board.md`.
2. Query Linear (`team = MBE`) and filter Atlas work in this order:
   - board tickets
   - label `repo:atlas`
   - project `Atlas Decision Cockpit V3`
   - active anchors in this file
3. Continue current `In Progress` ticket first.
4. If none is in progress, pick the top unblocked `phase:now` issue.
5. If no actionable issue exists, report explicitly and stop.

## Mandatory 5-question gate

Before coding, answer explicitly:

1. Where is the canonical business truth?
2. What canonical write-path is authorized?
3. What canonical projection is consumed?
4. Which consumer is authorized?
5. What proof guarantees no local business recomputation?

If one answer is unclear, re-scope first.
