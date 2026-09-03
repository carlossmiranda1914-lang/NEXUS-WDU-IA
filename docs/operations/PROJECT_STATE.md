# NEXUS Project State

Updated: 2026-09-03

## Integrated baseline

`main @ f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e` remains the integrated capability authority. Foundation Authority Convergence, IAM/institutional access, Enrollment authority, Academic Core, Student 360 and ALUNOS Product Integrity are integrated. PR #87 is merged and ALUNOS must not be reopened by the Finance mission.

## Active product program

**FINANCE FOUNDATION — IMPLEMENTING, mission-scoped and not yet integrated.**

Product Owner approval has closed Finance Foundation design F0-F4 and approved the implementation specification and implementation plan. The active executable mission is:

- Mission: `FINANCE-FOUNDATION-01 — Monetary Primitives`
- Branch: `codex/finance-foundation-01`
- Implementation base: `13872571bf44dc74ffaaf815992317e8ead50f3f`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-01.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on the exact implementation HEAD

Implementation authorization is limited to the active mission and current Task 1. It does not authorize the complete Finance product.

## Current authorized task

Task 1 may create only:

- `src/modules/finance/exact-decimal.ts`
- `src/modules/finance/money.ts`
- `src/modules/finance/currency-registry.ts`
- `src/modules/finance/finance-rates.ts`
- `src/modules/finance/quantization.ts`
- `tests/finance-money-model.test.ts`

The required execution sequence is `RED -> minimal implementation -> GREEN -> lint -> build -> git diff --check -> checkpoint`.

No production code may be written before the expected RED is observed and recorded. Task 2 and later tasks remain unauthorized until Task 1 passes its gate and the mission flow advances.

## Explicitly forbidden in the current task

- Finance PostgreSQL migrations;
- Journal/repository/command implementation;
- Financial Profile persistence;
- Payment, Allocation, Reconciliation, provider, fiscal/reporting or Finance UI work;
- legacy Finance data mutation;
- server route changes;
- runtime business DDL;
- unrelated refactors;
- historical migration modification;
- parallel writer or automatic scope expansion.

## Engineering governance

The canonical engineering operating model remains active: Risk -> Proof -> Tool -> DONE, one writer per authority unit, SHA-bound handoffs, TDD for implementation, independent review, root-cause discipline and truthful evidence.

For Finance Foundation specifically:

- authoritative Money may not use binary floating point;
- cross-currency arithmetic may not perform implicit FX;
- browser/provider/AI/Excel are not Finance authority;
- later PostgreSQL, tenant, concurrency and recovery claims require their real stateful proof;
- STOP conditions are binding and may not be bypassed by weakening tests/configuration.

## Deferred domains

- Finance Foundation: ACTIVE through `FINANCE-FOUNDATION-01`.
- Finance product domains beyond the approved foundation: NOT STARTED.
- Assessment: NOT STARTED.
- Attendance: NOT STARTED.
- Physical document storage/upload: separate future work.

## Canonical versus branch work

Only merged `main` commits are integrated product capability. The Finance mission branch contains authorized implementation work but remains non-integrated until its gates and merge are complete. Chat/session history is not canonical project memory.

## Recovery entrypoint

Resume by reading, in order: `AGENTS.md`, `docs/README.md`, this file, `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`, the active Mission Pack/spec/plan, and the applicable execution adapter. Then verify Git reality before editing.

## Next authorized action

Resume `FINANCE-FOUNDATION-01` in the existing clean isolated worktree on branch `codex/finance-foundation-01`.

The next action is **Task 1 TDD RED only**: create `tests/finance-money-model.test.ts`, execute `npx tsx tests/finance-money-model.test.ts`, verify the failure is the expected missing Finance monetary module/behavior, record that RED, and only then begin the minimal production implementation.

Do not start Task 2.