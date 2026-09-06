# Finance Allocation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first canonical Allocation authority so an authorized operator can explicitly apply exact portions of a confirmed Payment to eligible Obligations, derive coverage/application positions, and correct mistakes through immutable compensating reversals.

**Architecture:** Allocation is a new institution-scoped economic authority that sits between existing Payment and Obligation authorities. ConfirmAllocation and ReverseAllocation execute through the existing Finance idempotent PostgreSQL command boundary, create a minimal Journal representation atomically, and never mutate original Payment/Obligation Money. Financial Account-centered read projections and UI consume canonical Allocation facts to show derived positions.

**Tech Stack:** TypeScript 5.8, Node/tsx, Express 4, PostgreSQL/pg, React 19, react-test-renderer, existing Nexus Finance Money/Journal/idempotency infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-06-finance-allocation-v1-design.md`

## Global Constraints

- Baseline implementation authority is the Finance state descended from `90c62bb5ae0656bb99c847149f3bb6618f8fe600`; execution must prove the actual descendant baseline before coding.
- Allocation v1 is explicit/manual only; no automatic oldest-first, fee-type priority, student priority or AI suggestion.
- Same Institution + same Financial Account + same Currency are mandatory eligibility boundaries.
- Payment must already be canonically confirmed.
- Partial allocation is valid on Payment and Obligation sides.
- Confirmed Allocation is immutable; correction uses an immutable compensating Allocation Reversal with mandatory reason.
- Payment/Obligation application states are derived projections, never independently editable balance fields.
- No implicit FX, Credit, Refund, Reconciliation, provider activation, fiscal issuance, treasury, payables or statutory/general-ledger expansion.
- Canonical Money remains exact-decimal; no JavaScript-number authority.
- Authoritative commands are PostgreSQL-atomic, persistently idempotent and concurrency-safe.
- No runtime DDL. Allocation schema changes use one new append-only canonical migration.
- Human UAT is required and cannot be replaced by automated readiness.

---

### Task 1: Baseline Characterization and Allocation Domain Contract

**Files:**
- Create: `src/modules/finance/allocation-model.ts`
- Create: `tests/finance-allocation-model.test.ts`
- Modify: `src/modules/finance/journal-model.ts`
- Test: `tests/finance-allocation-model.test.ts`

**Interfaces:**
- Consumes: existing `Money` from `src/modules/finance/money.ts`; existing Payment/Obligation canonical IDs and currency semantics.
- Produces:
  - `Allocation`
  - `AllocationReversal`
  - `ConfirmAllocationInput`
  - `ReverseAllocationInput`
  - `AllocationValidationError`
  - `normalizeConfirmAllocationInput(...)`
  - `normalizeReverseAllocationInput(...)`
  - derived helpers for Payment allocation position and Obligation coverage position.

- [ ] **Step 1: Write failing domain tests for D1-D5**

Cover exact behaviors:

```ts
// representative assertions
assert.equal(derivePaymentAllocationPosition('150.00', '0.00', 'EUR').state, 'unapplied');
assert.equal(derivePaymentAllocationPosition('150.00', '130.00', 'EUR').state, 'partially_allocated');
assert.equal(derivePaymentAllocationPosition('150.00', '150.00', 'EUR').state, 'fully_allocated');

