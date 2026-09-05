# Finance Operational Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Fee Catalogue + Financial Account/Obligation + Payment authorities into one account-centered operational Finance experience without introducing Allocation or duplicating Person/Student/Enrollment authority.

**Architecture:** Add a read-only `FinanceOperationalContext` composition service/HTTP endpoint over existing institution-scoped repositories, then make the Finance UI select one account context and consume existing Obligation/Payment commands from that context. Fix the Payment client receiver bug only after deterministic characterization. Student/Enrollment entry points navigate into the same Finance context; they do not implement financial logic.

**Tech Stack:** TypeScript 5.8, React 19, Express 4, PostgreSQL/pg, tsx test runners, Vite.

**Spec:** `docs/superpowers/specs/2026-09-05-finance-operational-consolidation-design.md`

## Global Constraints

- Existing Finance authorities are consumed, not replaced.
- Finance must not duplicate Person, Student, Enrollment, Membership or Institution authority.
- Payment does not liquidate an Obligation; Allocation remains out of scope.
- No UI-derived net/settled balance is authorized.
- Institution/membership context is resolved server-side; foreign-tenant references fail closed.
- Existing exact-decimal Money and append-oriented Finance laws remain unchanged.
- No provider, fiscal, treasury, reconciliation or new Student/Enrollment authority may be introduced.
- Runtime SHA parity must be proven immediately before Human UAT.
- No completion claim without fresh verification evidence.

---

## File Structure

**New focused units**
- `src/modules/finance/finance-operational-context-model.ts` — presentation-safe read projection types only.
- `src/modules/finance/finance-operational-context-repository.ts` — institution-scoped composition of account, student/enrollment context, obligations and payments; no writes.
- `src/modules/finance/finance-operational-context-http.ts` — authenticated/authorized GET boundary.
- `src/modules/finance/finance-operational-context-client.ts` — browser read client.
- `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx` — selected-account operational surface.
- `src/components/finance/operational/FinanceOperationalContextHeader.tsx` — account/responsible/student identity presentation.
- `src/components/finance/operational/FinanceOperationalTruthPanels.tsx` — open obligations + confirmed/unallocated payments.
- `src/components/finance/operational/FinanceOperationalHistory.tsx` — typed chronological history.

**Existing units expected to change**
- `src/modules/finance/payment-client.ts` — safe default fetch wrapper; no broad refactor.
- `src/components/finance/payments/FinancePaymentCreateView.tsx` — accepts selected account/payer context and submits canonical IDs.
- `src/components/finance/FinanceWorkspace.tsx` — operational context becomes primary surface; Catalogue remains administrative.
- `server.ts` — register the new read endpoint using existing auth/context patterns.
- Student/Enrollment navigation component(s) identified by characterization in Task 7 — add navigation only, not Finance logic.
- `package.json` and a bounded aggregate runner if the repository convention requires a new Finance consolidation aggregate.

---

### Task 1: Characterize the Existing Finance Contracts and Freeze the No-Allocation Boundary

**Files:**
- Create: `tests/finance-operational-consolidation-characterization.test.ts`
- Read only: `src/modules/finance/financial-account-repository.ts`
- Read only: `src/modules/finance/financial-obligation-repository.ts`
- Read only: `src/modules/finance/payment-repository.ts`
- Read only: `src/modules/finance/payment-model.ts`

**Interfaces:**
- Consumes: `PostgresFinancialAccountRepository.getById/list`, `PostgresFinancialObligationRepository.list`, `PostgresPaymentRepository` read API, canonical `PaymentAllocationStatus`.
- Produces: executable characterization proving the repository can filter obligations/payments by `financialAccountId` and that Payment allocation status remains only the canonical unapplied state.

- [ ] **Step 1: Write the failing/characterization assertions**

Create a source-contract test that reads the existing modules and asserts these exact laws:

```ts
assert.match(obligationSource, /financialAccountId\?: string/);
assert.match(obligationSource, /o\.financial_account_id/);
assert.match(paymentSource, /financial_account_id/);
assert.match(paymentSource, /'unapplied'/);
assert.doesNotMatch(paymentModelSource, /partially_applied|fully_applied/);
```

