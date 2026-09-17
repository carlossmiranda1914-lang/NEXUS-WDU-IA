# Finance F7 Task 9 Debit Event Basis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum persisted, server-authorized debit-event basis to the existing `ObligationAdjustment` authority so Task 9 Nota de Débito can later consume a truthful economic source without new Finance architecture.

**Architecture:** Extend the existing adjustment row/command/read model with `basisType: 'general' | 'debit_event'`. Historical and omitted values remain `general`; `debit_event` is accepted only for `direction='increase'`. The field is an economic-fact classification, not document eligibility or tax authority; future AO Nota de Débito policy must still decide eligibility and derive zero-tax behavior from proven rules.

**Tech Stack:** TypeScript, Node.js, PostgreSQL, Express, React, existing Finance command/idempotency/journal/outbox infrastructure, Vitest-free `tsx` test executables used by this repository.

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
- Existing adjustment rows must remain valid without destructive backfill.
- Any unexpected need to modify IAM, global tenant resolution, journal architecture, Financial Account, Payment, Allocation, Credit Note, or shared Finance command infrastructure is a protected-boundary escalation before writing the change.

---

## File Map

**Create**
- `src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql` — nullable/check-constrained persisted basis on existing adjustment authority.
- `tests/finance-obligation-adjustment-debit-event-model.test.ts` — normalization/fingerprint RED→GREEN contract.
- `tests/finance-obligation-adjustment-debit-event-postgres.test.ts` — migration, persistence, tenant, idempotency, audit/outbox and restart/readback evidence.
- `tests/finance-obligation-adjustment-debit-event-http.test.ts` — existing HTTP command/read contract extension.
- `tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts` — product interaction contract for general vs debit-event adjustment.

**Modify**
- `src/modules/finance/obligation-adjustment-model.ts` — type, normalization and canonical fingerprint.
- `src/modules/finance/obligation-adjustment-repository.ts` — row mapping, insert/readback, authoritative persisted basis.
- `src/modules/finance/obligation-adjustment-http.ts` — expose basis through the existing route only.
- `src/modules/finance/obligation-adjustment-client.ts` — typed request/response through existing client.
- The existing Finance obligation UI component that currently records general adjustments; identify the exact component by tracing `obligation-adjustment-client.ts` imports before editing. Do not add a second adjustment screen.
- `package.json` only if a focused named test runner is materially useful; otherwise run tests directly with `tsx` and avoid script churn.

---

### Task 1: Lock the Domain Contract with RED Model Tests

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-model.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-model.ts`

**Interfaces:**
- Consumes: existing `normalizeRecordObligationAdjustmentCommand()` and `createObligationAdjustmentFingerprint()`.
- Produces: `export type ObligationAdjustmentBasis = 'general' | 'debit_event'` and normalized `basisType` on `RecordObligationAdjustmentCommand`.

- [ ] **Step 1: Write failing model tests for the exact approved invariants**

The test must assert these concrete cases:

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
assert.throws(
  () => normalizeRecordObligationAdjustmentCommand({ ...base, direction: 'decrease', basisType: 'debit_event' }),
  /debit/i,
);
assert.throws(
  () => normalizeRecordObligationAdjustmentCommand({ ...base, basisType: 'invoice' }),
  /basis/i,
);
```

Also prove the fingerprint differs when only `basisType` differs, and remains identical when an omitted basis is compared with explicit `general`.

- [ ] **Step 2: Run the focused test and prove RED**

Run:

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
```

Expected: FAIL because `basisType` is not yet part of the command/fingerprint.

- [ ] **Step 3: Implement the smallest model change**

Use this semantic contract:

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

Normalization rules:

```ts
const basisType = value.basisType === undefined ? 'general' : value.basisType;
if (basisType !== 'general' && basisType !== 'debit_event') throw new ObligationAdjustmentValidationError('Adjustment basis is invalid');
if (basisType === 'debit_event' && value.direction !== 'increase') throw new ObligationAdjustmentValidationError('Debit event basis requires an increase Adjustment');
```

Add `basisType` to `createObligationAdjustmentFingerprint(...)`.

- [ ] **Step 4: Re-run and prove GREEN**

Run:

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the domain contract**

```bash
git add src/modules/finance/obligation-adjustment-model.ts tests/finance-obligation-adjustment-debit-event-model.test.ts
git commit -m "test(finance): define debit event adjustment basis"
```

---

### Task 2: Persist the Basis on the Existing Adjustment Authority

**Files:**
- Create: `src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql`
- Create: `tests/finance-obligation-adjustment-debit-event-postgres.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-repository.ts`

**Interfaces:**
- Consumes: normalized `basisType` from Task 1.
- Produces: `ObligationAdjustment.basisType` backed by `finance_obligation_adjustments.basis_type`.

- [ ] **Step 1: Write PostgreSQL RED tests before migration/repository changes**

The test must create a real open obligation using existing Finance fixtures/helpers and prove all of these:

```text
existing/historical adjustment without explicit basis reads as general
increase + general persists and reads general
increase + debit_event persists and reads debit_event
decrease + debit_event cannot persist through repository command
foreign-tenant read cannot retrieve adjustment
identical idempotency key + identical debit_event command replays exactly once
same idempotency key + basis changed general <-> debit_event conflicts
reason/amount/currency/actor/institution/journal remain unchanged by basis support
```

The test must query the actual persisted row after command completion and again through a fresh repository instance to prove restart-style readback.

- [ ] **Step 2: Run and prove RED**

Run:

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
```