assert.equal(deriveObligationCoveragePosition('100.00', '40.00', 'EUR').state, 'partially_covered');
assert.equal(deriveObligationCoveragePosition('100.00', '100.00', 'EUR').state, 'covered');
```

Also prove rejection of zero/negative allocation Money, cross-currency input, amount above Payment remaining, amount above Obligation remaining, duplicate obligation lines in one command unless explicitly consolidated before normalization, and blank reversal reason.

- [ ] **Step 2: Run the model test and prove RED**

Run:

```bash
npx tsx tests/finance-allocation-model.test.ts
```

Expected: FAIL because allocation domain types/helpers do not exist yet.

- [ ] **Step 3: Implement the minimal exact-decimal domain model**

Use existing `Money.parse`, `Money.add`, `Money.subtract`, `Money.compare` semantics. Do not introduce a second decimal implementation.

Define derived presentation states only as computed values:

```ts
export type PaymentAllocationPosition = 'unapplied' | 'partially_allocated' | 'fully_allocated';
export type ObligationCoveragePosition = 'open' | 'partially_covered' | 'covered';
```

Do not add these states to Payment/Obligation write authority.

- [ ] **Step 4: Extend Journal model vocabulary minimally**

Add only the journal transaction/position semantics required to represent Allocation confirmation and Allocation reversal. Preserve the existing foundation transaction types and validation behavior.

Expected conceptual additions:

```ts
'payment_allocation'
'allocation_reversal'
```

with compatible position types representing allocated/released value without creating a statutory chart of accounts.

- [ ] **Step 5: Run targeted GREEN**

```bash
npx tsx tests/finance-allocation-model.test.ts
npm run test:finance:journal
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/allocation-model.ts src/modules/finance/journal-model.ts tests/finance-allocation-model.test.ts
git commit -m "feat(finance): define allocation domain contract"
```

---

### Task 2: Canonical Allocation Persistence Migration

**Files:**
- Create: `migrations/0037_finance_allocation_authority.sql`
- Create: `tests/finance-allocation-schema-postgres.test.ts`
- Modify: `src/modules/finance/journal-repository.ts`

**Interfaces:**
- Consumes: canonical migration runner; existing `finance_payments`, `finance_obligations`, `finance_financial_accounts`, Journal, command-result and audit structures.
- Produces: append-only Allocation and Allocation Reversal persistence with tenant-safe ownership and causal linkage.

- [ ] **Step 1: Write RED schema/PostgreSQL tests**

Tests must bootstrap the canonical migration chain against disposable authorized PostgreSQL and assert:

```text
finance_allocations exists
finance_allocation_reversals exists
```

Required columns/constraints must support:

```text
allocation.id
allocation.institution_id
allocation.financial_account_id
allocation.payment_id
allocation.obligation_id
allocation.amount NUMERIC
allocation.currency
allocation.journal_transaction_id
allocation.effective_at
allocation.recorded_at
allocation.actor_kind / actor_person_id where current Finance pattern requires it

