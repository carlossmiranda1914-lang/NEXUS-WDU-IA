# FINANCE-FOUNDATION-07 — Projection + Recovery + Durable Outbox

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `3e738704a66f88105f10edb02f517ba965db0d9e`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 7 from the approved Finance Foundation plan: one confirmed-only rebuildable Finance projection plus durable outbox claim/complete/fail primitives and restart/recovery proof.

Tasks 1–6 are accepted predecessors. Do not start Task 8 aggregate authority fence/final foundation gate.

## Required interfaces

```ts
export async function rebuildFoundationProjection(
  client: import('pg').PoolClient,
  institutionId: string,
): Promise<void>;

export async function readFoundationPosition(
  client: import('pg').PoolClient,
  institutionId: string,
): Promise<ReadonlyArray<{ currency: string; amount: string }>>;

export interface FinanceOutboxMessage {
  id: string;
  institutionId: string;
  topic: string;
  aggregateId: string;
  attempts: number;
}

export async function claimFinanceOutbox(
  client: import('pg').PoolClient,
  limit: number,
): Promise<FinanceOutboxMessage[]>;

export async function completeFinanceOutbox(
  client: import('pg').PoolClient,
  id: string,
): Promise<void>;

export async function failFinanceOutbox(
  client: import('pg').PoolClient,
  id: string,
  errorCode: string,
): Promise<void>;
```

## Authorized files

Create:
- `src/modules/finance/finance-projection.ts`
- `src/modules/finance/finance-outbox.ts`
- `tests/finance-projection-recovery-postgres.test.ts`

May update:
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`
- `package.json` only for a narrow Task 7 test alias if useful
- Task 4 Journal test only if a narrowly-scoped existing outbox-failure seam must be exercised for the mandatory-outbox rollback proof

Read/integrate only unless a proved blocker requires adjudication:
- accepted Journal, command, reversal and Money modules
- `src/db/migrations/0027_finance_foundation.sql`
- `src/db/migrations/0028_finance_exact_decimal_envelopes.sql`
- `src/db/migrations/0029_finance_journal_provenance.sql`
- canonical DB safety/migration helpers

No migration is authorized by default. If the existing outbox/projection schema cannot faithfully support the approved durable claim/retry/restart contract without ambiguity or duplicate active claims, STOP and report the exact missing persistence invariant before any migration.

## Projection laws

- Projection is derived read authority only; Journal remains canonical economic truth.
- Only confirmed Journal facts contribute.
- Prepared/non-confirmed rows contribute exactly zero.
- `foundation_value_received / received_value` contributes positive exact Money.
- `foundation_reversal / reversed_value` subtracts exact Money from current position.
- Cross-currency values remain separate rows; no implicit FX.
- Rebuild is deterministic from persisted historical authority only.
- Rebuild must not consult current institution policy, current FX, browser state, legacy balances or transient process memory.
- Destroying projection rows must not destroy economic truth.
- Rebuild after projection destruction must reproduce byte-equivalent canonical `{currency, amount}` output.
- Current policy/profile/registry changes after confirmation must not reinterpret confirmed historical result.

## Durable outbox laws

- Mandatory outbox intent is committed atomically with the Journal fact; existing Task 4 atomicity must remain intact.
- Consumer delivery occurs after commit and cannot mutate/rollback confirmed Journal truth.
- Pending work is discovered from PostgreSQL, not an in-memory queue.
- Claiming must be safe for concurrent workers and must not produce overlapping active claims if the approved persistence model supports durable claim ownership.
- Completion is idempotent: completing an already completed message does not create another delivery authority.
- Failure/retry increments durable attempt state and leaves the message recoverable.
- `errorCode` must not be silently discarded if the approved persistence contract requires durable failure provenance. If current schema cannot represent the required approved semantics faithfully, STOP rather than hiding the value in process memory.
- A fresh Pool/consumer instance after simulated restart must recover pending work.
- No network/provider call occurs while canonical Finance transaction/locks are held.

## Mandatory TDD / PostgreSQL proof

### 1. Confirmed-only projection RED/GREEN

Prove on real disposable PostgreSQL:

```text
prepared/non-confirmed data
=> contributes zero

