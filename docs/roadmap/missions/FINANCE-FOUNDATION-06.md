# FINANCE-FOUNDATION-06 — Minimal Reversal + Remaining-Reversible Concurrency

**State:** READY_FOR_EXECUTION
**Branch:** `codex/finance-foundation-01`
**Accepted predecessor HEAD:** `6222eabe69cb76322551ba8bcdaea3a0ec2646fd`
**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`
**Plan:** `docs/superpowers/plans/2026-09-03-finance-foundation-implementation.md`
**Execution record:** `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`

## Mission

Implement only Task 6 from the approved Finance Foundation plan: append-only reversals plus real PostgreSQL proof that concurrent reversal attempts cannot over-reverse an original confirmed transaction.

Tasks 1–5 are accepted predecessors. Do not start Task 7 recovery/projection/outbox-consumer work.

## Required interface

```ts
export interface ReverseFoundationTransactionInput {
  institutionId: string;
  originalTransactionId: string;
  amount: Money;
  reason: string;
  actorPersonId: string;
  effectiveAt: Date;
  financialProfileVersion: number;
}
```

Task 6 may add the minimum reversal command/helper around the accepted Journal + canonical command boundary, but must preserve a single idempotency authority from Task 5.

## Authorized files

Modify only as required:
- `src/modules/finance/journal-model.ts`
- `src/modules/finance/journal-repository.ts`
- `src/modules/finance/finance-command.ts`

Create:
- `tests/finance-reversal-concurrency-postgres.test.ts`

May update:
- `.superpowers/sdd/2026-09-03-finance-foundation/progress.md`
- `package.json` only for a narrow Task 6 test alias if useful

No migration is authorized by default. Existing reversal schema/tenant-safe FK must be used. If schema is insufficient, STOP and report the exact missing invariant before any migration.

## Reversal laws

- Reversal is a new confirmed Journal fact; original confirmed rows remain unchanged.
- No UPDATE/DELETE correction of confirmed economic facts.
- Reversal must reference the original transaction causally through `reverses_transaction_id`.
- Original and reversal must be same institution and same currency.
- Reversal amount must be strictly positive and may not exceed the currently remaining reversible amount.
- Remaining reversible amount = original confirmed amount minus sum of already confirmed valid reversals referencing that original.
- A reversal of a prepared/non-confirmed/nonexistent/foreign-tenant transaction fails closed.
- Reason is required and must not be blank.
- Reversal uses `foundation_reversal` + `reversed_value` semantics already accepted by Task 4.
- Canonical fingerprint for reversal must cover the already-approved material reversal semantics and remain independent of idempotency key.
- Task 5 database-arbitrated idempotency remains authoritative; do not create another replay/concurrency mechanism.

## Mandatory TDD / PostgreSQL proof

### Sequential RED/GREEN

Create an original confirmed `100 EUR` fact through the canonical path.

Then prove:

```text
reverse 30 EUR
=> commit append-only reversal

reverse 40 EUR
=> commit append-only reversal

remaining reversible
=> 30 EUR

attempt reverse 31 EUR
=> reject; zero extra reversal fact

original transaction row
=> byte/field authority remains unchanged
```

### Concurrent over-reversal proof

Against an original with `100 EUR` remaining, launch two concurrent reversal commands with distinct legitimate idempotency identities:

- reversal A = `70 EUR`
- reversal B = `60 EUR`

Exactly one may commit if committing both would make total reversed exceed `100 EUR`.

Postcondition must prove:
- confirmed reversal sum `<= 100 EUR` exactly;
- no partial authority from rejected attempt;
- no duplicate command-result authority;
- original remains unchanged.

## Required concurrency strategy

Use deterministic database locking/CAS as specified by the plan:

1. Inside the same PostgreSQL transaction, lock the smallest authoritative original transaction row with `SELECT ... FOR UPDATE`.
2. Verify original is confirmed, same institution and eligible.
3. Calculate already confirmed reversal sum from canonical Journal rows while the original lock is held.
4. Validate same currency and `requested <= remaining` using exact Money semantics.
5. Append the new reversal through the accepted Journal transaction path.
6. Keep Task 5 command-result/idempotency authority in the same atomic boundary.
7. Commit or rollback all authority together.

Never hold the DB lock across external/provider/network calls. Do not use in-memory mutex/process lock for correctness.

## Required negatives

Real PostgreSQL tests must cover at least:
- nonexistent original;
- foreign-tenant original;
- prepared/non-confirmed original;
- currency mismatch;
- zero/negative reversal amount;
- blank reason;
- reversal greater than remaining;
- concurrent over-reversal;
- replay of same reversal identity does not create a second reversal;
- same idempotency identity with changed reversal semantics conflicts.

## Required commands

Preflight:
```bash
git status --short
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-worktree.ps1 -ExpectedBranch codex/finance-foundation-01
```

RED/GREEN:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-reversal-concurrency-postgres.test.ts
```

Final proof:
```bash
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
- existing schema cannot represent faithful append-only reversal semantics;
- a migration is required;
- remaining reversible amount cannot be protected with the approved original-row lock strategy;
- Task 5 idempotency authority would need duplication or weakening;
- exact amount comparison would require JavaScript `number` or PostgreSQL floating point;
- concurrency correctness would rely on process-local locks;
- reversal would require modifying/deleting original confirmed facts;
- a baseline PostgreSQL/quality gate fails outside Task 6 and cannot be safely classified.

## DONE definition

`FINANCE-FOUNDATION-06` is DONE only when:
- valid RED observed and recorded;
- sequential partial reversal proof passes;
- over-reversal rejects with zero extra fact;
- original confirmed authority remains unchanged;
- concurrent 70/60 proof passes with total confirmed reversal <= original exactly;
- negative tenant/currency/lifecycle/amount/reason cases pass;
- Task 5 replay/fingerprint semantics remain GREEN;
- Task 4 atomicity remains GREEN;
- schema/migration regressions remain GREEN;
- lint/build/diff gates PASS;
- worktree is clean after commit;
- exact commit SHA is pushed and recorded;
- Task 7 has not started.