Also assert `FinancialAccount` exposes the canonical account number and primary party/person identity used by the operational projection.

- [ ] **Step 2: Run the characterization test**

Run:

```bash
npx tsx tests/finance-operational-consolidation-characterization.test.ts
```

Expected: PASS. If any authority assumption fails, STOP and adjudicate the plan rather than inventing a parallel model.

- [ ] **Step 3: Commit only the characterization test**

```bash
git add tests/finance-operational-consolidation-characterization.test.ts
git commit -m "test(finance): characterize operational consolidation contracts"
```

---

### Task 2: Reproduce and Fix the Payment Client `Illegal invocation` Defect

**Files:**
- Create: `tests/finance-payment-client-fetch-regression.test.ts`
- Modify: `src/modules/finance/payment-client.ts`

**Interfaces:**
- Consumes: `PaymentApiClient`, `PaymentClientOptions.fetcher`, `confirmManualPayment()`.
- Produces: receiver-safe default fetch path while preserving injected fetchers.

- [ ] **Step 1: Write a deterministic failing regression test**

Use a receiver-sensitive stand-in and prove the default-style detached call fails before the implementation change. The test must also capture request path, Authorization and Idempotency-Key:

```ts
const owner = {
  calls: [] as Array<{ input: RequestInfo | URL; init?: RequestInit }>,
  async nativeLikeFetch(this: typeof owner, input: RequestInfo | URL, init?: RequestInit) {
    assert.equal(this, owner, 'receiver lost');
    this.calls.push({ input, init });
    return new Response(JSON.stringify({ payment: { id: 'pay-1' }, replayed: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

The regression must fail against the unsafe receiver pattern and must not be satisfied merely by mocking away the call.

- [ ] **Step 2: Run and capture RED**

```bash
npx tsx tests/finance-payment-client-fetch-regression.test.ts
```

Expected: FAIL with receiver/`Illegal invocation` equivalent.

- [ ] **Step 3: Apply the minimal fix**

Change only the default path in `PaymentApiClient`:

```ts
const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

constructor(options?: PaymentClientOptions) {
  this.fetcher = options?.fetcher ?? defaultFetch;
  this.getToken = options?.getToken ?? defaultGetToken;
}
```

Do not refactor unrelated clients.

- [ ] **Step 4: Prove request behavior**

Regression assertions must prove:

```ts
assert.equal(requestPath, '/api/finance/payments/manual');
assert.equal(headers.Authorization, 'Bearer test-token');
assert.ok(headers['Idempotency-Key']);
```

Also test JSON error parsing into `PaymentApiError`.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx tsx tests/finance-payment-client-fetch-regression.test.ts
git add src/modules/finance/payment-client.ts tests/finance-payment-client-fetch-regression.test.ts
git commit -m "fix(finance): invoke payment fetch safely"
```

---

### Task 3: Add the Read-Only Finance Operational Context Projection

**Files:**
- Create: `src/modules/finance/finance-operational-context-model.ts`
- Create: `src/modules/finance/finance-operational-context-repository.ts`
- Create: `tests/finance-operational-context-postgres.test.ts`

**Interfaces:**
- Consumes: `PostgresFinancialAccountRepository.getById`, `PostgresFinancialObligationRepository.list(actor, { financialAccountId })`, `PostgresPaymentRepository` account-filtered list/read contract, existing `people`, student/enrollment tables.
- Produces:

```ts
export type FinanceOperationalContext = {
  financialAccount: {
    id: string;
    accountNumber: string;
    name: string;
    status: string;
  };
  responsiblePerson: { personId: string; displayName: string } | null;
  students: FinanceOperationalStudent[];
  openObligations: FinanceOperationalObligation[];
  confirmedUnallocatedPayments: FinanceOperationalPayment[];
  history: FinanceOperationalHistoryItem[];
};

export class PostgresFinanceOperationalContextRepository {
  constructor(private readonly pool: Pool) {}
  getByFinancialAccountId(actor: InstitutionalContext, financialAccountId: string): Promise<FinanceOperationalContext>;
}
```