reversal.id
reversal.institution_id
reversal.original_allocation_id
reversal.amount NUMERIC
reversal.currency
reversal.reason NOT NULL/non-blank by command law
reversal.journal_transaction_id
reversal.effective_at
reversal.recorded_at
```

Prove no REAL/FLOAT/DOUBLE authoritative monetary columns.

Prove foreign-tenant payment/obligation/account linkage is rejected by the persistence design or by transaction-time ownership checks plus deterministic constraints as required by the existing schema pattern.

- [ ] **Step 2: Run schema test and prove RED**

```bash
npx tsx tests/finance-allocation-schema-postgres.test.ts
```

Expected: FAIL because migration 0037 does not exist.

- [ ] **Step 3: Write migration 0037**

Use canonical append-only numbering and exact NUMERIC envelope compatible with existing Finance Money persistence. Do not alter historical Payment or Obligation amounts. Add indexes required for:

```text
(institution_id, payment_id)
(institution_id, obligation_id)
(institution_id, financial_account_id)
(institution_id, original_allocation_id)
```

Add immutable referential/ownership structure without introducing mutable balance columns.

- [ ] **Step 4: Extend Journal persistence to accept Allocation transaction types**

`PostgresJournalRepository.confirmInTransaction(...)` currently guards foundation-only transaction types. Extend the canonical validation/persistence path so Allocation confirmation/reversal can be persisted through the same transaction mechanism, while keeping foundation reversal guardrails intact.

Do not create a second Journal repository.

- [ ] **Step 5: Run GREEN and migration regressions**

```bash
npx tsx tests/finance-allocation-schema-postgres.test.ts
npm run test:migrations:isolated
npm run test:finance:journal
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/0037_finance_allocation_authority.sql tests/finance-allocation-schema-postgres.test.ts src/modules/finance/journal-repository.ts
git commit -m "feat(finance): add canonical allocation persistence"
```

---

### Task 3: Allocation Repository, Atomic Confirmation, and Idempotency

**Files:**
- Create: `src/modules/finance/allocation-repository.ts`
- Create: `src/modules/finance/allocation-service.ts`
- Create: `tests/finance-allocation-postgres.test.ts`
- Modify: `src/modules/finance/journal-repository.ts` only if Task 2 exposed a minimal missing transaction interface.

**Interfaces:**
- Consumes:
  - `executeIdempotentFinanceCommand(...)`
  - `PostgresJournalRepository.confirmInTransaction(...)`
  - `PostgresPaymentRepository.getById(...)`
  - existing Obligation repository/read contract
  - `Allocation` domain types from Task 1.
- Produces:
  - `PostgresAllocationRepository.confirmAllocationInCommand(actor, rawInput, idempotencyKey)`
  - `PostgresAllocationRepository.reverseAllocationInCommand(actor, rawInput, idempotencyKey)`
  - `getById(...)`
  - `listForPayment(...)`
  - `listForObligation(...)`
  - exact derived position queries.

- [ ] **Step 1: Write RED real-PostgreSQL behavior tests**

Test one Payment `150 EUR` and Obligations `100 EUR + 30 EUR` on the same Financial Account.

Prove one atomic command can create:

```text
100 EUR -> Obligation A
20 EUR -> Obligation B
```

and derive:

```text
Payment allocated = 120 EUR
Payment unapplied = 30 EUR
Obligation A covered = 100 EUR / uncovered = 0
Obligation B covered = 20 EUR / uncovered = 10 EUR
```

Also prove original `finance_payments.amount` and `finance_obligations.amount` remain unchanged.

- [ ] **Step 2: Prove RED**

```bash
npx tsx tests/finance-allocation-postgres.test.ts
```

Expected: FAIL because repository/service do not exist.

- [ ] **Step 3: Implement exact canonical fingerprinting**

In `allocation-service.ts`, canonicalize:

```text
paymentId
ordered normalized allocation lines
exact canonical Money strings
effectiveAt
institution-scoped operation namespace
```

Use operation namespaces:

```text
finance.allocation.confirm
finance.allocation.reverse
```

Same key + different canonical intent must conflict through existing command infrastructure.

- [ ] **Step 4: Implement confirmation transaction**

Within one PostgreSQL transaction:

1. lock Payment row in tenant scope;
2. verify `status='confirmed'`;
3. require Payment Financial Account;
4. compute current net allocated amount from Allocation minus Reversal facts;
5. lock all target Obligations in deterministic ID order;
6. verify same institution/account/currency and eligible lifecycle;
7. compute each remaining coverable amount;
8. reject any over-allocation/over-coverage before writes;
9. persist minimal `payment_allocation` Journal transaction/entries;
10. persist all Allocation rows;
11. persist command result through existing idempotent command boundary;
12. return canonical allocations + derived position.

No provider/network call may occur inside this transaction.

- [ ] **Step 5: Implement reversal transaction**

Lock original Allocation and calculate net prior reversed value. Reject reversal above remaining reversible amount. Persist `allocation_reversal` Journal representation and immutable reversal fact in one transaction. Require non-blank reason.

- [ ] **Step 6: Add failure injection proof**

Inject a deterministic failure after Journal persistence but before Allocation insert (or equivalent internal boundary) and prove rollback leaves zero new Journal/Allocation facts.

- [ ] **Step 7: Run GREEN**

```bash
npx tsx tests/finance-allocation-postgres.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/finance/allocation-repository.ts src/modules/finance/allocation-service.ts tests/finance-allocation-postgres.test.ts
git commit -m "feat(finance): implement atomic allocation commands"
```

---

### Task 4: Concurrency and Reversal Safety

**Files:**
- Create: `tests/finance-allocation-concurrency-postgres.test.ts`
- Modify: `src/modules/finance/allocation-repository.ts`

**Interfaces:**
- Consumes: Task 3 repository commands.
- Produces: proven database-level invariants under competing writes.

- [ ] **Step 1: Write concurrent RED scenarios**

Use separate PostgreSQL clients/promises to prove:

```text
Scenario A: Payment has 100 EUR remaining; two concurrent commands request 80 + 80 -> at most 100 EUR total committed.
Scenario B: Obligation has 100 EUR uncovered; two Payments concurrently request 70 + 70 -> at most 100 EUR total covered.
Scenario C: Allocation has 100 EUR reversible; two reversals concurrently request 70 + 70 -> at most 100 EUR reversed.
Scenario D: multi-obligation commands lock targets deterministically and never rely on process-local mutexes.
```

- [ ] **Step 2: Run and prove failure if current locking is insufficient**

```bash
npx tsx tests/finance-allocation-concurrency-postgres.test.ts
```

Expected: either RED on missing command or a deterministic invariant failure before repository locking is complete.

- [ ] **Step 3: Apply the minimum PostgreSQL locking/CAS fix**

Use row locks and deterministic resource ordering. Do not introduce global Finance locks or blanket SERIALIZABLE as the default.

- [ ] **Step 4: Run repeated GREEN**

```bash
npx tsx tests/finance-allocation-concurrency-postgres.test.ts
npx tsx tests/finance-allocation-concurrency-postgres.test.ts
```

Expected: PASS both runs.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/allocation-repository.ts tests/finance-allocation-concurrency-postgres.test.ts
git commit -m "test(finance): prove allocation concurrency safety"
```

