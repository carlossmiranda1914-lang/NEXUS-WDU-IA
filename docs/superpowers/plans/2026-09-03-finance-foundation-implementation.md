# Finance Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prove the minimum server-authoritative Finance foundation required by approved F0–F4: exact Money, institution financial context, operational Journal, atomic/idempotent PostgreSQL persistence, reversal/concurrency proof, durable recovery and rebuildable projections.

**Architecture:** Add a focused `src/modules/finance` domain with exact-decimal primitives and Finance repositories/commands. Extend the existing canonical PostgreSQL migration chain; do not add a second schema authority. No Payment, Allocation, Reconciliation, provider, fiscal/reporting or Finance UI product work is part of this plan.

**Tech Stack:** TypeScript 5.8, Node/tsx, Express integration patterns, `pg` PostgreSQL client, existing `src/db/migration-runner.ts`, Firebase-backed InstitutionalContext resolved by backend, Node `node:test`/`assert`, real disposable PostgreSQL safety gate.

**Spec:** `docs/superpowers/specs/2026-09-03-finance-foundation-implementation-design.md`

## Global Constraints

- Execute from an isolated git worktree created at execution time; record exact `BASE_SHA` before Task 1.
- Writer: Codex. Reviewer: Antigravity READ-ONLY on exact task/final HEAD.
- F0–F4 decisions are immutable architecture for this mission; STOP instead of weakening them.
- No authoritative monetary use of JavaScript `number`, PostgreSQL REAL/FLOAT/DOUBLE, locale-formatted numeric text or implicit FX.
- Money envelope: max 30 total digits / 12 fractional digits. DecimalRatio and ExchangeRate: max 30 / 18.
- No runtime business DDL; use only canonical migrations through `src/db/migration-runner.ts`.
- No direct browser/AI/provider/Excel write to Journal authority.
- No external network/provider call while canonical Finance DB transaction/locks are held.
- No final Payment, Allocation, Reconciliation, Financial Account, Obligation, provider, fiscal/reporting or UI implementation.
- PostgreSQL/tenant/concurrency claims require real disposable PostgreSQL proof; AST/source tests are supplementary only.
- Use `TEST_DATABASE_LOCAL_AUTHORIZED=true` only with the repository safety gate and approved disposable target.
- Every task ends with targeted tests, affected regression gates, `git diff --check`, and a commit.

---

## Planned file structure

Create a focused Finance module rather than adding logic to `server.ts` or unrelated domain files.

```text
src/modules/finance/
  exact-decimal.ts                 # bounded exact decimal parser/normalizer/arithmetic
  money.ts                         # Money value + strict same-currency behavior
  currency-registry.ts             # controlled in-process snapshot interface
  finance-rates.ts                 # DecimalRatio, Percentage, ExchangeRate
  quantization.ts                  # explicit rounding + deterministic distribution
  financial-context.ts             # Institution Financial Profile resolver contract
  journal-model.ts                 # transaction/entry/lifecycle/causal domain types
  journal-repository.ts            # PostgreSQL atomic persistence/replay queries
  finance-command.ts               # idempotent canonical command execution boundary
  finance-projection.ts            # minimal rebuildable confirmed-only projection
  finance-outbox.ts                # durable outbox read/claim/complete primitives
src/db/migrations/
  0030_finance_foundation.sql      # foundation tables/constraints; use 0030 only if free at execution preflight

tests/
  finance-money-model.test.ts
  finance-financial-context.test.ts
  finance-foundation-schema-postgres.test.ts
  finance-journal-postgres.test.ts
  finance-idempotency-concurrency-postgres.test.ts
  finance-reversal-concurrency-postgres.test.ts
  finance-projection-recovery-postgres.test.ts
  finance-foundation-authority-fence.test.ts
scripts/
  run-finance-foundation.mjs       # deterministic aggregate gate
```

If `0030` is occupied at execution preflight, STOP before editing and assign the next free migration number in the mission record; never rewrite/renumber an applied migration.

---

### Task 1: Exact decimal, Money and typed financial decimals

**Files:**
- Create: `src/modules/finance/exact-decimal.ts`
- Create: `src/modules/finance/money.ts`
- Create: `src/modules/finance/currency-registry.ts`
- Create: `src/modules/finance/finance-rates.ts`
- Create: `src/modules/finance/quantization.ts`
- Create: `tests/finance-money-model.test.ts`