- [ ] **Step 1: Write PostgreSQL RED tests**

Fixture two institutions A/B. In A create person/student/enrollment/account/open obligation/confirmed unapplied payment. In B create a separate account. Assert:

```ts
assert.equal(ctx.financialAccount.accountNumber, 'CTA-000001');
assert.equal(ctx.responsiblePerson?.personId, payerA);
assert.equal(ctx.openObligations.length, 1);
assert.equal(ctx.confirmedUnallocatedPayments.length, 1);
assert.ok(ctx.history.some((x) => x.kind === 'obligation'));
assert.ok(ctx.history.some((x) => x.kind === 'payment'));
await assert.rejects(() => repo.getByFinancialAccountId(actorA, accountB));
```

The test must also prove that a Payment with no matching account is not leaked into the context.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-operational-context-postgres.test.ts
```

Expected: FAIL because the projection does not exist.

- [ ] **Step 3: Implement presentation types**

Use canonical Money transport objects. `history` must be a discriminated union:

```ts
export type FinanceOperationalHistoryItem =
  | { kind: 'obligation'; occurredAt: string; obligation: FinanceOperationalObligation }
  | { kind: 'payment'; occurredAt: string; payment: FinanceOperationalPayment };
```

No `balance`, `settled`, `remainingAfterPayment`, or allocation-derived field is permitted.

- [ ] **Step 4: Implement repository composition**

Resolve the account first with institution scope. Compose only from canonical tables/repositories. Student/enrollment joins must use existing canonical identifiers and institution predicates. Sort history deterministically by `occurredAt`, then stable ID.

- [ ] **Step 5: Run GREEN and existing Finance regressions**

```bash
npx tsx tests/finance-operational-context-postgres.test.ts
npm run test:finance:foundation
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/finance-operational-context-model.ts src/modules/finance/finance-operational-context-repository.ts tests/finance-operational-context-postgres.test.ts
git commit -m "feat(finance): add operational context projection"
```

---

### Task 4: Expose the Context Through the Existing Server Authority Boundary

**Files:**
- Create: `src/modules/finance/finance-operational-context-http.ts`
- Create: `tests/finance-operational-context-http.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Consumes: existing Firebase/institutional context middleware and Finance read-role policy patterns; `PostgresFinanceOperationalContextRepository.getByFinancialAccountId()`.
- Produces: `GET /api/finance/operational-context?financialAccountId=<uuid>`.

- [ ] **Step 1: Write HTTP contract RED tests**

Cover:

```text
401 no authenticated user
403 authenticated membership without Finance read capability
400 missing/invalid financialAccountId
200 authorized same-institution context
404/non-disclosing equivalent for foreign-tenant account
```

Assert the response contains presentation-safe fields and does not expose institution foreign IDs, idempotency keys, created-by internals, provider secret references or raw membership data.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-operational-context-http.test.ts
```

- [ ] **Step 3: Implement router**

Follow the same auth/context construction used by current Finance HTTP modules. The browser-provided `financialAccountId` is only a lookup key; institution authority comes from server context.

- [ ] **Step 4: Register router in `server.ts`**

Register next to existing Finance routers. Do not add an alternative auth path.

- [ ] **Step 5: Run GREEN + tenant isolation**

```bash
npx tsx tests/finance-operational-context-http.test.ts
npm run test:fnd03
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/finance/finance-operational-context-http.ts tests/finance-operational-context-http.test.ts server.ts
git commit -m "feat(finance): expose operational context read API"
```

---

### Task 5: Add the Browser Read Client and Account Selection Contract

**Files:**
- Create: `src/modules/finance/finance-operational-context-client.ts`
- Create: `tests/finance-operational-context-client.test.ts`
- Reuse: existing Financial Account list client if present; otherwise extend the existing Financial Account client rather than creating a second account authority.

**Interfaces:**
- Consumes: `GET /api/finance/operational-context`, existing auth token pattern.
- Produces:

```ts
export class FinanceOperationalContextClient {
  getByFinancialAccountId(financialAccountId: string): Promise<FinanceOperationalContext>;
}
```

- [ ] **Step 1: Write client RED test**

Assert encoded query string, bearer token propagation, 401/403 handling and typed successful projection.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-operational-context-client.test.ts
```