---

### Task 5: HTTP, Authorization, and Tenant Boundary

**Files:**
- Create: `src/modules/finance/allocation-http.ts`
- Create: `tests/finance-allocation-http.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Consumes: `PostgresAllocationRepository` from Task 3 and existing institutional auth middleware/context patterns used by Payment/Obligation HTTP modules.
- Produces canonical endpoints:
  - `POST /api/finance/allocations`
  - `POST /api/finance/allocations/:allocationId/reversals`
  - `GET /api/finance/allocations?paymentId=...|obligationId=...`

- [ ] **Step 1: Write RED Express + real PostgreSQL HTTP tests**

Prove:

```text
201 authorized allocation
200 idempotent replay without duplicate fact
409 same idempotency key with different intent
403 unauthorized Finance capability
404/non-disclosure foreign tenant resource
409 cross-account attempt
409 cross-currency attempt
409 unconfirmed/non-eligible Payment or Obligation
201 authorized reversal
409 over-reversal
```

Headers must use the same idempotency transport convention as Payment Core.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-allocation-http.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement `registerFinanceAllocationRoutes(...)`**

Derive institution/membership/capability server-side. Never accept browser institution/role/remaining-value assertions as authority. Map known validation/conflict/not-found errors to the repository's established Finance HTTP patterns.

- [ ] **Step 4: Register routes in `server.ts`**

Register beside existing Finance routes, using the same PostgreSQL pool/auth context. Do not instantiate a second persistence pool or bypass auth middleware.

- [ ] **Step 5: Run GREEN + FND03**

```bash
npx tsx tests/finance-allocation-http.test.ts
npm run test:fnd03
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/allocation-http.ts tests/finance-allocation-http.test.ts server.ts
git commit -m "feat(finance): expose tenant-safe allocation API"
```

---

### Task 6: Extend Finance Operational Context Read Projection

**Files:**
- Modify: `src/modules/finance/finance-operational-context-model.ts`
- Modify: `src/modules/finance/finance-operational-context-repository.ts`
- Modify: `src/modules/finance/finance-operational-context-http.ts`
- Modify: `tests/finance-operational-context-postgres.test.ts`
- Modify: `tests/finance-operational-context-http.test.ts`

**Interfaces:**
- Consumes canonical Allocation/Reversal facts.
- Produces derived, presentation-safe fields without new write authority.

- [ ] **Step 1: Write RED read-model tests**

For Payment and Obligation projections, require exact values:

```ts
payment: {
  received: MoneyProjection,
  allocated: MoneyProjection,
  unapplied: MoneyProjection,
  allocationPosition: 'unapplied' | 'partially_allocated' | 'fully_allocated'
}

obligation: {
  original: MoneyProjection,
  covered: MoneyProjection,
  uncovered: MoneyProjection,
  coveragePosition: 'open' | 'partially_covered' | 'covered'
}
```

Also expose typed Allocation history items with reversals causally linked, while preserving existing Payment/Obligation history items.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-operational-context-postgres.test.ts
npx tsx tests/finance-operational-context-http.test.ts
```

- [ ] **Step 3: Implement derived SQL/read composition**

Use aggregate queries over Allocation minus Reversal facts. Never write back derived totals to Payment/Obligation rows in this task.

- [ ] **Step 4: Prove rebuild truth**

