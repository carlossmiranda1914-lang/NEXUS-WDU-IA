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
- Task 3 — Canonical Finance Persistence Schema: `2f09580f7814da2fa8b15d063d83f6df53f328b1`, P0=0, P1=0.

Task 3 persistence decision: PostgreSQL fixed-scale `NUMERIC(p,s)` was proven to silently round excessive fractional scale. The accepted physical mapping is exact `NUMERIC` plus explicit scale/magnitude CHECK constraints enforcing the F2 Money 30/12 and rate 30/18 envelopes. Future work must not revert this to a typmod that reintroduces silent rounding.

The active executable mission is:

- Mission: `FINANCE-FOUNDATION-04 — Journal Domain + Atomic Repository`
- Branch: `codex/finance-foundation-01`
- Mission Pack: `docs/roadmap/missions/FINANCE-FOUNDATION-04.md`
- Spec: `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
- Plan: `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
- Writer: Codex
- Reviewer: Antigravity, READ-ONLY on the exact implementation HEAD

Implementation authorization remains limited to Task 4. Task 5+ and upper Finance domains remain unauthorized.

## Task 4 schema adjudication

Task 4 preflight correctly STOPped before RED because the accepted Task 3 `finance_journal_transactions` table could not preserve mandatory approved provenance from `ConfirmJournalInput`: `commandId`, `journalType`, `actorPersonId`, `financialProfileVersion`, and optional `reason`.

This is adjudicated as a local persistence-contract gap, not a reopening of F0-F4 or Task 3 architecture.

A single append-only migration is now explicitly authorized, provided migration preflight still finds `0029` as the next free number:

- `src/db/migrations/0029_finance_journal_provenance.sql`

It may add only:

- `command_id TEXT NOT NULL`;
- `journal_type TEXT NOT NULL` constrained to the two approved foundation Journal types;
- `actor_person_id UUID NOT NULL` referencing canonical `people(id)` with `ON DELETE RESTRICT`;
- `financial_profile_version INTEGER NOT NULL`;
- nullable `reason TEXT`;
- tenant-safe `(institution_id, financial_profile_version)` FK to `finance_profile_versions(institution_id, version)` with `ON DELETE RESTRICT`.

No Task 5 idempotency/replay uniqueness is authorized in this migration. Migrations `0027` and `0028` remain immutable.

## Current authorized sequence

`DB safety + migration preflight -> schema RED for missing provenance -> append-only 0029 -> schema GREEN -> Journal behavioral RED -> minimum Journal domain/repository -> PostgreSQL atomic happy path -> failure-injection rollback proofs -> tenant/currency/position/profile negatives -> Task 3 schema regression -> migration bootstrap/checksum regression -> lint -> build -> git diff --check -> checkpoint -> STOP before Task 5`.

## Task 4 protected invariants

- mandatory Journal provenance is stored authoritatively, not hidden only in audit metadata;
- financial profile provenance is tenant-safe by institution + version;
- confirmed Journal facts are append-only economic authority;
- prepared/non-confirmed state has zero canonical financial effect;
- confirmation is server-authoritative and atomic;
- transaction, complete entries, required audit and mandatory outbox intent commit in one PostgreSQL transaction or none survive;
- every entry has explicit economic position type;
- implicit FX is forbidden;
- Money remains exact and never crosses authoritative boundaries as JavaScript `number`;
- institution ownership remains server-derived and tenant-safe;
- destructive correction of confirmed facts is forbidden; correction is later append-only economic fact;
- no provider/network call occurs inside the canonical DB transaction;
- Task 4 does not implement Task 5 command replay/idempotency concurrency semantics.

## Explicitly forbidden in the current task

- Task 5 or later Finance Foundation implementation;
- any migration beyond the explicitly adjudicated minimal Journal provenance amendment;
- command-level idempotency/replay/concurrency behavior;
- Payment, Allocation, Reconciliation, providers, fiscal/reporting or Finance UI;
- implicit FX;
- JavaScript-number or PostgreSQL floating-point monetary authority;
- UPDATE/DELETE correction of confirmed economic facts;
- external network/provider calls inside Finance DB transaction;
- runtime business DDL or alternate migration authority;
- unrelated IAM, Enrollment or ALUNOS refactor;
- parallel writer or automatic scope expansion.

## Engineering governance

The canonical engineering operating model remains active: Risk -> Proof -> Tool -> DONE, one writer per authority unit, SHA-bound handoffs, TDD/stateful proof for implementation, independent review, root-cause discipline and truthful evidence.

For Task 4, source inspection cannot substitute for schema or atomicity proof. The provenance FK and rollback behavior require real disposable PostgreSQL execution.

STOP conditions remain binding. A STOP must be resolved by root cause, concrete external dependency or actual architecture/product escalation; tests/configuration may not be weakened to force progress.

## Deferred domains

- Finance Foundation: ACTIVE through `FINANCE-FOUNDATION-04`.
- Finance Foundation Task 5+: NOT AUTHORIZED YET.
- Finance product domains beyond the approved foundation: NOT STARTED.
- Assessment: NOT STARTED.
- Attendance: NOT STARTED.
- Physical document storage/upload: separate future work.

## Canonical versus branch work

Only merged `main` commits are integrated product capability. The Finance mission branch contains authorized implementation work but remains non-integrated until its gates and merge are complete. Chat/session history is not canonical project memory.

## Recovery entrypoint

Resume by reading, in order: `AGENTS.md`, `docs/README.md`, this file, `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`, the active Mission Pack/spec/plan and the applicable execution adapter. Then verify Git reality before editing.

## Next authorized action

Resume `FINANCE-FOUNDATION-04` in the existing clean isolated worktree on branch `codex/finance-foundation-01`.

Synchronize to current remote HEAD, run the canonical local PostgreSQL safety bootstrap, confirm `0029` remains next free, then extend the schema PostgreSQL test first and observe the provenance RED. Only then create the explicitly authorized `0029_finance_journal_provenance.sql`. After schema GREEN, proceed to the Journal behavioral RED and Task 4 implementation.

Do not start Task 5.