Expected: FAIL because `basis_type` does not exist and repository does not map it.

- [ ] **Step 3: Add the minimal migration**

Migration content must use the existing table only:

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

Do not backfill historical rows. Application read mapping interprets null as `general`.

- [ ] **Step 4: Extend row mapping and INSERT/SELECT truthfully**

Update the repository row/interface contract so the database value is mapped as:

```ts
basisType: r.basis_type === 'debit_event' ? 'debit_event' : 'general'
```

The INSERT must persist:

```ts
command.basisType === 'general' ? null : command.basisType
```

This preserves old-row semantics while making `debit_event` explicit.

- [ ] **Step 5: Prove audit/outbox/journal behavior is preserved, not reinterpreted**

The PostgreSQL test must assert:

```text
journal position type still obligation_due_increased / obligation_due_decreased
journal sourceRef remains obligation id
existing audit/outbox event still exists for adjustment command
accepted persisted basis can be correlated to the adjustment result row/id
no new fiscal document event is emitted by this prerequisite
```

If current audit/outbox payload is intentionally generic and does not contain command fields, do not redesign it merely to duplicate `basisType`; prove linkage to the authoritative adjustment row instead. Escalate only if linkage is impossible.

- [ ] **Step 6: Run migration integrity + focused PostgreSQL test**

Run:

```bash
npm run test:migrations:isolated
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit persistence**

```bash
git add src/db/migrations/0121_finance_obligation_adjustment_debit_event_basis.sql src/modules/finance/obligation-adjustment-repository.ts tests/finance-obligation-adjustment-debit-event-postgres.test.ts
git commit -m "feat(finance): persist debit event adjustment basis"
```

---

### Task 3: Extend the Existing HTTP and Client Contract, No New Endpoint

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-http.test.ts`
- Modify: `src/modules/finance/obligation-adjustment-http.ts`
- Modify: `src/modules/finance/obligation-adjustment-client.ts`

**Interfaces:**
- Consumes: existing adjustment route and repository result.
- Produces: request accepts optional `basisType`; response/read model returns authoritative normalized `basisType`.

- [ ] **Step 1: Write HTTP RED tests**

Prove through the existing authenticated route:

```text
omitted basis -> 2xx and response basisType=general
increase + debit_event -> 2xx and response basisType=debit_event
decrease + debit_event -> 4xx validation failure
unknown basis -> 4xx validation failure
client cannot provide institutionId to cross tenant
unauthorized actor remains rejected exactly as before
```

- [ ] **Step 2: Run and prove RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

Expected: FAIL only on the new basis contract.

- [ ] **Step 3: Make the minimal HTTP/client extension**

Do not add `/debit-event`, `/debit-note-source`, or any parallel route. Pass the optional factual `basisType` through the existing adjustment command and return repository truth.

- [ ] **Step 4: Re-run and prove GREEN**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit API/client extension**

```bash
git add src/modules/finance/obligation-adjustment-http.ts src/modules/finance/obligation-adjustment-client.ts tests/finance-obligation-adjustment-debit-event-http.test.ts
git commit -m "feat(finance): expose debit event adjustment basis"
```

---

### Task 4: Add the Minimum Product UI Classification to the Existing Adjustment Flow

**Files:**
- Create: `tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts`
- Modify: the exact existing component that currently records adjustments; determine it by tracing imports/usages of `recordObligationAdjustment` or the exported mutation from `src/modules/finance/obligation-adjustment-client.ts`.

**Interfaces:**
- Consumes: existing adjustment mutation with `basisType`.
- Produces: normal authorized UI can create `general` or `debit_event` increase adjustments without exposing a fiscal eligibility promise.