Clear any in-memory/UI state, refetch the operational context, and verify identical derived values from canonical PostgreSQL facts alone.

- [ ] **Step 5: Run GREEN**

```bash
npx tsx tests/finance-operational-context-postgres.test.ts
npx tsx tests/finance-operational-context-http.test.ts
npm run test:finance:operational-consolidation
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/finance-operational-context-model.ts src/modules/finance/finance-operational-context-repository.ts src/modules/finance/finance-operational-context-http.ts tests/finance-operational-context-postgres.test.ts tests/finance-operational-context-http.test.ts
git commit -m "feat(finance): derive allocation positions in operational context"
```

---

### Task 7: Allocation Client and Explicit Operator Workflow

**Files:**
- Create: `src/modules/finance/allocation-client.ts`
- Create: `src/components/finance/operational/FinanceAllocationCreateView.tsx`
- Create: `src/components/finance/operational/FinanceAllocationHistory.tsx`
- Create: `tests/finance-allocation-client.test.ts`
- Create: `tests/finance-allocation-ui.test.ts`
- Modify: `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx`
- Modify: `src/components/finance/operational/FinanceOperationalTruthPanels.tsx`

**Interfaces:**
- Consumes Allocation HTTP API and enriched operational-context projection.
- Produces explicit human workflow inside the selected Financial Account context.

- [ ] **Step 1: Write RED client contract tests**

Prove Authorization transport, idempotency header, exact decimal strings, canonical endpoint URLs, error parsing and reversal request shape.

- [ ] **Step 2: Write RED rendered UI behavior tests**

Using `react-test-renderer`, prove:

1. only confirmed Payments with unapplied value expose `Associar recebimento`;
2. only same-account/same-currency eligible Obligations are offered;
3. no Obligation is pre-selected;
4. operator can enter `100 EUR` to Obligation A and `20 EUR` to Obligation B;
5. review shows exact intended distribution and `30 EUR por associar`;
6. browser total is advisory; response is refreshed from server after confirmation;
7. Payment original received amount remains visible unchanged;
8. Obligation original amount remains visible unchanged.

- [ ] **Step 3: Run RED**

```bash
npx tsx tests/finance-allocation-client.test.ts
npx tsx tests/finance-allocation-ui.test.ts
```

- [ ] **Step 4: Implement Allocation client**

Use a safe lexical `fetch` wrapper pattern consistent with the corrected Finance clients. Do not reintroduce native-fetch receiver issues.

- [ ] **Step 5: Implement explicit allocation view**

Required user-facing language:

```text
Associar recebimento
Valor recebido
Valor já associado
Valor por associar
Cobranças elegíveis
Valor a associar
Rever associação
Confirmar associação
```

Do not use wording implying automatic settlement before server confirmation.

- [ ] **Step 6: Implement Allocation history view**

Show confirmed Allocation and reversal facts chronologically. Preserve original Allocation after reversal and display reversal reason. Do not label reversal as Refund.

- [ ] **Step 7: Run GREEN**

```bash
npx tsx tests/finance-allocation-client.test.ts
npx tsx tests/finance-allocation-ui.test.ts
npm run test:finance:operational-consolidation
```

- [ ] **Step 8: Commit**

```bash
git add src/modules/finance/allocation-client.ts src/components/finance/operational/FinanceAllocationCreateView.tsx src/components/finance/operational/FinanceAllocationHistory.tsx src/components/finance/operational/FinanceOperationalContextWorkspace.tsx src/components/finance/operational/FinanceOperationalTruthPanels.tsx tests/finance-allocation-client.test.ts tests/finance-allocation-ui.test.ts
git commit -m "feat(finance): add explicit allocation workflow"
```

---

### Task 8: Allocation Reversal UX and Behavioral Integrity

**Files:**
- Create: `src/components/finance/operational/FinanceAllocationReverseView.tsx`
- Create: `tests/finance-allocation-reversal-ui.test.ts`
- Modify: `src/components/finance/operational/FinanceAllocationHistory.tsx`
- Modify: `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx`

**Interfaces:**
- Consumes reversal API from Task 5.
- Produces correction workflow that preserves original Allocation history.

- [ ] **Step 1: Write RED behavioral tests**

Prove:

```text
original Allocation remains visible after reversal
partial reversal restores only reversed amount
full reversal restores full remaining reversible amount
reason is mandatory
UI cannot edit/delete confirmed Allocation
UI never says "refund" for Allocation reversal
canonical context is refetched after success
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-allocation-reversal-ui.test.ts
```

- [ ] **Step 3: Implement minimal reversal view**

Display original allocation amount, already reversed amount, remaining reversible amount, requested reversal amount, mandatory reason and a confirmation summary.

- [ ] **Step 4: Run GREEN**

```bash
npx tsx tests/finance-allocation-reversal-ui.test.ts
npm run test:finance:operational-consolidation
```

- [ ] **Step 5: Commit**

```bash
git add src/components/finance/operational/FinanceAllocationReverseView.tsx src/components/finance/operational/FinanceAllocationHistory.tsx src/components/finance/operational/FinanceOperationalContextWorkspace.tsx tests/finance-allocation-reversal-ui.test.ts
git commit -m "feat(finance): add immutable allocation reversal workflow"
```

---

### Task 9: Allocation Aggregate Gate and Regression Wiring

**Files:**
- Create: `scripts/run-finance-f4-allocation.mjs`
- Modify: `package.json`
- Create: `tests/finance-allocation-safety.test.ts`

**Interfaces:**
- Consumes all Allocation test suites from Tasks 1-8.
- Produces one deterministic command: `npm run test:finance:f4:allocation`.

- [ ] **Step 1: Write the aggregate runner**

Run, in fail-fast order:

```text
finance-allocation-safety.test.ts
finance-allocation-model.test.ts
finance-allocation-schema-postgres.test.ts
finance-allocation-postgres.test.ts
finance-allocation-concurrency-postgres.test.ts
finance-allocation-http.test.ts
finance-allocation-client.test.ts
finance-allocation-ui.test.ts
finance-allocation-reversal-ui.test.ts
```

Use current project child-process lifecycle/timeout patterns from existing Finance runners.

- [ ] **Step 2: Add package script**

```json
"test:finance:f4:allocation": "node scripts/run-finance-f4-allocation.mjs"
```

- [ ] **Step 3: Add safety test**

Statically complement behavior proofs by rejecting accidental scope expansion such as new `credit`, `refund`, `reconciliation`, cross-currency auto-allocation or destructive Allocation delete/update endpoints. This safety test is complementary only and must not substitute for PostgreSQL/HTTP behavior tests.

- [ ] **Step 4: Run aggregate**

```bash
npm run test:finance:f4:allocation
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-finance-f4-allocation.mjs package.json tests/finance-allocation-safety.test.ts
git commit -m "test(finance): add Allocation v1 aggregate gate"
```

---

### Task 10: Final Whole-Branch Verification, Handoff, and Human UAT Preparation

**Files:**
- Create or update plan-specific SDD ledger under `.superpowers/sdd/` according to the execution skill's generated workspace.
- Create: `docs/finance/FINANCE_ALLOCATION_V1_HANDOFF.md`
- Modify no production code unless the final review finds a material defect directly inside approved Allocation v1 scope.

**Interfaces:**
- Consumes the complete Allocation implementation.
- Produces final evidence, runtime-ready branch, historical handoff and Human UAT script.

- [ ] **Step 1: Run the complete fresh verification sequence from final HEAD**

```bash
npm run test:finance:f4:allocation
npm run test:finance:operational-consolidation
npm run test:finance:f3:payment-core
npm run test:finance:f2:account-obligation
npm run test:finance:f1:fee-catalogue
npm run test:finance:foundation
npm run test:fnd03
npm run lint
npm run build
git diff --check
npm run test:secrets
npm run test:artifacts
```

Expected: every command PASS.

- [ ] **Step 2: Perform one bounded independent whole-branch review**

Review specifically:

```text
no Payment/Obligation original Money mutation
no mutable Allocation correction
no over-allocation or over-coverage race
no over-reversal race
same Institution/account/currency only
no browser-owned remaining-value authority
no automatic priority policy
no cross-currency implicit FX
no Credit/Refund/Reconciliation scope creep
Journal atomicity preserved
idempotency preserved
foreign tenant non-disclosure
projection rebuildability
```

Fix only P0/P1 material findings inside the approved spec. Do not enter an optional-improvement loop.