**Interfaces:**
- Produces:
```ts
export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';
export class ExactDecimal {
  static parse(input: string, maxPrecision: number, maxScale: number): ExactDecimal;
  static fromParts(coefficient: bigint, scale: number, maxPrecision: number, maxScale: number): ExactDecimal;
  toCanonicalString(): string;
  add(other: ExactDecimal): ExactDecimal;
  subtract(other: ExactDecimal): ExactDecimal;
  multiply(other: ExactDecimal, maxPrecision: number, maxScale: number): ExactDecimal;
  quantize(scale: number, mode: RoundingMode): ExactDecimal;
  compare(other: ExactDecimal): -1 | 0 | 1;
}

export interface CurrencyDefinition { code: string; minorUnit: number; status: 'active'|'historical'|'special'; registryVersion: string; }
export interface CurrencyRegistry { require(code: string): CurrencyDefinition; }
export const canonicalCurrencyRegistry: CurrencyRegistry;

export class Money {
  static parse(amount: string, currency: string, registry?: CurrencyRegistry): Money;
  readonly amount: ExactDecimal;
  readonly currency: string;
  canonicalAmount(): string;
  serialize(): { amount: string; currency: string };
  equals(other: Money): boolean;
  add(other: Money): Money;
  subtract(other: Money): Money;
  compare(other: Money): -1|0|1;
}

export class DecimalRatio { static parse(value: string): DecimalRatio; readonly value: ExactDecimal; }
export class Percentage { static parsePercent(value: string): Percentage; toRatio(): DecimalRatio; }
export class ExchangeRate { static create(baseCurrency: string, quoteCurrency: string, rate: string, registry?: CurrencyRegistry): ExchangeRate; }
export function quantizeMoneyCandidate(amount: ExactDecimal, currency: string, scale: number, mode: RoundingMode, registry?: CurrencyRegistry): Money;
export function distributeMoney(total: Money, count: number, scale: number, mode: RoundingMode): Money[];
```

- [ ] **Step 1: Write RED tests for parsing and normalization**

Add tests asserting all of these exact outcomes:

```ts
assert.equal(Money.parse('001.2300', 'EUR').canonicalAmount(), '1.23');
assert.equal(Money.parse('-0.00', 'EUR').canonicalAmount(), '0');
assert.deepEqual(Money.parse('1.0', 'EUR').serialize(), Money.parse('1.00', 'EUR').serialize());
assert.throws(() => Money.parse('1e3', 'EUR'));
assert.throws(() => Money.parse('1,20', 'EUR'));
assert.throws(() => Money.parse('1.20', 'ZZZ'));
assert.throws(() => Money.parse('1234567890123456789012345678901', 'EUR'));
assert.throws(() => Money.parse('0.1234567890123', 'EUR'));
```

- [ ] **Step 2: Run RED test**

Run: `npx tsx tests/finance-money-model.test.ts`
Expected: FAIL because Finance primitives do not exist.

- [ ] **Step 3: Implement `ExactDecimal` using bigint coefficient + scale**

Implementation rules:

```ts
// canonical internal invariant after construction:
// scale >= 0; coefficient has no removable trailing base-10 zeros;
// coefficient === 0n => scale === 0;
// accepted input grammar: /^[+-]?(?:0|[0-9]+)(?:\.[0-9]+)?$/
```

Do not convert through `Number`. Count precision from decimal digits, normalize trailing zeros, reject over-envelope values before returning.

- [ ] **Step 4: Implement Money and Currency Registry**

Seed only controlled foundation definitions needed by tests (`EUR`, `AOA`, `USD`, `GBP`) with explicit registry version such as `iso4217-foundation-v1`; do not infer institution enablement here.

Cross-currency `add/subtract/compare` must throw a typed/domain error; `equals` returns false for different currency and exact normalized equality for same currency.

- [ ] **Step 5: Implement typed ratio/rate and quantization**

`ExchangeRate.create()` rejects `rate <= 0`, same input is normalized, direction is part of identity. `Percentage.parsePercent('15').toRatio()` must represent `0.15` rather than `15`.

`distributeMoney(Money.parse('100.00','EUR'),3,2,'half_up')` must return deterministic parts that sum exactly to `100 EUR` and differ by no more than one quantum.