- [ ] **Step 3: Implement minimal client**

Use a receiver-safe fetch wrapper from the start. Do not copy the old unsafe `this.fetcher = fetch` pattern.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx tsx tests/finance-operational-context-client.test.ts
git add src/modules/finance/finance-operational-context-client.ts tests/finance-operational-context-client.test.ts
git commit -m "feat(finance): add operational context client"
```

---

### Task 6: Build the Account-Centered Finance Operational Surface

**Files:**
- Create: `src/components/finance/operational/FinanceOperationalContextWorkspace.tsx`
- Create: `src/components/finance/operational/FinanceOperationalContextHeader.tsx`
- Create: `src/components/finance/operational/FinanceOperationalTruthPanels.tsx`
- Create: `src/components/finance/operational/FinanceOperationalHistory.tsx`
- Create: `tests/finance-operational-context-ui-contract.test.ts`
- Modify: `src/components/finance/FinanceWorkspace.tsx`

**Interfaces:**
- Consumes: account list/read client, `FinanceOperationalContextClient`, existing theme prop.
- Produces: primary Finance surface centered on selected Financial Account.

- [ ] **Step 1: Write UI contract RED test**

Assert source/render contract includes:

```text
Conta financeira
Responsável financeiro
Alunos associados
Obrigações em aberto
Recebimentos confirmados não aplicados
Histórico financeiro
Registar recebimento
```

Also assert forbidden misleading labels are absent from the new operational surface:

```text
Liquidado
Saldo pago
Dívida restante após pagamento
```

unless they are clearly unrelated static documentation.

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-operational-context-ui-contract.test.ts
```

- [ ] **Step 3: Implement context selection and states**

Required states: loading accounts, no accounts, selected account loading, operational empty state, retry/error, authorized data. Keep account number/name visible while viewing the context.

- [ ] **Step 4: Implement truth panels and typed history**

Obligations and Payments remain visually distinguishable. Do not sum across currencies. Do not subtract Payments from Obligations.

- [ ] **Step 5: Make operational context the primary Finance tab**

Update `FinanceWorkspace` so the operational account surface is primary. Keep Fee Catalogue accessible as an administrative tab/link. Existing Obligation/Payment technical views may remain temporarily reachable if required for regression/admin support, but they must not be the only operational path.

- [ ] **Step 6: Run GREEN, lint and build**

```bash
npx tsx tests/finance-operational-context-ui-contract.test.ts
npm run lint
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/finance/operational src/components/finance/FinanceWorkspace.tsx tests/finance-operational-context-ui-contract.test.ts
git commit -m "feat(finance): center operations on financial account context"
```

---

### Task 7: Contextualize Manual/Offline Payment Creation

**Files:**
- Modify: `src/components/finance/payments/FinancePaymentCreateView.tsx`
- Modify: caller in `FinanceOperationalContextWorkspace.tsx`
- Create: `tests/finance-contextual-payment-ui-contract.test.ts`
- Extend: `tests/finance-payment-client-fetch-regression.test.ts`

**Interfaces:**
- Consumes: selected `financialAccount.id`, `financialAccount.accountNumber`, `responsiblePerson.personId/displayName`, `PaymentApiClient.confirmManualPayment()`.
- Produces:

```ts
export interface FinancePaymentCreateViewProps {
  theme?: string;
  financialAccount: { id: string; accountNumber: string; name: string };
  payerPerson?: { personId: string; displayName: string } | null;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
}
```

- [ ] **Step 1: Write RED contract test**

Assert the form requires a selected account prop, visibly renders account/responsible context, and calls:

```ts
paymentClient.confirmManualPayment({
  financialAccountId: financialAccount.id,
  payerPersonId: payerPerson?.personId,
  method,
  amount,
  currency,
  manualEvidenceRef,
  notes,
  effectiveAt,
});
```

- [ ] **Step 2: Run RED**

```bash
npx tsx tests/finance-contextual-payment-ui-contract.test.ts
```

- [ ] **Step 3: Implement context-bound form**

The account context is read-only in this form. Do not allow typing arbitrary account/person UUIDs. If payer is absent, send no `payerPersonId`; do not invent one.

- [ ] **Step 4: Refresh canonical context after success**

On successful payment, return to the account surface and re-fetch the operational context. Do not append a browser-only fake payment row.

- [ ] **Step 5: Run targeted tests and commit**

```bash
npx tsx tests/finance-contextual-payment-ui-contract.test.ts
npx tsx tests/finance-payment-client-fetch-regression.test.ts
npm run lint
npm run build
git add src/components/finance/payments/FinancePaymentCreateView.tsx src/components/finance/operational/FinanceOperationalContextWorkspace.tsx tests/finance-contextual-payment-ui-contract.test.ts tests/finance-payment-client-fetch-regression.test.ts
git commit -m "feat(finance): bind manual payments to account context"
```

---

### Task 8: Add Student and Enrollment Entry Points Without Moving Finance Authority

**Files:**
- Create: `tests/finance-context-entrypoints-contract.test.ts`
- Modify: exact existing Student detail/profile component identified by repository search.
- Modify: exact existing Enrollment detail/operations component identified by repository search.
- Modify: app navigation state/router only if needed to accept `financialAccountId` context.

**Interfaces:**
- Consumes: existing Student/Enrollment identifiers and an institution-scoped resolver to the Financial Account when one exists.
- Produces: navigation intent to the canonical Finance workspace, conceptually:

```ts
openFinance({ financialAccountId });
```

- [ ] **Step 1: Characterize exact entry-point files before editing**

Run repository searches:

```bash
git grep -n "StudentRecord\|Student.*Detail\|Aluno" -- src/components src/App.tsx
git grep -n "Enrollment\|Matrícula\|Inscrição" -- src/components src/App.tsx
```

Record the exact files in the SDD ledger. Do not create duplicate Student/Enrollment screens.

- [ ] **Step 2: Write RED contract test**

Assert both entry points expose `Ver situação financeira` only when a resolvable account context exists, and that the action routes to Finance rather than fetching/mutating Finance directly inside Student/Enrollment UI.

- [ ] **Step 3: Implement minimal navigation**

No Finance SQL, payment command or obligation mutation may be added to Student/Enrollment components.

- [ ] **Step 4: Run Student/Enrollment regressions**

Run the repository's existing targeted Student/Enrollment suites identified during characterization, plus:

```bash
npx tsx tests/finance-context-entrypoints-contract.test.ts
npm run test:fnd03
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add tests/finance-context-entrypoints-contract.test.ts <exact-characterized-files>
git commit -m "feat(finance): link student and enrollment to financial context"
```

---

### Task 9: Add a Bounded Finance Operational Consolidation Aggregate Gate

**Files:**
- Create: `scripts/run-finance-operational-consolidation.mjs`
- Modify: `package.json`
- Create: `tests/finance-operational-consolidation-runner.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–8 tests.
- Produces: `npm run test:finance:operational-consolidation`.

- [ ] **Step 1: Write runner RED test**

Require deterministic ordered execution and fail-fast behavior for:

```text
characterization
payment fetch regression
operational context PostgreSQL
operational context HTTP
operational context client
operational UI contract
contextual payment UI
Student/Enrollment entry points
```

- [ ] **Step 2: Implement runner and package script**

```json
"test:finance:operational-consolidation": "node scripts/run-finance-operational-consolidation.mjs"
```

Use the same child-process lifecycle discipline as existing Nexus aggregate runners.

- [ ] **Step 3: Run aggregate + regression gates**

```bash
npm run test:finance:operational-consolidation
npm run test:finance:foundation
npm run test:fnd03
npm run test:foundation
npm run lint
npm run build
npm run test:secrets
npm run test:diff
npm run test:artifacts
```

Expected: all PASS. Do not label an external provider dependency as a failure of this internal consolidation mission.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-finance-operational-consolidation.mjs tests/finance-operational-consolidation-runner.test.mjs package.json
git commit -m "test(finance): gate operational consolidation"
```

