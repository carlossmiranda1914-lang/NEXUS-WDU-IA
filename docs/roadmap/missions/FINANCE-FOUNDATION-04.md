# FINANCE-FOUNDATION-04 — Journal Domain + Atomic Repository

**State:** READY_FOR_EXECUTION_AFTER_SCHEMA_ADJUDICATION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `2f09580f7814da2fa8b15d063d83f6df53f328b1`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 4 from the approved Finance Foundation plan: the minimum Journal domain + PostgreSQL repository needed to prove canonical atomic confirmation and append-only economic authority.

Tasks 1–3 are accepted predecessors. A Task 4 preflight STOP proved that the accepted Task 3 schema cannot faithfully represent all mandatory `ConfirmJournalInput` provenance. This Mission Pack therefore explicitly authorizes one minimal append-only schema amendment before the Journal behavioral RED.

Do not start Task 5 idempotency/concurrency orchestration beyond the minimum existing command-result linkage structurally required by the already-approved Task 4 transaction boundary.

## Accepted persistence note

Task 3 established that PostgreSQL typmods such as `NUMERIC(30,12)` silently round excessive fractional scale before a constraint can observe the original value. The accepted physical implementation remains:

- exact PostgreSQL `NUMERIC` storage;
- explicit scale/magnitude `CHECK` constraints preserving the F2 30/12 Money and 30/18 rate envelopes;
- no silent rounding.

Do not revert these columns to fixed-scale typmods in Task 4.

## Schema adjudication — explicitly authorized

The current `finance_journal_transactions` structure cannot preserve mandatory Task 4 provenance fields `commandId`, `journalType`, `actorPersonId`, `financialProfileVersion`, and optional `reason`.

If `0029` remains the next free migration number at execution preflight, create exactly:

- `src/db/migrations/0029_finance_journal_provenance.sql`

The migration may only add the minimum authoritative columns/constraints needed to represent the approved contract:

```text
command_id                TEXT NOT NULL
journal_type              TEXT NOT NULL CHECK in ('foundation_value_received','foundation_reversal')
actor_person_id            UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT
financial_profile_version INTEGER NOT NULL
reason                    TEXT NULL
```

and a tenant-safe profile-version relationship:

```text
FOREIGN KEY (institution_id, financial_profile_version)
  REFERENCES finance_profile_versions(institution_id, version)
  ON DELETE RESTRICT
```

Do not add command-level replay/uniqueness semantics here; Task 5 owns idempotency/concurrency behavior. Do not invent additional Journal fields. Do not rewrite migrations `0027` or `0028`.

Before creating production Journal code, add/extend a real PostgreSQL schema regression proving the new provenance columns and profile FK behave correctly. This schema amendment is part of Task 4 prerequisite completion, not a reopening of Task 3 architecture.

## Required method

Use strict TDD + real PostgreSQL stateful proof:

1. Synchronize the existing clean worktree to the current remote HEAD.
2. Re-run the approved local PostgreSQL safety preflight.
3. Confirm `0029` is the next free migration number.
4. Extend the PostgreSQL schema test first so it REDs on missing Task 4 provenance columns/constraints.
5. Create only the authorized append-only `0029_finance_journal_provenance.sql` and prove the schema RED turns GREEN.
6. Then write `tests/finance-journal-postgres.test.ts` before Journal production code.
7. Execute it and observe a valid RED because the Journal domain/repository implementation does not yet exist.
8. Implement the minimum Journal domain and repository only.
9. Prove atomicity with failure injection at each required stage on real PostgreSQL.
10. Run targeted Finance/PostgreSQL regressions + lint/build/diff gates.
11. Commit, push normally, record exact HEAD and stop before Task 5.

## Authorized files

Create:

- `src/db/migrations/0029_finance_journal_provenance.sql` only if `0029` remains next free at preflight;
- `src/modules/finance/journal-model.ts`
- `src/modules/finance/journal-repository.ts`
- `tests/finance-journal-postgres.test.ts`

May update:

- `tests/finance-foundation-schema-postgres.test.ts` only for the newly authorized provenance-schema proof;
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`
- `package.json` only if one narrowly-scoped Task 4 Finance test alias is required by the approved plan.

Read/integrate only unless another proved blocker requires adjudication:

- `src/modules/finance/money.ts`
- `src/modules/finance/exact-decimal.ts`
- `src/modules/finance/financial-context.ts`
- `src/db/migrations/0027_finance_foundation.sql`
- `src/db/migrations/0028_finance_exact_decimal_envelopes.sql`
- canonical PostgreSQL safety/migration helpers.

## Required domain contract

```ts
export type JournalStatus = 'prepared' | 'confirmed';
export type FoundationJournalType = 'foundation_value_received' | 'foundation_reversal';
export type FoundationPositionType = 'received_value' | 'reversed_value';

export interface JournalEntryDraft {
  positionType: FoundationPositionType;
  money: Money;
  sourceRef: string;
}

export interface ConfirmJournalInput {
  institutionId: string;
  commandId: string;
  journalType: FoundationJournalType;
  effectiveAt: Date;
  entries: readonly JournalEntryDraft[];
  reversesTransactionId?: string;
  reason?: string;
  actorPersonId: string;
  financialProfileVersion: number;
}

export interface JournalRepository {
  confirm(
    client: import('pg').PoolClient,
    input: ConfirmJournalInput,
  ): Promise<{ transactionId: string }>;