- [ ] **Step 6: Add arithmetic/quantization RED→GREEN assertions**

Include same-currency arithmetic, cross-currency rejection, 30/12 + 30/18 boundaries, negative-zero elimination, normalization idempotency, percentage semantics, ExchangeRate direction, rate `<=0` rejection and exact remainder conservation.

- [ ] **Step 7: Verify task gate**

Run:
```bash
npx tsx tests/finance-money-model.test.ts
npm run lint
npm run build
git diff --check
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/finance tests/finance-money-model.test.ts
git commit -m "feat(finance): add exact monetary primitives"
```

---

### Task 2: Institution Financial Context minimum

**Files:**
- Create: `src/modules/finance/financial-context.ts`
- Create: `tests/finance-financial-context.test.ts`
- Read/integrate: `src/auth/institutional-context.ts`

**Interfaces:**
```ts
export interface InstitutionFinancialProfileVersion {
  institutionId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  primaryJurisdiction: string;
  functionalCurrency: string;
  financialTimezone: string;
  monetaryPolicyVersion: string;
  enabledCurrencies: readonly string[];
}

export interface FinancialProfileStore {
  resolveEffective(institutionId: string, at: Date): Promise<InstitutionFinancialProfileVersion | null>;
}

export async function requireFinancialContext(input: {
  institutionalContext: { institutionId: string; personId: string; role: string };
  effectiveAt: Date;
  store: FinancialProfileStore;
  requiredCurrency?: string;
}): Promise<InstitutionFinancialProfileVersion>;
```

- [ ] **Step 1: Write RED policy tests**

Prove: no profile => fail closed; expired/not-yet-effective => fail closed; requested currency not enabled => fail closed; matching effective profile => returned unchanged; institution ID comes only from resolved InstitutionalContext input.

- [ ] **Step 2: Run RED**

Run: `npx tsx tests/finance-financial-context.test.ts`
Expected: FAIL missing module.

- [ ] **Step 3: Implement context resolver**

No country/provider/currency defaults. Validate functional currency and enabled currencies through `canonicalCurrencyRegistry`.

- [ ] **Step 4: Verify**

Run:
```bash
npx tsx tests/finance-financial-context.test.ts
npm run test:fnd03
npm run lint
git diff --check
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/financial-context.ts tests/finance-financial-context.test.ts
git commit -m "feat(finance): add institutional financial context contract"
```

---

### Task 3: Canonical Finance persistence schema

**Files:**
- Create: `src/db/migrations/0030_finance_foundation.sql` (only if 0030 is free at execution preflight)
- Create: `tests/finance-foundation-schema-postgres.test.ts`
- Modify: `package.json` to add `test:finance:money`, `test:finance:schema`, later aggregate aliases incrementally.

**Interfaces / schema contract:**
Create these tables with institution-scoped keys/constraints:

```text
finance_profile_versions
finance_journal_transactions
finance_journal_entries
finance_command_results
finance_audit_records
finance_outbox
finance_position_projection
```

Required structural rules:
- UUID/text identity pattern follows repository convention discovered during execution preflight.
- authoritative amounts use `NUMERIC(30,12)`; rates use `NUMERIC(30,18)`.
- Journal/entry currency is canonical three-letter uppercase code with CHECK.
- composite `(institution_id, id)` uniqueness exists where child tables need tenant-safe FK.
- entry parent FK includes `institution_id`.
- idempotency uniqueness includes `(institution_id, operation_namespace, idempotency_key)`.
- `request_fingerprint` NOT NULL.
- confirmed transaction requires `confirmed_at`; non-confirmed cannot carry confirmed timestamp.
- reversal fields have structural checks and same-institution target FK.
- no `deleted_at` on confirmed Journal facts.
- outbox references same institution + Journal transaction where applicable.

- [ ] **Step 1: Write RED PostgreSQL schema test**

Use `verifyApprovedTestConnection()` / existing disposable DB pattern. Assert table/column types from `information_schema`, then attempt and reject: orphan entry, cross-tenant parent relation, invalid currency string, duplicate scoped idempotency key, out-of-envelope numeric value.

