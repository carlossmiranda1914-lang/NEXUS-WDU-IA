# FINANCE-FOUNDATION-07 — Projection + Recovery + Durable Outbox

**State:** READY_FOR_EXECUTION_AFTER_SCHEMA_ADJUDICATION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `3e738704a66f88105f10edb02f517ba965db0d9e`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 7 from the approved Finance Foundation plan: one confirmed-only rebuildable Finance projection plus durable outbox claim/complete/fail primitives and restart/recovery proof.

Tasks 1–6 are accepted predecessors. A Task 7 preflight STOP proved that the accepted `finance_outbox` schema cannot represent a durable post-commit claim lease or durable failure provenance. This Mission Pack therefore explicitly authorizes one minimal append-only schema amendment before Task 7 behavioral implementation.

Do not start Task 8 aggregate authority fence/final foundation gate.

## Schema adjudication — explicitly authorized

If `0030` remains the next free migration number at execution preflight, create exactly:

- `src/db/migrations/0030_finance_outbox_recovery.sql`

The migration may add only the minimum durable recovery state needed by the approved Task 7 contract:

```text
claimed_at       TIMESTAMPTZ NULL
claim_expires_at TIMESTAMPTZ NULL
last_error_code  TEXT NULL
```

Required structural law:

- active lease state is represented by both `claimed_at` and `claim_expires_at` together, or neither;
- `claim_expires_at > claimed_at` when a lease exists;
- completion must not require deleting the row;
- no process-local ownership state becomes authoritative;
- no provider-delivery-specific columns or product semantics are authorized.

`claimed_by` is not required by this foundation interface because claim ownership is represented as a durable time-bounded lease rather than worker identity. Do not invent worker identity semantics merely to fill a column.

The existing `attempts` column remains the durable retry counter. `last_error_code` preserves the approved failure provenance required by `failFinanceOutbox(errorCode)`.

Do not rewrite migrations `0027`–`0029`.

## Required interfaces

```ts
export async function rebuildFoundationProjection(client: import('pg').PoolClient, institutionId: string): Promise<void>;
export async function readFoundationPosition(client: import('pg').PoolClient, institutionId: string): Promise<ReadonlyArray<{ currency: string; amount: string }>>;

export interface FinanceOutboxMessage {
  id: string;
  institutionId: string;
  topic: string;
  aggregateId: string;
  attempts: number;
}

export async function claimFinanceOutbox(client: import('pg').PoolClient, limit: number): Promise<FinanceOutboxMessage[]>;
export async function completeFinanceOutbox(client: import('pg').PoolClient, id: string): Promise<void>;
export async function failFinanceOutbox(client: import('pg').PoolClient, id: string, errorCode: string): Promise<void>;
```

## Authorized files

Create:
- `src/db/migrations/0030_finance_outbox_recovery.sql` only if `0030` remains next free at preflight;
- `src/modules/finance/finance-projection.ts`
- `src/modules/finance/finance-outbox.ts`
- `tests/finance-projection-recovery-postgres.test.ts`

