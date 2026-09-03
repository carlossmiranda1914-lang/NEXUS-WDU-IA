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

Task 3 exactness decision remains canonical: exact PostgreSQL `NUMERIC` plus explicit scale/magnitude checks, not fixed-scale typmods that silently round excessive scale.

Task 4 established real PostgreSQL atomic confirmation of Journal transaction, complete entries, audit, structural command-result linkage and outbox, including rollback failure injection. Its command-result `request_fingerprint` value is explicitly provisional: Task 5 owns final canonical fingerprint/idempotency semantics.

## Active executable mission

- Mission: `FINANCE-FOUNDATION-05 — Canonical Command Idempotency + Concurrency`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-05.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on exact implementation HEAD

Implementation authorization is limited to Task 5. Task 6+ and upper Finance remain unauthorized.

## Current Task 5 objective

Create one canonical command/idempotency authority that:

- scopes identity by institution + operation namespace + idempotency key;
- uses deterministic SHA-256 fingerprint over server-canonical semantic input;
- replays same identity/same fingerprint without duplicate economic fact;
- rejects same identity/different fingerprint without duplicate economic fact;
- relies on PostgreSQL uniqueness as final concurrency arbiter;
- allows distinct keys with identical economic content as distinct legitimate commands;
- recovers persisted result after lost response;
- preserves Task 4 Journal atomicity.

Task 4's provisional use of `commandId` as `request_fingerprint` must not survive as final semantics or become a second authority.

## Required sequence

`DB safety -> Task 5 PostgreSQL RED -> canonical fingerprint + command boundary -> sequential replay/conflict GREEN -> real concurrent same-identity proof -> distinct-key proof -> lost-response recovery -> Task 4 Journal regression -> schema/migration regressions -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 6`.

## Protected invariants

- Tasks 1–4 remain closed unless new concrete evidence proves regression.
- No broad re-audit or architecture reopening is authorized.
- No migration is authorized by default in Task 5.
- PostgreSQL uniqueness remains final concurrency arbiter; process memory cannot substitute.
- Exactly one command-result authority may exist after integration.
- Journal fact + entries + audit + command result + outbox remain atomic.
- Money remains exact; no JavaScript-number or floating-point monetary authority.
- Tenant boundaries remain institution-scoped and fail closed.
- No provider/network call inside the canonical DB transaction.
- Task 5 does not implement reversals, Payment, Allocation, Reconciliation, providers, fiscal/reporting or Finance UI.

## Engineering governance

The operating standard remains: **priority clear, no useless cycles, no silent scope expansion, no false GREEN, advance immediately once sufficient evidence exists.**

For Task 5, concurrency/replay/lost-response claims require real disposable PostgreSQL evidence. Source inspection or AST/string tests cannot substitute for stateful proof.

A STOP must identify a concrete blocker/root cause. Do not weaken tests, safety or authority boundaries to force progress.

## Deferred domains

- Finance Foundation: ACTIVE through Task 5.
- Task 6+: NOT AUTHORIZED YET.
- Finance product domains beyond foundation: NOT STARTED.
- Assessment/Attendance/other roadmap domains: unchanged.

## Canonical versus branch work

Only merged `main` is integrated product capability. Finance branch work remains non-integrated until the full approved Foundation gate and integration process complete.

## Next authorized action

Synchronize the existing clean `worktrees/finance-foundation-01` to the current remote branch HEAD and execute `FINANCE-FOUNDATION-05.md` only. Observe a valid Task 5 RED before production implementation. Stop before Task 6.