- [ ] **Step 2: Run RED**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
```
Expected: FAIL because migration/tables absent.

- [ ] **Step 3: Implement migration through canonical chain**

Do not modify `src/db/migration-runner.ts` unless a proved runner defect blocks canonical behavior. Do not add alternate setup scripts that issue Finance DDL.

- [ ] **Step 4: Prove clean bootstrap + schema negatives**

Run:
```bash
npm run test:migrations:isolated
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-foundation-schema-postgres.test.ts
npm run test:fnd01:cp2:local
```
Expected: PASS including checksum/history behavior.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations tests/finance-foundation-schema-postgres.test.ts package.json
git commit -m "feat(finance): add canonical foundation persistence schema"
```

---

### Task 4: Journal domain and atomic repository

**Files:**
- Create: `src/modules/finance/journal-model.ts`
- Create: `src/modules/finance/journal-repository.ts`
- Create: `tests/finance-journal-postgres.test.ts`

**Interfaces:**
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
  confirm(client: import('pg').PoolClient, input: ConfirmJournalInput): Promise<{ transactionId: string }>;
  getConfirmed(institutionId: string, transactionId: string): Promise<unknown | null>;
}
```

- [ ] **Step 1: Write RED domain tests inside PostgreSQL integration file**

Prove typed position required, prepared rows have no balance effect, confirmed entry set is complete, mixed currency without conversion evidence is rejected, and foreign institution entry relation is rejected.

- [ ] **Step 2: Add failure-injection seam**

Repository test constructor may accept test-only hook:

```ts
type JournalFailurePoint = 'after_transaction'|'after_entries'|'after_audit'|'after_outbox';
```

Production default is no hook. Tests inject each point and assert zero surviving economic rows after rollback.

- [ ] **Step 3: Implement transaction boundary**

Use one checked-out `PoolClient` and explicit `BEGIN/COMMIT/ROLLBACK`. Journal transaction, complete entries, required audit row, command result linkage and mandatory outbox intent commit together for this foundation command.

- [ ] **Step 4: Verify atomicity**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-journal-postgres.test.ts
npm run lint
git diff --check
```
Expected: PASS for happy path and every failure point.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/journal-model.ts src/modules/finance/journal-repository.ts tests/finance-journal-postgres.test.ts
git commit -m "feat(finance): add atomic operational journal"
```

---

### Task 5: Canonical command idempotency and concurrency

**Files:**
- Create: `src/modules/finance/finance-command.ts`
- Create: `tests/finance-idempotency-concurrency-postgres.test.ts`

**Interfaces:**
```ts
export interface FinanceCommandIdentity {
  institutionId: string;
  operationNamespace: string;
  idempotencyKey: string;
  canonicalFingerprint: string;
}

export async function executeIdempotentFinanceCommand<T>(input: {
  pool: import('pg').Pool;
  identity: FinanceCommandIdentity;
  execute: (client: import('pg').PoolClient) => Promise<{ resultRef: string; result: T }>;
  loadResult: (client: import('pg').PoolClient, resultRef: string) => Promise<T>;
}): Promise<{ replayed: boolean; result: T }>;
```

Fingerprint uses SHA-256 over server-canonical JSON assembled from normalized Money and stable command fields; object key order must be deterministic.

- [ ] **Step 1: Write RED sequential replay tests**

Same identity + same fingerprint => one Journal transaction and `replayed=true` on retry. Same key + different fingerprint => conflict and no second Journal transaction.

- [ ] **Step 2: Write RED concurrent tests**

Launch two promises against the same approved PostgreSQL target with the same identity. Assert exactly one committed command result and one Journal fact. Also run two distinct idempotency keys with identical Money and assert both commit.

- [ ] **Step 3: Implement using DB uniqueness as final arbiter**

Do not implement `SELECT then INSERT` as the sole protection. On unique conflict, reload the persisted command row; equal fingerprint => replay; unequal => conflict.

- [ ] **Step 4: Simulate lost response**

Test: first execution commits but test discards returned response; second invocation with same identity must recover persisted result, not create another fact.

- [ ] **Step 5: Verify**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-idempotency-concurrency-postgres.test.ts
npm run lint
git diff --check
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/finance-command.ts tests/finance-idempotency-concurrency-postgres.test.ts
git commit -m "feat(finance): enforce canonical command idempotency"
```

---

### Task 6: Minimal reversal and remaining-reversible concurrency proof

**Files:**
- Modify: `src/modules/finance/journal-model.ts`
- Modify: `src/modules/finance/journal-repository.ts`
- Modify: `src/modules/finance/finance-command.ts`
- Create: `tests/finance-reversal-concurrency-postgres.test.ts`