- [ ] **Step 1: Locate the existing adjustment surface before editing**

Run:

```bash
git grep -n "obligation-adjustment-client\|recordObligationAdjustment\|direction.*increase" -- src/components src/modules
```

Record the exact component path in the execution evidence. If there is no existing normal UI adjustment surface, STOP with `PROTECTED_DESIGN_GAP=NO_EXISTING_ADJUSTMENT_UI` rather than inventing a new workspace.

- [ ] **Step 2: Write the UI contract RED test**

The test must prove:

```text
general remains default
classification control is available only for increase
changing to decrease removes/resets debit_event
debit_event copy describes a financial-event classification, not "Nota de Débito guaranteed"
no tax field is rendered
no tenant/institution selector is rendered
submitted mutation includes basisType and no fiscal/tax decision fields
```

- [ ] **Step 3: Run and prove RED**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
```

Expected: FAIL because the classification is not yet exposed.

- [ ] **Step 4: Implement the smallest UI change inside the existing screen**

Use a bounded choice such as:

```text
Natureza do aumento
- Ajuste financeiro geral
- Evento de débito sujeito a validação documental
```

Required behavior:

```text
default = general
if direction != increase => force general and hide/disable debit-event choice
never show "Nota de Débito disponível" at this prerequisite stage
never ask the user for zero-tax/tax mode/document type
```

- [ ] **Step 5: Re-run UI + HTTP tests**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit UI slice**

```bash
git add <exact-existing-adjustment-component> tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
git commit -m "feat(finance): classify debit event adjustments in product flow"
```

Replace `<exact-existing-adjustment-component>` with the actual traced path before running `git add`; do not commit a literal placeholder.

---

### Task 5: Fresh Aggregate Verification and Prerequisite Adjudication

**Files:**
- No product-code change expected.
- Update PAP evidence only after factual closure, and only if an existing canonical Finance/PAP feature record is already the approved destination.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: evidence-backed decision whether the Task 9 prerequisite is CLOSED and whether Nota de Débito implementation may resume.

- [ ] **Step 1: Run focused evidence from exact HEAD**

```bash
npx tsx tests/finance-obligation-adjustment-debit-event-model.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-postgres.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-http.test.ts
npx tsx tests/finance-obligation-adjustment-debit-event-ui-contract.test.ts
npm run test:migrations:isolated
```

- [ ] **Step 2: Run affected Finance regression and repository gates**

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

If the aggregate Finance command fails, classify the first failure as `PRODUCT | IMPLEMENTATION | ENVIRONMENT | AUTOMATION | TEST | DEPENDENCY | CONFIGURATION | UNKNOWN`; do not weaken or skip the test to claim closure.

- [ ] **Step 3: Perform one normal product-path Human UAT for the prerequisite only**

Using the existing adjustment UI:

```text
open a legitimate open Obligation
record an increase classified as debit_event
verify amount/reason/classification visibly
refresh
verify the same adjustment remains
restart application
relogin
verify the same persisted adjustment/classification remains
```

Do not issue a Nota de Débito yet. Do not use SQL/Postman/helper to substitute for the product-path action.

- [ ] **Step 4: Perform independent readback after Human UAT**

Read-only evidence must prove:

```text
basis_type=debit_event on the exact adjustment row
direction=increase
amount/currency/reason unchanged
institution/obligation/actor correct
journal transaction linked
idempotency record linked
no duplicate adjustment
no financial document was created by this prerequisite
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

`PREREQUISITE_STATUS=CLOSED` requires fresh machine evidence plus successful normal-path refresh/restart UAT and independent readback.

- [ ] **Step 6: Commit only factual closure documentation if required**

If the repository already has a canonical PAP/feature-journal location for Finance capabilities, update it truthfully as `IN_DEVELOPMENT` for Nota de Débito and record this prerequisite as proven. Do not create a new parallel documentation system.

---

## Self-Review

- Spec coverage: all approved invariants are mapped to Tasks 1–5.
- Architecture: no new aggregate/table/endpoint/workspace; only one nullable/check-constrained column on the existing authority.
- Type consistency: `basisType` is consistently `general | debit_event`; persisted column is `basis_type`.
- Fiscal boundary: zero-tax remains derived later from AO policy and is never a browser field.
- Backward compatibility: absent/null basis is `general`; no destructive backfill.
- Evidence: closure requires RED→GREEN, PostgreSQL, tenant/idempotency, HTTP, UI, refresh/restart, Finance regression, lint/build/diff and independent readback.
- Scope: this plan closes only the Task 9 prerequisite; it does not implement or close Nota de Débito itself.