May update:
- `tests/finance-foundation-schema-postgres.test.ts` only for the newly authorized outbox-recovery schema proof;
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`
- `package.json` only for a narrow Task 7 test alias if useful;
- Task 4 Journal test only if a narrow existing outbox-failure seam must be exercised for mandatory-outbox rollback proof.

Read/integrate only unless another proved blocker requires adjudication:
- accepted Journal, command, reversal and Money modules;
- migrations `0027`–`0029`;
- canonical DB safety/migration helpers.

## Required method

1. Synchronize the existing clean worktree to current remote HEAD.
2. Run approved DB safety/bootstrap.
3. Confirm `0030` is still the next free migration number.
4. Extend the real PostgreSQL schema test first so it REDs on missing lease/failure-provenance fields/constraints.
5. Create only `0030_finance_outbox_recovery.sql`; turn the schema RED GREEN.
6. Then write `tests/finance-projection-recovery-postgres.test.ts` before Task 7 production modules.
7. Observe a valid behavioral RED.
8. Implement only the minimum projection/outbox primitives.
9. Prove restart/retry/concurrent-claim semantics on real PostgreSQL.
10. Run regressions/gates and stop before Task 8.

## Projection laws

- Projection is derived read authority only; Journal remains canonical economic truth.
- Only confirmed Journal facts contribute; prepared/non-confirmed rows contribute zero.
- `foundation_value_received / received_value` contributes positive exact Money.
- `foundation_reversal / reversed_value` subtracts exact Money.
- Cross-currency values remain separate rows; no implicit FX.
- Rebuild is deterministic from persisted historical authority only.
- Rebuild must not consult current policy, current FX, browser state, legacy balances or process memory.
- Destroy/rebuild must reproduce byte/deep-equivalent canonical `{currency, amount}` output.
- Later/current profile/policy changes must not reinterpret confirmed historical result.

## Durable outbox laws

- Mandatory outbox intent remains atomic with Journal confirmation.
- Delivery/consumer processing occurs after commit and cannot mutate Journal truth.
- Pending work is discovered from PostgreSQL only.
- A successful claim commits a durable lease (`claimed_at`, `claim_expires_at`) so another worker/restart cannot immediately claim the same active message.
- An expired lease becomes eligible for recovery.
- `claimFinanceOutbox` must use PostgreSQL arbitration (`FOR UPDATE SKIP LOCKED` or equivalent) and persist the lease before returning messages.
- `completeFinanceOutbox` is idempotent, sets `completed_at`, and clears active lease state.
- `failFinanceOutbox` increments durable `attempts`, stores `last_error_code`, clears active lease state and leaves the message retryable.
- Completed rows are never claimable again.
- No in-memory queue/mutex/lease is correctness authority.
- No network/provider call occurs while canonical Finance DB transaction/locks are held.

## Mandatory PostgreSQL proofs

### Schema RED/GREEN

Prove missing lease/failure fields before `0030`, then after migration prove:
- fields exist with correct types;
- partial lease state is rejected;
- expired/valid lease interval constraints behave correctly;
- historical migrations remain immutable.

### Projection

```text
prepared/non-confirmed => zero contribution
confirmed 100 EUR original => 100 EUR
confirmed 30 EUR reversal => 70 EUR
second currency => independent row
projection delete + rebuild => identical canonical output
later profile/current-setting change => rebuild unchanged
```

### Mandatory-outbox atomicity

A real outbox insertion failure during Journal confirmation must leave zero confirmed Journal/entries/audit/command-result authority from that attempt.

### Restart/recovery

Confirm a fact with pending outbox, dispose the first process/pool context, create a fresh pool/consumer, claim from PostgreSQL, complete, and prove it is not pending again.

### Failure/retry

Claim a pending row, fail it, prove:
- `attempts` increments exactly;
- `last_error_code` persists;
- lease clears;
- row is eligible for later controlled retry.

### Concurrent claim safety

Two concurrent claimers against the same pending row/set must never both receive the same active message. Commit the claim lease before returning. Also prove an unexpired leased row is skipped and an expired leased row is recoverable.

## Implementation rules

- Use exact `Money`/canonical decimal strings; never JS `number` for economic arithmetic.
- Prefer projection rebuild in one explicit PostgreSQL transaction where practical.
- Tenant scope is mandatory on projection/outbox reads and mutations.
- Do not turn projection into canonical balance authority.
- Do not modify confirmed Journal facts during projection/outbox recovery.
- Do not implement provider delivery, Payment, Allocation, Reconciliation, fiscal/reporting or UI.

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
- `0030` is not the next free migration number;
- the three adjudicated fields/constraints remain insufficient for truthful durable claim/retry semantics;
- implementation requires worker identity/product delivery semantics beyond the approved lease model;
- projection rebuild needs legacy balances/current policy/FX to recreate history;
- projection arithmetic would require JS `number` or PostgreSQL floating point;
- consumer correctness depends on process memory;
- tenant-safe outbox/projection access cannot be proven;
- a baseline PostgreSQL/quality gate fails outside Task 7 and cannot be safely classified.

## DONE definition

`FINANCE-FOUNDATION-07` is DONE only when:
- schema RED and append-only `0030` GREEN are recorded;
- behavioral RED is recorded;
- confirmed-only projection proof passes;
- destroy/rebuild equivalence passes;
- historical reproducibility passes;
- mandatory-outbox rollback passes;
- pending work survives simulated restart;
- claim/complete/fail are durable and tenant-safe;
- concurrent claim and lease-expiry recovery are proved;
- Tasks 1–6 regressions remain GREEN;
- migration/schema regressions remain GREEN;
- lint/build/diff gates PASS;
- worktree is clean after commit;
- exact pushed SHA is recorded;
- Task 8 has not started.