confirmed 100 EUR original
=> projection 100 EUR

confirmed 30 EUR reversal
=> projection 70 EUR

second currency confirmed fact
=> independent currency row; no implicit FX
```

### 2. Destroy/rebuild equivalence

1. Build/read expected projection.
2. Delete only `finance_position_projection` rows for the test institution.
3. Confirm Journal/history remains unchanged.
4. Call `rebuildFoundationProjection`.
5. Assert canonical read output is byte/deep equivalent to the pre-destroy expected output.

### 3. Historical reproducibility

After confirmed history exists, change current/non-historical context that must not reinterpret the fact (for example a later Financial Profile version/effective setting). Rebuild again and prove the historical projection result is unchanged.

Do not mutate the historical profile/version referenced by the confirmed fact merely to manufacture this test.

### 4. Mandatory-outbox atomicity

Exercise a real PostgreSQL failure of the mandatory outbox insert during Journal confirmation and prove:
- no confirmed Journal fact survives;
- no entries/audit/command-result authority survives from that attempt.

Reuse the existing failure-injection architecture if sufficient; do not add a second transaction authority.

### 5. Restart/recovery

1. Confirm a fact with a pending durable outbox row.
2. Dispose/release the first consumer/pool context as the simulated process lifetime.
3. Create a fresh pool/consumer instance.
4. Claim pending message from PostgreSQL.
5. Complete it.
6. Prove it is not returned as pending again.

### 6. Failure/retry

Claim a pending message, call `failFinanceOutbox`, and prove durable attempt state increases and the work remains eligible for controlled retry according to the implemented contract.

### 7. Concurrent claim safety

If the existing schema can support it faithfully, run two concurrent worker claims against the same pending set and prove no same message is simultaneously awarded to both workers. If durable non-overlapping claim semantics require persistence fields absent from the accepted schema, this is a STOP condition, not permission to emulate ownership in memory.

## Implementation rules

- Use exact `Money`/canonical decimal strings for projection arithmetic; never JavaScript `number` for economic amounts.
- Prefer rebuilding inside one explicit PostgreSQL transaction so readers never observe a partially rebuilt institution projection where practical.
- Tenant scope is mandatory on every projection/outbox mutation/read.
- Claim SQL should use PostgreSQL concurrency primitives appropriate to the approved schema (for example row locking / `SKIP LOCKED`) only when they provide truthful durable semantics.
- Do not turn projection into canonical balance authority.
- Do not modify confirmed Journal facts during projection/outbox recovery.
- Do not implement Payment, Allocation, Reconciliation, provider delivery, fiscal/reporting or UI.

## Required commands

Preflight:
```bash
git status --short
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-worktree.ps1 -ExpectedBranch codex/finance-foundation-01
```

RED/GREEN:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-projection-recovery-postgres.test.ts
```

Final proof:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-projection-recovery-postgres.test.ts
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-reversal-concurrency-postgres.test.ts
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-idempotency-concurrency-postgres.test.ts
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
- existing outbox schema cannot represent the approved durable claim/failure/retry semantics faithfully;
- a migration is required;
- projection rebuild needs legacy mutable balance fields or current policy/FX to recreate historical truth;
- projection arithmetic would require JavaScript `number` or PostgreSQL floating-point authority;
- consumer correctness depends on process-local memory/locks;
- concurrent workers can receive the same active claim with no durable arbitration;
- required downstream failure would require editing/rolling back confirmed Journal facts;
- tenant-safe outbox/projection access cannot be proven;
- a baseline PostgreSQL/quality gate fails outside Task 7 and cannot be safely classified.

## DONE definition

`FINANCE-FOUNDATION-07` is DONE only when:
- valid RED observed and recorded;
- confirmed-only projection proof passes;
- destroy/rebuild equivalence passes;
- historical reproducibility under later context change passes;
- mandatory-outbox failure still rolls back the authoritative Journal set;
- pending outbox survives simulated process restart;
- claim/complete/fail behavior is durable and tenant-safe;
- concurrent claim safety is proved or the mission correctly STOPs for missing schema authority;
- Tasks 1–6 regressions remain GREEN;
- schema/migration regressions remain GREEN;
- lint/build/diff gates PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 8 has not started.
