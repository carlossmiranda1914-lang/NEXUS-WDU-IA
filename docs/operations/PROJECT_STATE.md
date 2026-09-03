# NEXUS Project State

Updated: 2026-09-04

## Integrated baseline

`main @ f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e` remains the integrated capability authority. Existing Foundation/IAM/Enrollment/Academic/Student/ALUNOS capability remains unchanged. Finance Foundation remains branch-scoped and is not integrated yet.

## Active product program

**FINANCE FOUNDATION — FINAL IMPLEMENTATION GATE ACTIVE, NOT YET INTEGRATED.**

Accepted task checkpoints:
- Task 1 — Monetary Primitives: `8202dee1cdc7bb6878cf5b044ad2a17eb29b4798`, P0=0, P1=0.
- Task 2 — Institution Financial Context: `49e5c06e9b5603cc814bffa047d9f009c2a10549`, P0=0, P1=0.
- Task 3 — Canonical Finance Persistence Schema: `2f09580f7814da2fa8b15d063d83f6df53f328b1`, P0=0, P1=0.
- Task 4 — Journal Domain + Atomic Repository: `2a84191c22abe31adb39af1e15748b0b48b4e9c8`, P0=0, P1=0.
- Task 5 — Canonical Command Idempotency + Concurrency: `6222eabe69cb76322551ba8bcdaea3a0ec2646fd`, P0=0, P1=0.
- Task 6 — Minimal Reversal + Remaining-Reversible Concurrency: `3e738704a66f88105f10edb02f517ba965db0d9e`, P0=0, P1=0.
- Task 7 — Projection + Recovery + Durable Outbox: `ff5b91e40d756dcf9f2363c487386f08c972c9e5`, P0=0, P1=0.

Task 7 is closed. Its accepted proof includes confirmed-only exact projection, destroy/rebuild equivalence, durable PostgreSQL outbox retry, persisted failure provenance, fresh-pool recovery, concurrent claim safety and lease-expiry recovery.

## Active executable mission

- Mission: `FINANCE-FOUNDATION-08 — Legacy Authority Fence + Aggregate Foundation Gate`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-08.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity READ-ONLY after exact implementation checkpoint

Task 8 is the final implementation/verification task of this Finance Foundation plan. It is not authorization for upper Finance product domains.

## Current Task 8 objective

Prove that the accepted Tasks 1–7 form one coherent Foundation and that legacy mutable finance/convenience balances cannot become or modify canonical economic truth.

Required outcome:
- discover the real repository/runtime legacy balance path rather than inventing one;
- behaviorally prove legacy mutation cannot change confirmed Finance Journal facts or rebuilt/read canonical position;
- prove Finance authority modules do not consume legacy mutable balance as economic input;
- create deterministic fail-fast `test:finance:foundation` aggregate over the complete Finance proof set;
- run fresh aggregate PostgreSQL evidence plus migration/checksum, tenant-isolation, lint, build and diff gates;
- checkpoint exact HEAD and STOP for independent review.

## Required sequence

`clean preflight -> discover real legacy balance path -> Task 8 RED -> minimal authority-fence proof (production fence only if RED proves a real defect) -> deterministic aggregate runner -> fresh test:finance:foundation -> migrations/FND01/FND03 -> lint -> build -> git diff --check -> commit/push/remote coherence -> STOP -> independent exact-HEAD review`.

## Protected invariants

- Tasks 1–7 remain closed unless Task 8 produces concrete regression evidence.
- Journal remains canonical economic truth.
- Projection remains confirmed-only rebuildable read authority.
- Legacy `outstandingFees` or equivalent mutable fields are not Finance Foundation authority.
- Legacy values are never imported into confirmed Journal history merely to reconcile old UI state.
- Exact Money, financial context, idempotency, reversal concurrency, tenant isolation and durable recovery remain unchanged.
- No new migration is authorized in Task 8.
- No new Finance product behavior is authorized.
- No Payment, Allocation, Reconciliation, provider, fiscal/reporting or UI work is authorized.
- Aggregate gate must fail closed and preserve child failures.
- A branch-level GREEN is not an integration claim.

## STOP conditions

STOP rather than broaden scope if:
- a real legacy write changes canonical Journal/projection authority;
- fixing the defect requires broad production refactor or schema change;
- any Task 1–7 aggregate regression appears;
- migration/checksum or tenant isolation regresses;
- passing would require weakening a test/safety gate;
- upper Finance product semantics become necessary.

## Engineering governance

Operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

Task 8 closes implementation evidence; it does not self-approve integration. After a clean Task 8 checkpoint, the next required action is independent READ-ONLY exact-HEAD review and then Product Owner integration adjudication.

## Deferred domains

- Finance Foundation: ACTIVE at Task 8 final gate.
- Upper Finance product domains: NOT STARTED / NOT AUTHORIZED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated product capability. Finance branch work remains non-integrated until exact-HEAD review and explicit integration/merge complete.

## Next authorized action

Synchronize the existing clean `worktrees/finance-foundation-01` to current `origin/codex/finance-foundation-01`, execute `FINANCE-FOUNDATION-08.md` only, checkpoint and STOP for independent exact-HEAD review. Do not merge automatically.
