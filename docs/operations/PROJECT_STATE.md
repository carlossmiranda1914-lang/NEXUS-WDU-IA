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

Task 5 owns the single canonical command-result/idempotency authority. Task 6 proves append-only reversal and PostgreSQL over-reversal concurrency safety.

## Active executable mission

- Mission: `FINANCE-FOUNDATION-07 — Projection + Recovery + Durable Outbox`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-07.md`
- Writer: Codex
- Reviewer: Antigravity READ-ONLY on exact implementation HEAD

Implementation authorization is limited to Task 7. Task 8 and upper Finance remain unauthorized.

## Task 7 prerequisite adjudication

The first Task 7 preflight correctly STOPped before implementation. Root cause was proven in the accepted `finance_outbox` schema: `attempts` and `completed_at` existed, but no persisted post-commit claim/lease state and no durable failure error provenance existed. PostgreSQL `SKIP LOCKED` alone protects only while the claiming transaction holds its row lock and therefore cannot represent an active claim after commit/restart.

This is classified `GENUINE_PREREQUISITE / SCHEMA_AUTHORITY_MISSING`, not a worker implementation defect and not an architecture reopening.

Explicit adjudication now authorizes one minimal append-only migration, only if `0030` remains the next free migration number:

`0030_finance_outbox_recovery.sql`

Authorized additions to `finance_outbox`:
- `claimed_at TIMESTAMPTZ NULL`;
- `claim_expires_at TIMESTAMPTZ NULL`;
- `last_error_code TEXT NULL`;
- lease consistency constraint requiring both claim timestamps together or neither, and expiry later than claim time.

No `claimed_by` field is required at foundation level: ownership is represented by a durable time-bounded lease. Existing `attempts` remains retry count authority. No provider/worker identity/product-delivery semantics are authorized.

Migrations `0027`–`0029` remain immutable.

## Current Task 7 objective

After schema RED→0030 GREEN, prove:
- confirmed-only exact projection;
- destroy/rebuild equivalence;
- historical reproducibility under later context change;
- mandatory outbox insertion failure rolls back the complete Journal authority set;
- pending outbox survives a fresh process/pool boundary;
- claim commits a durable lease before returning;
- concurrent claimers cannot receive the same active message;
- unexpired leases are skipped and expired leases recover;
- fail increments attempts, persists last_error_code, clears lease and permits controlled retry;
- complete is idempotent and completed rows never reappear.

## Required sequence

`DB safety -> verify 0030 free -> schema RED -> append-only 0030 -> schema GREEN -> Task 7 behavioral RED -> minimum projection/outbox implementation -> projection/rebuild/history proof -> mandatory-outbox rollback -> restart/retry/concurrent lease proof -> Tasks 6/5/4/schema regressions -> migrations/FND01/FND03 -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 8`.

## Protected invariants

- Tasks 1–6 remain closed unless concrete regression evidence appears.
- No broad audit or architecture reopening.
- Only the adjudicated `0030` migration is authorized; any further schema need is a new STOP.
- Journal remains canonical economic truth; projection remains rebuildable read authority only.
- Money remains exact; currencies remain separate; no implicit FX.
- Mandatory outbox intent remains atomic with Journal confirmation.
- Durable lease/retry state lives in PostgreSQL, never process memory.
- Confirmed Journal facts are never edited to make worker/projection state look successful.
- No provider/network delivery implementation is part of Task 7.
- Task 8 remains unauthorized.

## Engineering governance

Operating standard: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

The prior STOP is resolved by the smallest persistence amendment that directly addresses its proven root cause. Do not add speculative outbox features.

## Deferred domains

- Finance Foundation: ACTIVE through Task 7.
- Task 8: NOT AUTHORIZED YET.
- Finance product domains beyond foundation: NOT STARTED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated product capability. Finance branch work remains non-integrated until the full approved Foundation gate and integration process complete.

## Next authorized action

Synchronize the existing clean `worktrees/finance-foundation-01` to the current remote branch HEAD. Execute the adjudicated schema RED→`0030` GREEN first, then continue `FINANCE-FOUNDATION-07.md`. Stop before Task 8.
