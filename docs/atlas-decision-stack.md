# Atlas Decision Stack

This document defines where Atlas execution decisions must come from, and in which order.

## Precedence order

1. Runtime system/developer instructions injected by Codex.
2. Global persistent instructions: `/Users/mohyi/.codex/AGENTS.md`.
3. Repo-local instructions: `/Users/mohyi/atlas/AGENTS.md`.
4. Repo-local anti-regression memory: `/Users/mohyi/atlas/tasks/lessons.md`.
5. Skills under `/Users/mohyi/.codex/skills/**/SKILL.md` only when task-matched.
6. Generated reports under `/Users/mohyi/mcp/generated/reports/` as evidence, never as policy.

## Atlas-first decision rules

- Start from the Atlas local board: `/Users/mohyi/atlas/docs/atlas-execution-board.md`.
- Do not start from arbitrary active tickets outside the board unless explicitly reprioritized.
- Keep execution local-first and proof-first.
- Keep Atlas aligned with: `Core decides. Projections explain. Apps render.`

## Mandatory architecture gate

Every non-trivial task must answer:

1. Canonical business truth location
2. Authorized canonical write-path
3. Canonical projection consumed by Atlas
4. Authorized consumer scope
5. Proof that Atlas does not recompute canonical business logic

If any answer is unclear, split/re-scope before implementation.

## Canonical references

- `/Users/mohyi/atlas/docs/projection-registry.md`
- `/Users/mohyi/atlas/docs/consumer-contract-matrix.md`
- `/Users/mohyi/mcp/docs/v3-architecture-and-linear-governance.md`
- `/Users/mohyi/mcp/docs/linear-v3-execution-board.md`
- `/Users/mohyi/mcp/docs/projection-registry.md`
- `/Users/mohyi/mcp/docs/consumer-contract-matrix.md`
- `/Users/mohyi/mcp/docs/domain-boundaries.md`
- `/Users/mohyi/mcp/docs/event-registry.md`
- `/Users/mohyi/mcp/generated/reports/linear-active-work-decision-pack-2026-03-06.md`

## Execution checklist (Atlas)

Before changing code/docs:

1. Verify what already exists in repo.
2. Identify what is missing (no duplication).
3. State exactly what will be created/modified.
4. Confirm target Linear ticket and dependencies.
5. Execute in small reversible batch.
6. Attach proof (lint/typecheck/tests/smoke/contracts as relevant).