**Interfaces:**
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

- [ ] **Step 1: Write RED reversal tests**

Create original `100 EUR`; reverse `30`; then reverse `40`; prove remaining reversible is `30`. Attempt `31` => reject with zero extra fact. Original rows remain unchanged.

- [ ] **Step 2: Write RED concurrent over-reversal test**

Against original remaining `100`, concurrently request `70` and `60` under distinct legitimate idempotency identities. Exactly one may commit if the other would cause total >100; committed reversal sum must be <=100.

- [ ] **Step 3: Implement deterministic lock/CAS strategy**

Lock the smallest authoritative original transaction row (`SELECT ... FOR UPDATE`) inside the same DB transaction, calculate already confirmed reversal sum from canonical rows, validate same currency and remaining amount, then append new reversal. Never hold lock across network call.

- [ ] **Step 4: Verify**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-reversal-concurrency-postgres.test.ts
npm run lint
git diff --check
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance tests/finance-reversal-concurrency-postgres.test.ts
git commit -m "feat(finance): prove append-only reversal concurrency"
```

---

### Task 7: Projection, outbox and restart recovery

**Files:**
- Create: `src/modules/finance/finance-projection.ts`
- Create: `src/modules/finance/finance-outbox.ts`
- Create: `tests/finance-projection-recovery-postgres.test.ts`

**Interfaces:**
```ts
export async function rebuildFoundationProjection(client: import('pg').PoolClient, institutionId: string): Promise<void>;
export async function readFoundationPosition(client: import('pg').PoolClient, institutionId: string): Promise<ReadonlyArray<{ currency: string; amount: string }>>;

export interface FinanceOutboxMessage { id: string; institutionId: string; topic: string; aggregateId: string; attempts: number; }
export async function claimFinanceOutbox(client: import('pg').PoolClient, limit: number): Promise<FinanceOutboxMessage[]>;
export async function completeFinanceOutbox(client: import('pg').PoolClient, id: string): Promise<void>;
export async function failFinanceOutbox(client: import('pg').PoolClient, id: string, errorCode: string): Promise<void>;
```

- [ ] **Step 1: Write RED confirmed-only projection test**

Prepared/non-confirmed data contributes zero. Confirmed original and confirmed reversals produce deterministic current position.

- [ ] **Step 2: Write RED destroy/rebuild test**

Record expected projection, delete only projection rows, call `rebuildFoundationProjection`, assert byte-equivalent canonical currency/amount output.

- [ ] **Step 3: Write RED outbox failure/restart test**

Prove mandatory outbox insert failure rolls back Journal confirmation. Then confirm a fact with pending outbox, create a fresh pool/consumer instance (simulated process restart), claim the durable message and complete it exactly once.

- [ ] **Step 4: Implement projection and durable outbox**

Projection reads only confirmed Journal authority. Rebuild uses historical persisted Money/profile/rate context and never current policy defaults.

- [ ] **Step 5: Verify**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npx tsx tests/finance-projection-recovery-postgres.test.ts
npm run lint
git diff --check
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/finance-projection.ts src/modules/finance/finance-outbox.ts tests/finance-projection-recovery-postgres.test.ts
git commit -m "feat(finance): add rebuildable projection and durable recovery"
```

---

### Task 8: Legacy authority fence and aggregate Finance Foundation gate

**Files:**
- Create: `tests/finance-foundation-authority-fence.test.ts`
- Create: `scripts/run-finance-foundation.mjs`
- Modify: `package.json`
- Modify only if required by a proved bypass: exact legacy write path files identified by the test; do not perform broad refactor.

**Interfaces:**
Add package scripts:

```json
{
  "test:finance:money": "tsx tests/finance-money-model.test.ts",
  "test:finance:context": "tsx tests/finance-financial-context.test.ts",
  "test:finance:schema": "tsx tests/finance-foundation-schema-postgres.test.ts",
  "test:finance:journal": "tsx tests/finance-journal-postgres.test.ts",
  "test:finance:idempotency": "tsx tests/finance-idempotency-concurrency-postgres.test.ts",
  "test:finance:reversal": "tsx tests/finance-reversal-concurrency-postgres.test.ts",
  "test:finance:recovery": "tsx tests/finance-projection-recovery-postgres.test.ts",
  "test:finance:authority": "tsx tests/finance-foundation-authority-fence.test.ts",
  "test:finance:foundation": "node scripts/run-finance-foundation.mjs"
}
```

