# NEXUS Project State

Updated: 2026-09-04

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
- Task 6 — Minimal Reversal + Remaining-Reversible Concurrency: `3e738704a66f88105f10edb02f517ba965db0d9e`, P0=0, P1=0.

Task 3 exactness decision remains canonical: exact PostgreSQL `NUMERIC` plus explicit scale/magnitude checks, not fixed-scale typmods that silently round excessive scale.

Task 5 owns the single canonical command-result/idempotency authority. Task 6 proves append-only reversal, exact remaining-reversible validation, tenant fail-closed behavior and PostgreSQL original-row locking under concurrent over-reversal.

## Active executable mission

- Mission: `FINANCE-FOUNDATION-07 — Projection + Recovery + Durable Outbox`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-07.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on exact implementation HEAD

Implementation authorization is limited to Task 7. Task 8 and upper Finance remain unauthorized.

## Current Task 7 objective

Prove recovery semantics from durable authority rather than process memory:

- implement one minimal confirmed-only Finance position projection;
- prepared/non-confirmed data contributes zero;
- confirmed original and reversal facts rebuild deterministic exact positions;
- projection destruction followed by rebuild produces the same canonical output;
- later/current policy/profile changes do not reinterpret confirmed historical result;
- mandatory outbox failure still rolls back the authoritative Journal set;
- pending outbox survives a fresh pool/consumer process boundary;
- claim/complete/fail behavior is durable and tenant-safe;
- concurrent claim behavior must be truthful under PostgreSQL persistence, never process-local memory.

## Required sequence

`DB safety -> Task 7 PostgreSQL RED -> minimum projection/outbox implementation -> confirmed-only GREEN -> destroy/rebuild equivalence -> historical reproducibility -> mandatory-outbox rollback -> fresh-pool restart recovery -> durable fail/retry -> concurrent claim proof or legitimate schema STOP -> Tasks 6/5/4/schema regressions -> migrations/FND01/FND03 -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 8`.

## Protected invariants

- Tasks 1–6 remain closed unless new concrete evidence proves regression.
- No broad re-audit or architecture reopening is authorized.
- No migration is authorized by default in Task 7.
- Journal remains canonical economic truth; projection is rebuildable read authority only.
- Projection cannot use legacy mutable balances, current policy/FX or browser state to reconstruct history.
- Money remains exact and currencies remain separate; no implicit FX.
- Mandatory outbox intent remains atomic with Journal confirmation.
- Restart/recovery depends on durable PostgreSQL state, not in-memory queue/session state.
- Tenant boundaries remain fail closed for projection and outbox operations.
- Confirmed Journal facts cannot be edited to make projection/delivery appear successful.
- If the accepted schema cannot truthfully represent durable concurrent claim/retry semantics, execution STOPs for adjudication instead of inventing an in-memory workaround.
- Task 7 does not implement provider delivery, Payment, Allocation, Reconciliation, fiscal/reporting or Finance UI.

## Engineering governance

The operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

For Task 7, projection rebuild, restart recovery and concurrent outbox claims require real disposable PostgreSQL evidence. Source inspection or AST/string tests cannot substitute for stateful proof.

A STOP must identify a concrete blocker/root cause. Do not weaken tests, durability, tenant isolation or recovery semantics to force progress.

## Deferred domains

- Finance Foundation: ACTIVE through Task 7.
- Task 8: NOT AUTHORIZED YET.
- Finance product domains beyond foundation: NOT STARTED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated product capability. Finance branch work remains non-integrated until the full approved Foundation gate and integration process complete.

## Next authorized action

Synchronize the existing clean `worktrees/finance-foundation-01` to the current remote branch HEAD and execute `FINANCE-FOUNDATION-07.md` only. Observe a valid Task 7 RED before production implementation. Stop before Task 8.