  getConfirmed(
    institutionId: string,
    transactionId: string,
  ): Promise<unknown | null>;
}
```

If the schema remains unable to faithfully represent this contract after the authorized `0029`, STOP rather than silently dropping provenance or inventing a substitute.

## Journal laws

- Confirmed economic facts are append-only historical authority.
- Prepared/non-confirmed state has zero canonical financial effect.
- Confirmation is server-authoritative and atomic.
- A confirmed transaction cannot be changed back to prepared/cancelled.
- Economic correction is not UPDATE/DELETE; later reversal work appends a new causal fact.
- Every entry has explicit position type; untyped signed amounts are forbidden.
- All entries in a foundation transaction must be compatible with the transaction's currency/economic semantics.
- Cross-currency Journal meaning is forbidden in this foundation slice unless the approved conversion-evidence contract is actually represented; do not invent implicit FX.
- Institution ownership comes from server-resolved authority; cross-tenant references remain impossible.
- No browser/provider/network call participates inside the canonical DB transaction.

## Atomic transaction boundary

For the foundation confirmation command, the same PostgreSQL transaction must include every required piece of authoritative state needed by the approved schema/contract:

- `finance_journal_transactions` row including mandatory provenance;
- complete `finance_journal_entries` set;
- required `finance_audit_records` row;
- required `finance_command_results` linkage if the Task 4 repository contract uses the already-created structural authority;
- mandatory `finance_outbox` intent.

Either the whole authoritative set commits or none does.

Do not perform external network/provider calls while holding the transaction open.

## Failure injection

A test-only seam is authorized:

```ts
type JournalFailurePoint =
  | 'after_transaction'
  | 'after_entries'
  | 'after_audit'
  | 'after_outbox';
```

Production default must inject nothing. The seam exists only to prove rollback and must not become product behavior.

For every failure point, PostgreSQL proof must show **zero surviving economic authority from that attempted confirmation**.

## Mandatory RED/GREEN proof

Real PostgreSQL tests must prove at minimum:

```text
missing Task 4 provenance schema
=> valid schema RED before migration 0029

valid provenance schema + tenant-safe profile version
=> schema GREEN after migration 0029

missing Journal implementation
=> valid behavioral RED before production code

valid same-tenant confirmation
=> one confirmed transaction + mandatory provenance + complete typed entry set + required audit/outbox state

prepared/non-confirmed row
=> no canonical confirmed read result

mixed currencies without conversion evidence
=> rejected before commit

untyped/unsupported position type
=> rejected

foreign-tenant transaction/profile reference attempt
=> rejected/fail closed

failure after transaction insert
=> rollback leaves zero attempted authority

failure after entries
=> rollback leaves zero attempted authority

failure after audit
=> rollback leaves zero attempted authority

failure after outbox
=> rollback leaves zero attempted authority

confirmed fact later destructive UPDATE/DELETE through approved repository API
=> no such operation exists / cannot be performed through repository contract
```

Do not substitute AST/source tests for rollback or database-state proof.

## Repository implementation rules

- Use one checked-out `PoolClient` supplied to the repository command.
- Use explicit `BEGIN`, `COMMIT`, `ROLLBACK` for the canonical confirmation boundary unless the existing repository transaction helper provides exactly equivalent semantics and is already canonical.
- On any exception before commit, rollback and rethrow a safe domain/infrastructure error.
- Never swallow rollback failure silently if it makes transaction state ambiguous; preserve the primary failure and record/propagate rollback failure according to repository conventions.
- Do not open nested independent DB connections for pieces of the same economic fact.
- Do not write projections directly as economic authority in this task.
- Do not implement Task 5 command-level retry/idempotency replay semantics yet.

## Required commands

Preflight:

```bash
git status --short
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-worktree.ps1 -ExpectedBranch codex/finance-foundation-01
git ls-files "src/db/migrations/*.sql"
```

Schema RED/GREEN:

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
```

Behavioral RED/GREEN:

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-journal-postgres.test.ts
```

Final proof:

```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-journal-postgres.test.ts
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
npm run test:migrations:isolated
npm run test:fnd01:cp2:local
npm run test:fnd03
npm run lint
npm run build
git diff --check
```

## STOP conditions

STOP and report without workaround if:

- `0029` is no longer the next free migration number;
- the minimum provenance amendment above still cannot represent the approved Task 4 contract;
- implementing faithful provenance requires additional architecture beyond these approved fields/relationships;
- exact Money would need conversion through JavaScript `number` or PostgreSQL floating-point;
- mixed-currency confirmation would require implicit FX;
- atomicity would require more than one independent database transaction;
- external/provider/network call would need to occur inside the transaction;
- tenant ownership cannot be proven using existing schema relationships;
- required audit/outbox authority cannot commit in the same transaction;
- a baseline PostgreSQL or quality gate fails outside Task 4 and cannot be safely classified.

## DONE definition

`FINANCE-FOUNDATION-04` is DONE only when:

- valid provenance-schema RED was observed and recorded;
- append-only migration `0029` (or re-adjudicated next-free number) is GREEN and preserves migration history;
- valid Journal behavioral RED was observed and recorded;
- Journal domain/repository files remain within authorized scope;
- real PostgreSQL happy-path confirmation preserves required provenance;
- all required failure-injection rollback proofs pass;
- tenant/currency/position/profile negative proofs pass;
- Task 3 exactness/schema regression remains GREEN;
- migration bootstrap/checksum regression remains GREEN;
- `npm run test:fnd03` PASS;
- `npm run lint` PASS;
- `npm run build` PASS;
- `git diff --check` PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 5 has not started.