`run-finance-foundation.mjs` must stop on first failure, run the non-DB tests first, then the DB safety gate and all approved PostgreSQL tests, then `npm run test:foundation`, `npm run lint`, `npm run build`, `npm run test:secrets`, and `git diff --check` equivalent where practical.

- [ ] **Step 1: Write authority-fence RED test**

Search/characterize all executable writes of `outstandingFees` (and any equivalent legacy Finance balance field discovered by exact repository search). The test must prove that changing such a legacy field cannot change the new canonical Finance projection and that no new Finance command dual-writes it.

- [ ] **Step 2: Run RED and fix only real bypasses**

Run: `npx tsx tests/finance-foundation-authority-fence.test.ts`
If an executable bypass exists, fence it fail-closed/read-only. If none exists, the characterization itself becomes the regression proof; do not invent a code change.

- [ ] **Step 3: Add aggregate runner and package scripts**

Runner must emit a compact gate report with command name, exit code and first failure; no swallowing of child exit codes.

- [ ] **Step 4: Run full Finance Foundation gate on fresh disposable PostgreSQL**

Run:
```bash
TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:foundation
```
Expected: PASS with all Finance proofs and existing foundation/quality gates green.

- [ ] **Step 5: Run independent verification preparation**

Record:
```text
BASE_SHA=<execution base>
IMPLEMENTATION_HEAD=<current HEAD>
WORKTREE=<absolute worktree path>
POSTGRES_TARGET=<approved disposable target without credentials>
FINANCE_GATE=PASS
KNOWN_P0=0
KNOWN_P1=0
```

Do not declare MERGE_SAFE yet.

- [ ] **Step 6: Commit**

```bash
git add tests/finance-foundation-authority-fence.test.ts scripts/run-finance-foundation.mjs package.json
git commit -m "test(finance): add foundation aggregate proof gate"
```

---

## Final exact-HEAD review gate

After Task 8, freeze the implementation HEAD and hand that SHA to Antigravity as independent READ-ONLY reviewer.

Reviewer must inspect:
- F0–F4 spec compliance;
- monetary exactness/no floating-point authority;
- tenant-safe schema/FKs;
- transaction boundary and rollback evidence;
- idempotency and concurrency semantics;
- reversal immutability/over-reversal protection;
- outbox/recovery/projection authority;
- legacy authority fence;
- test strength (no structural tests pretending to prove stateful behavior).

If reviewer reports P0/P1, status is `NOT_MERGE_SAFE`. Codex fixes the root cause in a new commit; all affected proofs rerun; Antigravity reviews the new exact HEAD. A previous review never transfers automatically to a changed SHA.

Only after exact-HEAD review with zero unresolved P0/P1 and a fresh `TEST_DATABASE_LOCAL_AUTHORIZED=true npm run test:finance:foundation` PASS may the implementation be labelled `FINANCE_FOUNDATION_PROVEN_CANDIDATE`.

## Self-review of this plan

- **Spec coverage:** F0 authority/immutability/legacy fence => Tasks 4,6,8; F1 financial context => Task 2; F2 Money/currency/FX/quantization => Task 1 + Task 3 persistence; F3 Journal/idempotency/reversal/projection => Tasks 4–7; F4 migrations/constraints/atomicity/concurrency/recovery => Tasks 3–8.
- **Intentional deferrals:** final Financial Account/Obligation, Payments, Allocation, Reconciliation, providers, fiscal/reporting, Excel/BI and UI remain outside this plan.
- **No hidden country assumption:** currency registry examples are foundation fixtures; no jurisdiction enables a provider.
- **Type consistency:** `Money`, `ExactDecimal`, `FinanceCommandIdentity`, `JournalRepository`, projection/outbox interfaces are defined before consumers.
- **Proof sufficiency:** PostgreSQL is mandatory for schema, atomicity, tenant references, concurrency, idempotency, reversal and recovery claims.
- **Plan status:** implementation execution remains blocked until Product Owner explicitly approves this plan.

`PLAN_STATUS=AWAITING_PRODUCT_OWNER_APPROVAL`
`IMPLEMENTATION_AUTHORIZED=NO`