---

### Task 10: Independent Review, Runtime Parity and Human UAT

**Files:**
- Create/update: bounded evidence file under the repository's existing Finance evidence convention only if that convention is currently used.
- No product-code change unless a verified defect is found.

**Interfaces:**
- Consumes: completed implementation SHA and all gates.
- Produces: independent review verdict + Human UAT verdict.

- [ ] **Step 1: Request independent code review**

Review the full diff against the approved spec. Critical/Important findings must be remediated and re-reviewed before UAT. Specifically inspect:

```text
tenant isolation
no duplicate Person/Student authority
no Allocation semantics
no browser-only financial truth
Payment client receiver safety
contextual payer/account binding
history remains typed
no cross-currency netting
```

- [ ] **Step 2: Freshly verify completion gates**

Immediately before claiming readiness, rerun:

```bash
npm run test:finance:operational-consolidation
npm run test:finance:foundation
npm run test:fnd03
npm run test:foundation
npm run lint
npm run build
npm run test:secrets
npm run test:diff
npm run test:artifacts
```

Capture actual command exits. Old PASS reports are not evidence.

- [ ] **Step 3: Prove runtime SHA parity before UAT**

Record:

```text
WORKTREE_SHA=<sha>
SERVER_SHA=<sha>
FRONTEND_SHA=<sha>
RUNTIME_PARITY=PASS
```

If any mismatch exists, perform runtime recovery only. Do not modify product code to compensate for a stale server/browser.

- [ ] **Step 4: Execute Human UAT**

Human validates:

```text
1. Open Finance and resolve known account/student.
2. Responsible person + associated student are understandable.
3. Known open obligation is visible.
4. Register manual/offline payment from the selected context.
5. No Illegal invocation / console error.
6. Refresh browser; payment persists from server.
7. Obligation remains unchanged/unallocated.
8. Open same Finance context from Student entry point.
9. Check light + dark + responsive behavior.
10. Attempt foreign-tenant context and confirm denial/non-disclosure.
```

- [ ] **Step 5: Final bounded diff review**

```bash
git diff --check
```

Confirm no unrelated ALUNOS/Enrollment behavior changed beyond the approved navigation entry point and no provider/Allocation code was introduced.

- [ ] **Step 6: Closure decision**

Only after fresh evidence and Human UAT:

```text
FINANCE_OPERATIONAL_CONSOLIDATION=PASS
ILLEGAL_INVOCATION_REGRESSION=PASS
CONTEXTUAL_PAYMENT_UAT=PASS
TENANT_ISOLATION=PASS
ALLOCATION_INTRODUCED=NO
READY_TO_FREEZE=YES
```

If any line cannot be evidenced, report the precise failing gate rather than a general GREEN.

---

## Self-Review Record

- **Spec coverage:** all three approved journeys, no-Allocation law, tenant safety, Payment receiver defect, Student/Enrollment entry points, runtime parity and Human UAT have explicit tasks.
- **Placeholder scan:** no implementation step relies on `TBD`, `TODO`, or unspecified generic error handling. Task 8 intentionally requires repository characterization because exact Student/Enrollment component filenames must be discovered from the execution branch before editing; it forbids inventing replacements.
- **Type consistency:** `FinanceOperationalContext`, account/payer IDs, Money transport, and typed history are used consistently across repository, HTTP, client and UI tasks.
- **Scope check:** provider integration, Allocation, reconciliation, fiscal and treasury work are explicitly excluded and therefore do not require sub-project plans here.