- [ ] **Step 3: Write the historical handoff**

`docs/finance/FINANCE_ALLOCATION_V1_HANDOFF.md` must record:

```text
spec path + commit
plan path + commit
implementation branch
base SHA
final SHA
migration tip
new authority semantics
Journal semantics
HTTP endpoints
idempotency namespaces
concurrency strategy
Human UAT status
explicit non-goals/future extension points
```

Before Human UAT, status must be `HUMAN_UAT=PENDING`.

- [ ] **Step 4: Push normally and prove parity**

Execution branch recommendation:

```text
codex/finance-f4-allocation-v1
```

No force push. Prove:

```text
LOCAL_HEAD == origin/codex/finance-f4-allocation-v1
```

- [ ] **Step 5: Prepare exact runtime**

Stop only stale Nexus dev processes, run canonical migrations through 0037 against the authorized UAT database, start frontend/backend from exact final HEAD, and prove:

```text
BRANCH
LOCAL_SHA
REMOTE_SHA
BACKEND_SHA
FRONTEND_SHA
MIGRATION_TIP=0037_finance_allocation_authority.sql
RUNTIME_SHA_PARITY=PASS
```

- [ ] **Step 6: Execute Product Owner Human UAT**

Minimum manual sequence:

```text
1. Open a known Financial Account.
2. Confirm one Payment with unapplied value.
3. Confirm two eligible same-currency Obligations.
4. Choose the Payment and explicitly allocate part to Obligation A.
5. Allocate another part to Obligation B in the same confirmation.
6. Confirm one Obligation becomes Coberta and the other can remain Parcialmente coberta.
7. Confirm Payment can remain Parcialmente associado with a visible unapplied remainder.
8. Refresh and prove persistence.
9. Open Allocation history.
10. Reverse part/all of one Allocation with mandatory reason.
11. Confirm original Allocation remains visible.
12. Confirm derived Payment/Obligation positions update.
13. Confirm original Payment amount and original Obligation amount never changed.
14. Confirm UI makes no Reconciliation/Refund claim.
15. Check light/dark/responsive behavior and browser console.
```

Human UAT failure reopens only the exact failing behavior, not the whole design.

- [ ] **Step 7: Final completion report**

Return exactly:

```text
SPEC=PASS
PLAN=PASS

ALLOCATION_DOMAIN=PASS
ALLOCATION_PERSISTENCE=PASS
ALLOCATION_JOURNAL_ATOMICITY=PASS
PARTIAL_ALLOCATION=PASS
MULTI_OBLIGATION_ALLOCATION=PASS
PAYMENT_REMAINDER=PASS
OBLIGATION_PARTIAL_COVERAGE=PASS
SAME_ACCOUNT_BOUNDARY=PASS
SAME_CURRENCY_BOUNDARY=PASS
TENANT_ISOLATION=PASS
IDEMPOTENCY=PASS
CONCURRENCY_OVERALLOCATION=PASS
CONCURRENCY_OVERCOVERAGE=PASS
IMMUTABLE_ALLOCATION=PASS
ALLOCATION_REVERSAL=PASS
CONCURRENCY_OVERREVERSAL=PASS
DERIVED_POSITIONS=PASS
NO_PAYMENT_MUTATION=PASS
NO_OBLIGATION_MUTATION=PASS
NO_RECONCILIATION_SIDE_EFFECT=PASS

F4_ALLOCATION_AGGREGATE=PASS
OPERATIONAL_CONSOLIDATION_REGRESSION=PASS
F3_REGRESSION=PASS
F2_REGRESSION=PASS
F1_REGRESSION=PASS
FOUNDATION=PASS
FND03=PASS
LINT=PASS
BUILD=PASS
SECRETS=PASS
ARTIFACTS=PASS

BASE_SHA=<sha>
REMOTE_SHA=<sha>
REMOTE_PARITY=MATCH
RUNTIME_SHA_PARITY=PASS

HUMAN_UAT=<PASS|PENDING|FAIL>
FINANCE_ALLOCATION_V1=<READY_FOR_HUMAN_UAT|DONE|BLOCKED>
```

If blocked, append only:

```text
WHY=<direct evidence>
MINIMUM_DECISION_REQUIRED=<exact requirement>
```
