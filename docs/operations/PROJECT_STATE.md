# NEXUS Project State

Updated: 2026-09-03

## Integrated baseline

`main @ f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e` remains the integrated capability authority. Existing Foundation/IAM/Enrollment/Academic/Student/ALUNOS capability remains unchanged. Finance Foundation is still branch-scoped and not integrated.

## Active product program

**FINANCE FOUNDATION — IMPLEMENTING, mission-scoped and not yet integrated.**

Accepted checkpoints:

- Task 1 — Monetary Primitives: `8202dee1cdc7bb6878cf5b044ad2a17eb29b4798`, P0=0, P1=0.
- Task 2 — Institution Financial Context: `49e5c06e9b5603cc814bffa047d9f009c2a10549`, P0=0, P1=0.
- Task 3 — Canonical Finance Persistence Schema: `2f09580f7814da2fa8b15d063d83f6df53f328b1`, P0=0, P1=0.
- Task 4 — Journal Domain + Atomic Repository: `2a84191c22abe31adb39af1e15748b0b48b4e9c8`, P0=0, P1=0.
- Task 5 — Canonical Command Idempotency + Concurrency: `6222eabe69cb76322551ba8bcdaea3a0ec2646fd`, P0=0, P1=0.

Task 3 exactness decision remains canonical: exact PostgreSQL `NUMERIC` plus explicit scale/magnitude checks, not fixed-scale typmods that silently round excessive scale.

Task 5 now owns the single canonical command-result/idempotency authority. Journal confirmation fingerprinting is typed, deterministic, includes material Journal semantics and excludes the idempotency key.

## Active executable mission

- Mission: `FINANCE-FOUNDATION-06 — Minimal Reversal + Remaining-Reversible Concurrency`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-06.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on exact implementation HEAD

Implementation authorization is limited to Task 6. Task 7+ and upper Finance remain unauthorized.

## Current Task 6 objective

Prove append-only reversal behavior and remaining-reversible concurrency safety:

- original confirmed Journal fact is never updated/deleted;
- reversal appends `foundation_reversal` / `reversed_value` fact with causal `reverses_transaction_id`;
- same institution and same currency required;
- requested reversal is strictly positive and <= exact remaining reversible amount;
- original row is locked with PostgreSQL `SELECT ... FOR UPDATE` while remaining amount is calculated;
- sequential 100 -> reverse 30 -> reverse 40 -> remaining 30 -> reject 31;
- concurrent 70/60 against remaining 100 cannot both commit;
- Task 5 idempotency remains the sole replay/concurrency authority for command identity.

## Required sequence

`DB safety -> Task 6 PostgreSQL RED -> minimum reversal implementation -> sequential partial reversal GREEN -> over-reversal negative -> real concurrent 70/60 proof -> Task 5 idempotency regression -> Task 4 Journal regression -> schema/migration regressions -> FND03 -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 7`.

## Protected invariants

- Tasks 1–5 remain closed unless new concrete evidence proves regression.
- No broad re-audit or architecture reopening is authorized.
- No migration is authorized by default in Task 6.
- Reversal is append-only; original confirmed authority is immutable.
- Remaining reversible is calculated from canonical confirmed Journal facts, not projections or browser state.
- PostgreSQL original-row lock is the concurrency protection for over-reversal; process memory cannot substitute.
- Money remains exact; no JavaScript-number or floating-point monetary authority.
- Tenant boundaries remain institution-scoped and fail closed.
- No provider/network call while Finance transaction/lock is held.
- Task 5 command-result/idempotency authority must not be duplicated or weakened.
- Task 6 does not implement recovery/projection, Payment, Allocation, Reconciliation, providers, fiscal/reporting or Finance UI.

## Engineering governance

The operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

For Task 6, over-reversal/concurrency claims require real disposable PostgreSQL evidence. Source inspection or AST/string tests cannot substitute for stateful proof.

A STOP must identify a concrete blocker/root cause. Do not weaken tests, safety, locking or authority boundaries to force progress.

## Deferred domains

- Finance Foundation: ACTIVE through Task 6.
- Task 7+: NOT AUTHORIZED YET.
- Finance product domains beyond foundation: NOT STARTED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated product capability. Finance branch work remains non-integrated until the full approved Foundation gate and integration process complete.

## Next authorized action

Synchronize the existing clean `worktrees/finance-foundation-01` to the current remote branch HEAD and execute `FINANCE-FOUNDATION-06.md` only. Observe a valid Task 6 RED before production implementation. Stop before Task 7.
