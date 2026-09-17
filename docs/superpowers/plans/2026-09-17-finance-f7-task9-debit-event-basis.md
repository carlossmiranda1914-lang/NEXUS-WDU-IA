# Finance F7 Task 9 Debit Event Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum persisted, server-authorized debit-event basis to the existing `ObligationAdjustment` authority so Task 9 Nota de Débito can later consume a truthful economic source without new Finance architecture.

**Architecture:** Extend the existing adjustment row/command/read model with `basisType: 'general' | 'debit_event'`. Historical and omitted values remain `general`; `debit_event` is accepted only for `direction='increase'`. The field classifies the economic fact; it is not document eligibility or tax authority. Future Angola Nota de Débito policy must still independently decide eligibility and derive zero-tax behavior from proven rules.

**Tech Stack:** TypeScript, Node.js, PostgreSQL, Express, React, existing Finance command/idempotency/journal/outbox infrastructure, `tsx` executable tests.

**Spec:** `docs/superpowers/specs/2026-09-17-finance-f7-task9-debit-event-basis-design.md`

## Global Constraints

- `NEW_FINANCE_ARCHITECTURE=NO`
- `NEW_DEBIT_EVENT_AGGREGATE=NO`
- `OBLIGATION_ADJUSTMENT_REMAINS_AUTHORITY=YES`
- `TENANT_AUTHORITY=SERVER`
- `EXACT_MONEY=MANDATORY`
- `BROWSER_FISCAL_AUTHORITY=NO`
- `CREDIT_NOTE_AUTHORITY=FROZEN`
- `PAYMENT_ALLOCATION_AUTHORITY=FROZEN`
- `SHARED_NUMBERING_IDEMPOTENCY=DO_NOT_REDESIGN`
- `AO_PRODUCTION=FAIL_CLOSED`
- `ZERO_TAX=DERIVED_LATER_FROM_AO_POLICY_NOT_BROWSER_INPUT`
- Existing adjustment rows remain valid without destructive backfill.
- Any unexpected need to modify IAM, global tenant resolution, Financial Account, Payment, Allocation, Credit Note, shared Finance command infrastructure or journal architecture is a protected-boundary escalation before writing that change.

---

## File Map

**Create**
- `src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql`
- `tests/finance-obligation-adjustment-debit-event-model.test.ts`
- `tests/finance-obligation-adjustment-debit-event-postgres.test.ts`
- `tests/finance-obligation-adjustment-debit-event-http.test.ts`
- `tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts`

**Modify**
- `src/modules/finance/obligation-adjustment-model.ts`
- `src/modules/finance/obligation-adjustment-repository.ts`
- `src/modules/finance/obligation-adjustment-http.ts`
- `src/modules/finance/obligation-adjustment-client.ts`
- `src/components/finance/operational/FinanceObligationAdjustmentView.tsx`

Do not add a new endpoint, table, aggregate, screen, workspace or tax field.

---

### Task 1: Lock the Domain Contract with RED Model Tests

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-model.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-model.ts`

**Interfaces:**
- Consumes: `normalizeRecordObligationAdjustmentCommand()` and `createObligationAdjustmentFingerprint()`.
- Produces: `ObligationAdjustmentBasis = 'general' | 'debit_event'` and normalized `basisType`.

- [ ] **Step 1: Write the failing test**

Use these exact behavioral assertions:

```ts
const base = {
  obligationId: 'obligation-1',
  direction: 'increase',
  amount: '10.00',
  currency: 'EUR',
  reason: 'Aumento factual',
};

assert.equal(normalizeRecordObligationAdjustmentCommand(base).basisType, 'general');
assert.equal(normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'debit_event' }).basisType, 'debit_event');
assert.throws(() => normalizeRecordObligationAdjustmentCommand({ ...base, direction: 'decrease', basisType: 'debit_event' }), /debit/i);
assert.throws(() => normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'invoice' }), /basis/i);
```

Also prove:

```text
omitted basis fingerprint == explicit general fingerprint
general fingerprint != debit_event fingerprint
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
```

Expected: FAIL because the approved basis contract does not yet exist.

- [ ] **Step 3: Implement the minimal model contract**

```ts
export type ObligationAdjustmentBasis = 'general' | 'debit_event';

