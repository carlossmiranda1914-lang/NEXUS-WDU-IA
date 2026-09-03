# NEXUS Project State

Updated: 2026-09-03

## Integrated baseline

`main @ f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e` remains the integrated capability authority. Foundation Authority Convergence, IAM/institutional access, Enrollment authority, Academic Core, Student 360 and ALUNOS Product Integrity are integrated. PR #87 is merged and ALUNOS must not be reopened by the Finance mission.

## Active product program

**FINANCE FOUNDATION — IMPLEMENTING, mission-scoped and not yet integrated.**

Product Owner approval has closed Finance Foundation design F0-F4 and approved the implementation specification and implementation plan.

Accepted predecessor checkpoints:

- Task 1 — Monetary Primitives: `8202dee1cdc7bb6878cf5b044ad2a17eb29b4798`, P0=0, P1=0.
- Task 2 — Institution Financial Context: `49e5c06e9b5603cc814bffa047d9f009c2a10549`, P0=0, P1=0.

The active executable mission is now:

- Mission: `FINANCE-FOUNDATION-03 — Canonical Finance Persistence Schema`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-03.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on the exact implementation HEAD

Implementation authorization is limited to Task 3. It does not authorize Task 4 or the complete Finance product.

## Current authorized task

Task 3 may create only the canonical Finance foundation persistence migration and its real PostgreSQL schema test, plus the approved incremental package test alias and execution record update.

Execution preflight on 2026-09-03 found `0026` as the latest migration and `0027` as the next free canonical migration number. The implementation must re-check this immediately before editing. If it remains true, the authorized migration path is:

- `src/db/migrations/0027_finance_foundation.sql`

Task 3 must prove its persistence claims against the repository-approved disposable PostgreSQL target. `TEST_DATABASE_LOCAL_AUTHORIZED=true` is required explicitly for the authorized local stateful commands; credentials must not be printed or committed.

The required sequence is:

`migration preflight -> PostgreSQL RED -> canonical append-only migration -> PostgreSQL GREEN/negative integrity proofs -> isolated migration bootstrap -> checksum/history regression -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 4`.

## Task 3 protected invariants

- the existing canonical migration runner remains the sole schema authority;
- historical migrations remain immutable;
- authoritative Finance Money persists exactly as `NUMERIC(30,12)` and rates as `NUMERIC(30,18)` where represented;
- authoritative monetary/rate fields never use PostgreSQL floating-point types;
- tenant-safe parent/child ownership is enforced by database relationships where structurally expressible;
- idempotency identity is institution-scoped and request fingerprint is required;
- Journal lifecycle timestamps and structural reversal relations fail closed;
- runtime business DDL and alternate Finance migration runners are forbidden;
- Task 3 does not implement Journal command behavior, Payment, Allocation, Reconciliation, providers, fiscal/reporting or Finance UI.

## Explicitly forbidden in the current task

- Task 4 or later Finance Foundation implementation;
- Journal repository or Finance command implementation;
- Payment, Allocation, Reconciliation, provider, fiscal/reporting or Finance UI work;
- legacy Finance data reinterpretation;
- runtime business DDL;
- alternate migration authority;
- historical migration modification or renumbering;
- unrelated IAM, Enrollment or ALUNOS refactor;
- parallel writer or automatic scope expansion;
- bypassing PostgreSQL safety authorization.

## Engineering governance

The canonical engineering operating model remains active: Risk -> Proof -> Tool -> DONE, one writer per authority unit, SHA-bound handoffs, TDD/stateful proof for implementation, independent review, root-cause discipline and truthful evidence.

For Task 3, source inspection cannot substitute for PostgreSQL proof. Claims about migrations, numeric envelopes, tenant-safe FKs, idempotency uniqueness, rollback/history and structural integrity require execution against the approved disposable PostgreSQL target.

STOP conditions are binding. A STOP must be resolved by root cause, a concrete external dependency, or an actual architecture/product escalation; tests/configuration may not be weakened to force progress.

## Deferred domains

- Finance Foundation: ACTIVE through `FINANCE-FOUNDATION-03`.
- Finance Foundation Task 4+: NOT AUTHORIZED YET.
- Finance product domains beyond the approved foundation: NOT STARTED.
- Assessment: NOT STARTED.
- Attendance: NOT STARTED.
- Physical document storage/upload: separate future work.

## Canonical versus branch work

Only merged `main` commits are integrated product capability. The Finance mission branch contains authorized implementation work but remains non-integrated until its gates and merge are complete. Chat/session history is not canonical project memory.

## Recovery entrypoint

Resume by reading, in order: `AGENTS.md`, `docs/README.md`, this file, `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`, the active Mission Pack/spec/plan, and the applicable execution adapter. Then verify Git reality before editing.

## Next authorized action

Resume `FINANCE-FOUNDATION-03` in the existing clean isolated worktree on branch `codex/finance-foundation-01`.

First synchronize to the current remote HEAD and repeat migration-number preflight. If `0027` remains the next free migration, create the Task 3 PostgreSQL test first and execute the authorized RED with `TEST_DATABASE_LOCAL_AUTHORIZED=true`. Only after a valid RED may the canonical Finance migration be created.

Do not start Task 4.
