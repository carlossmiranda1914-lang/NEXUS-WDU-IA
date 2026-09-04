# NEXUS Project State

Updated: 2026-09-04

## Integrated baseline

`main @ 3636c5054ce98a1f4f7990a5f7aafdde1ff22bcc` is the current integrated capability authority. Finance Foundation is integrated: Tasks 1–8 are DONE, P0 = 0 and P1 = 0. F1 implementation is NOT STARTED.

## Finance Foundation — closed

Finance Foundation Tasks 1–8 are integrated in `main` through PR #89.

Accepted exact Finance implementation/review checkpoint before merge:

`74d575a574bb4e3dd3cf9652327c6f1c665f393b`

Integration merge commit:

`3636c5054ce98a1f4f7990a5f7aafdde1ff22bcc`

Accepted outcome:

- P0 = 0
- P1 = 0
- P1-1 outbox tenant scope: CLOSED with explicit A/B PostgreSQL proof
- P1-2 guarded reversal confirmation: CLOSED
- aggregate Finance Foundation gate: PASS
- FND03 tenant regression: PASS
- lint/build/diff: PASS
- PR #89 CI: PASS
- Finance Foundation Integration Sync Gate: COMPLETE

The former Integration Sync Gate is closed. Do not rerun it and do not treat `codex/finance-foundation-01` as active implementation authority.

## Current stage — F1 preparation

- Program: `FINANCE`
- Stage: `FINANCE-F1-PREPARATION`
- State: `PLANNING`
- Implementation: `NOT STARTED / NOT AUTHORIZED`
- Active implementation branch: none
- Active F1 Mission Pack: none yet
- Owner: Product Owner

F1 preparation is a bounded product/architecture step whose purpose is to define and approve the first upper-Finance functional vertical from the integrated Foundation. It is not an executable production-code mission until the Product Owner approves a concrete F1 design/mission contract.

## Authorized next action

Define the first F1 functional vertical from the integrated `main` baseline. The preparation must establish its user-visible outcome, domain boundary, authority model, persistence/API/UI slice, tenant/auth rules, behavioral and PostgreSQL proof, UAT target, and explicit out-of-scope boundary. After approval, create the F1 Mission Pack and implementation plan/branch. Only then may production implementation begin.

## Protected Finance invariants

- Journal remains canonical economic truth.
- projection remains confirmed-only rebuildable read authority.
- exact Money and currency separation remain enforced.
- financial context remains server-authoritative and fail closed.
- idempotency, concurrency, reversal, recovery, durable outbox and tenant isolation remain PostgreSQL-backed.
- legacy `outstandingFees` remains non-canonical Finance authority.
- migration history remains immutable.
- Finance Foundation Tasks 1–8 are not reopened without concrete regression evidence and explicit authorization.

## Engineering governance

Operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

For F1, prefer one complete functional vertical per mission: domain authority -> persistence/API -> UI -> behavioral/negative proof -> UAT -> integration. Do not fragment normal completion steps into repeated Product Owner/Codex calls.

## Deferred domains

Until an F1 design is approved, Payment provider integration, Allocation/Reconciliation expansion, fiscal/statutory adapters, reporting/BI and later Finance verticals remain NOT STARTED / NOT AUTHORIZED except where explicitly selected as part of the approved first F1 vertical.

## Canonical versus branch work

Merged `main` is the integrated capability authority. The closeout branch exists only to make this canonical state explicit; it does not authorize F1 production code.