export interface RecordObligationAdjustmentCommand {
  obligationId: string;
  direction: AdjustmentDirection;
  amount: Money;
  currency: string;
  reason: string;
  basisType: ObligationAdjustmentBasis;
  compensatesAdjustmentId?: string;
}
```

Normalization:

```ts
const basisType = value.basisType === undefined ? 'general' : value.basisType;
if (basisType !== 'general' && basisType !== 'debit_event') {
  throw new ObligationAdjustmentValidationError('Adjustment basis is invalid');
}
if (basisType === 'debit_event' && value.direction !== 'increase') {
  throw new ObligationAdjustmentValidationError('Debit event basis requires an increase Adjustment');
}
```

Add `basisType` to the canonical fingerprint.

- [ ] **Step 4: Run GREEN**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/obligation-adjustment-model.ts tests/finance-obligation-adjustment-debit-event-model.test.ts
git commit -m "test(finance): define debit event adjustment basis"
```

---

### Task 2: Persist Basis on the Existing Adjustment Authority

**Files:**
- Create: `src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql`
- Create: `tests/finance-obligation-adjustment-debit-event-postgres.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-repository.ts`

**Interfaces:**
- Consumes: normalized `basisType`.
- Produces: authoritative `ObligationAdjustment.basisType` backed by `finance_obligation_adjustments.basis_type`.

- [ ] **Step 1: Write PostgreSQL RED tests**

Prove all of the following against the real repository path:

```text
historical row with basis_type NULL reads as general
increase + general persists/readbacks as general
increase + debit_event persists/readbacks as debit_event
decrease + debit_event rejected
foreign tenant cannot read adjustment
identical idempotency key + identical debit_event command replays exactly once
same idempotency key + changed basis conflicts
amount/currency/reason/actor/institution/journal behavior remains unchanged
fresh repository instance reads same persisted basis
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
```

Expected: FAIL because persistence is absent.

- [ ] **Step 3: Add the migration**

```sql
ALTER TABLE finance_obligation_adjustments
  ADD COLUMN basis_type text;

ALTER TABLE finance_obligation_adjustments
  ADD CONSTRAINT finance_obligation_adjustments_basis_type_check
  CHECK (basis_type IS NULL OR basis_type IN ('general', 'debit_event'));

ALTER TABLE finance_obligation_adjustments
  ADD CONSTRAINT finance_obligation_adjustments_debit_event_direction_check
  CHECK (basis_type IS DISTINCT FROM 'debit_event' OR direction = 'increase');
```

Do not backfill historical rows.

- [ ] **Step 4: Extend row mapping and INSERT**

Map readback as:

```ts
basisType: r.basis_type === 'debit_event' ? 'debit_event' : 'general'
```

Persist general compatibly:

```ts
command.basisType === 'general' ? null : command.basisType
```

Keep journal position vocabulary unchanged.

- [ ] **Step 5: Prove audit/outbox linkage without redesign**

The test must establish:

```text
existing adjustment audit/outbox evidence remains present
adjustment row/id links to the accepted basis truth
no fiscal-document event is emitted by this prerequisite
journal sourceRef remains the obligation id
```

Do not expand generic audit/outbox payload merely to duplicate `basisType` if authoritative row linkage already proves the fact.

- [ ] **Step 6: Run migration and persistence gates**

```bash
npm run test:migrations:isolated
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql src/modules/finance/obligation-adjustment-repository.ts tests/finance-obligation-adjustment-debit-event-postgres.test.ts
git commit -m "feat(finance): persist debit event adjustment basis"
```

---

### Task 3: Extend the Existing HTTP and Client Contract

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-http.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-http.ts`
- Modify: `src/modules/finance/obligation-adjustment-client.ts`

**Interfaces:**
- Consumes: existing adjustment route.
- Produces: optional request `basisType` and authoritative response `basisType`.

- [ ] **Step 1: Write HTTP RED tests**

Prove:

```text
omitted basis -> success + general
increase + debit_event -> success + debit_event
decrease + debit_event -> validation 4xx
unknown basis -> validation 4xx
client-supplied institutionId cannot cross tenant
existing unauthorized actor remains denied
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

- [ ] **Step 3: Make the smallest existing-route/client extension**

The typed client input becomes:

```ts
{
  direction: 'increase' | 'decrease';
  amount: string;
  currency: string;
  reason: string;
  basisType?: 'general' | 'debit_event';
  compensatesAdjustmentId?: string;
}
```

Do not add `/debit-event`, `/debit-note-source` or another mutation endpoint.

- [ ] **Step 4: Run GREEN**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/obligation-adjustment-http.ts src/modules/finance/obligation-adjustment-client.ts tests/finance-obligation-adjustment-debit-event-http.test.ts
git commit -m "feat(finance): expose debit event adjustment basis"
```

---

### Task 4: Extend the Existing Adjustment UI, Not the Architecture

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts`
- Modify: `src/components/finance/operational/FinanceObligationAdjustmentView.tsx`

