# NEXUS Project State

Updated: 2026-09-04

## Integrated baseline

`main @ 3636c5054ce98a1f4f7990a5f7aafdde1ff22bcc` is the current integrated capability authority. Finance Foundation is integrated: Tasks 1–8 are DONE, P0 = 0 and P1 = 0. F1 implementation is NOT STARTED.

## Finance Foundation accepted implementation state

Finance Foundation Tasks 1–8 are implementation-complete and independently reviewed on branch `codex/finance-foundation-01`.

Accepted exact Finance review checkpoint before sync:

`74d575a574bb4e3dd3cf9652327c6f1c665f393b`

Independent review outcome at that checkpoint:

- P0 = 0
- P1 = 0
- P1-1 outbox tenant scope: CLOSED with explicit A/B PostgreSQL proof
- P1-2 guarded reversal confirmation: CLOSED
- aggregate Finance Foundation gate: PASS
- FND03 tenant regression: PASS
- lint/build/diff: PASS

PR #89 CI is PASS and the Product Owner has authorized the Finance-to-`main` merge. Finance Foundation Tasks 1–8 are accepted with P0 = 0 and P1 = 0. Upper Finance/F1 remains NOT STARTED until that merge is confirmed.

## Active executable mission

- Mission: `FINANCE FOUNDATION — Integration Sync Gate`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-INTEGRATION-GATE.md`
- Writer: Codex
- Reviewer: independent READ-ONLY after synchronized checkpoint if needed
- Current `origin/main` authority at authorization: `e7ab85a1382cd8ac042a344d574ec25e967e80d9`

The Integration Sync Gate is authorized to merge `origin/main` **into the Finance branch only**, using a normal merge commit, then run fresh blocking Finance/integration gates.

It is **not** authorization to merge Finance into `main` automatically and is not authorization for upper Finance product work.

## Required sequence

`clean preflight -> fetch origin -> confirm origin/main -> merge origin/main into codex/finance-foundation-01 -> classify conflicts -> STOP on technical/authority conflict -> reconcile bounded governance-only conflicts if applicable -> fresh Finance aggregate -> migrations/FND01/FND03 -> lint -> build -> git diff --check -> push synchronized branch -> remote coherence -> STOP for Product Owner integration decision`.

## Protected invariants

- Finance Foundation accepted semantics at `95dd350c872229a222eead5d88d79a13776c5955` remain unchanged unless a real integration conflict proves otherwise.
- Journal remains canonical economic truth.
- projection remains confirmed-only rebuildable read authority.
- exact Money, financial context, idempotency, reversal concurrency, durable outbox and tenant isolation remain PostgreSQL-backed/fail-closed.
- legacy `outstandingFees` remains non-canonical Finance authority.
- migration history remains immutable.
- no new migration or Finance table is authorized.
- no Payment, Allocation, Reconciliation, provider, fiscal/reporting or Finance UI work is authorized.
- no force push or published-history rebase.
- no merge from Finance branch into `main` during this mission.

## Conflict rule

STOP before resolving any merge conflict that touches:

- Finance authority code;
- migrations;
- tenant/auth context;
- database initialization or migration authority;
- shared runtime behavior with material Finance impact.

Pure governance/documentation conflicts may be reconciled narrowly to current truth while preserving the accepted Finance status.

## Engineering governance

Operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

This mission is integration preparation only. A synchronized branch-level GREEN still does not equal integrated `main`.

## Deferred domains

- Finance Foundation: ACCEPTED, INTEGRATION SYNC ACTIVE.
- Upper Finance product domains: NOT STARTED / NOT AUTHORIZED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated capability. The Finance branch remains non-integrated until explicit Product Owner integration decision and merge complete.

## Next authorized action

Synchronize the clean `worktrees/finance-foundation-01` with the current remote branch, execute `FINANCE-FOUNDATION-INTEGRATION-GATE.md`, merge `origin/main` into the Finance branch only, run the required fresh gates and STOP before any merge to `main`.