**Interfaces:**
- Consumes: `obligationAdjustmentClient.record(...)` with `basisType`.
- Produces: normal UI can record a general or debit-event increase while preserving server authority.

- [ ] **Step 1: Write UI RED contract**

Prove:

```text
general is default
debit-event classification is available only for direction=increase
switching to decrease resets classification to general
no tax field exists
no tenant/institution selector exists
UI text does not promise Nota de Débito issuance
submitted command contains basisType but no tax/document-authority field
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
```

- [ ] **Step 3: Implement the smallest UI control**

Use copy equivalent to:

```text
Natureza do aumento
- Ajuste financeiro geral
- Evento de débito sujeito a validação documental
```

Behavior:

```text
default general
if direction != increase => basisType=general and debit-event option unavailable
never render zero-tax, tax mode, document type or tenant authority fields
never say that choosing debit_event guarantees a Nota de Débito
```

- [ ] **Step 4: Run UI + HTTP regression**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/finance/operational/FinanceObligationAdjustmentView.tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
git commit -m "feat(finance): classify debit event adjustments in product flow"
```

---

### Task 5: Fresh Aggregate Verification and Closure

**Files:**
- No product code expected.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: factual decision whether the prerequisite is closed and Task 9 implementation may resume.

- [ ] **Step 1: Run all focused evidence**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
npm run test:migrations:isolated
```

- [ ] **Step 2: Run affected Finance and repository gates**

```bash
npm run test:finance:foundation
npm run lint
npm run build
git diff --check
git status --short
git rev-parse HEAD
git fetch origin --prune
git rev-parse origin/codex/finance-pilot-01-credit-note
```

Any failure must be classified `PRODUCT | IMPLEMENTATION | ENVIRONMENT | AUTOMATION | TEST | DEPENDENCY | CONFIGURATION | UNKNOWN`; do not weaken evidence to obtain green.

- [ ] **Step 3: Human UAT for this prerequisite only**

Use the normal existing UI:

```text
open a legitimate open Obligation
open its adjustment flow
record an increase classified as debit_event
verify amount, reason and classification
refresh and verify same truth
restart application and relogin
verify same persisted truth
```

Do not issue Nota de Débito in this prerequisite UAT.

- [ ] **Step 4: Independent readback**

Read-only evidence must prove:

```text
exact adjustment row has basis_type=debit_event
direction=increase
amount/currency/reason unchanged
institution/obligation/actor correct
journal transaction linked
idempotency linked
no duplicate adjustment
no financial document created by this prerequisite
```

- [ ] **Step 5: Final adjudication**

Return exactly:

```text
RESULT=
BASELINE_HEAD=
FINAL_HEAD=
REMOTE_HEAD=
REMOTE_PARITY=
WORKTREE=

MODEL_RED_GREEN=
MIGRATION=
GENERAL_BACKWARD_COMPATIBILITY=
DEBIT_EVENT_INCREASE_ONLY=
EXACT_MONEY=
TENANT_ISOLATION=
IDEMPOTENCY_REPLAY=
IDEMPOTENCY_BASIS_CONFLICT=
AUDIT=
OUTBOX=
JOURNAL_SEMANTICS_UNCHANGED=
HTTP=
UI=
REFRESH_READBACK=
RESTART_READBACK=

NEW_DOMAIN_AUTHORITY=NO
NEW_FINANCE_ARCHITECTURE=NO
BROWSER_FISCAL_AUTHORITY=NO
AO_PRODUCTION_STATUS=FAIL_CLOSED

PREREQUISITE_STATUS=CLOSED|UNPROVEN|BLOCKED
READY_TO_RESUME_TASK_9=YES|NO
NEXT_CAUSAL_GAP=
```

`PREREQUISITE_STATUS=CLOSED` requires fresh machine evidence, normal-path Human UAT, refresh/restart persistence and independent readback.

---

## Self-Review

- Every approved invariant maps to a concrete task.
- No new aggregate, table family, endpoint, screen or tax authority is introduced.
- `basisType` is consistently `general | debit_event`; persisted column is `basis_type`.
- Historical null is intentionally interpreted as `general`.
- `debit_event` is valid only for increase.
- Zero-tax remains a future AO policy derivation, never browser input.
- Closure requires RED→GREEN, PostgreSQL, tenant/idempotency, HTTP, UI, refresh/restart, Finance regression, lint/build/diff and independent readback.
- This plan closes only the Task 9 prerequisite; it does not implement or close Nota de Débito itself.
