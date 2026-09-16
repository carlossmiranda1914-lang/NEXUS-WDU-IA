# Finance F7 Coherence Solidification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solidify the existing Finance F7 corridor so that readiness, configuration and document relationships are truthful and operable before Task 9 adds Nota de Débito.

**Architecture:** Preserve all frozen Finance authorities. This plan changes presentation and normal-product operability around existing server-side authorities: first correct over-broad readiness copy, then expose existing fiscal-configuration/series commands through the normal UI, then make source/document/correction navigation bilateral and unambiguous, and finally complete the outstanding Task 8 human evidence. No new Finance domain architecture is introduced.

**Tech Stack:** TypeScript, React, Node.js/Express, PostgreSQL, existing Finance clients/HTTP/service/repository patterns, existing focused tests.

**Spec:** `docs/superpowers/specs/2026-09-12-finance-f7-g02-angola-production-jurisdiction-design.md`

**Canonical parent plan:** `docs/superpowers/plans/2026-09-12-finance-f7-g02-angola-production-jurisdiction.md`

## Global Constraints

- `PRODUCT_MODE=SOLIDIFICATION`.
- `REUSE_BEFORE_EXPANSION=MANDATORY`.
- `NEW_FINANCE_ARCHITECTURE=NO`.
- Task 9 / Nota de Débito must not start until this plan's Task 8 closure gate is adjudicated.
- Existing Financial Account, Fee Catalogue, Obligation, Payment, Allocation, numbering, tenant/IAM, idempotency, audit/outbox and immutable documentary authorities remain frozen unless a reproducible defect proves otherwise.
- A Financial Obligation is a receivable, not an institutional payable/expense.
- A Nota de Crédito corrects an eligible issued document; it does not directly correct an obligation.
- Current Credit Note eligibility remains `invoice_receipt` snapshot V4 only until primary AO evidence or an approved contract proves broader eligibility.
- `readiness.status=READY` must never be presented as universal per-document or AO-production readiness.
- `NEXUS_TEST/core` remains UAT-only and must never be described as AO production.
- Normal product configuration must not require SQL, Postman, fabricated DevTools requests or hidden helpers.
- Product UX redesign remains out of scope; changes here are Validation UI/Product Truth only.
- Human UAT remains mandatory for Task 8 closure.

---

### Task 1: Correct Finance Readiness Product Truth

**Files:**
- Modify: `src/components/finance/configuration/FinanceConfigurationWorkspace.tsx`
- Test: existing Finance configuration/readiness UI tests; add focused assertions only where absent.

**Interfaces:**
- Consumes: existing `FinanceReadinessDto`, per-document readiness authority and AGT reason codes.
- Produces: UI copy that distinguishes base institutional configuration from document-specific and AO-production readiness.

- [ ] Write a failing UI test proving `readiness.status === 'READY'` must not render the global claim `Finance pronta` / `Finance operacionalmente pronta`.
- [ ] Add a failing assertion that the same state renders wording equivalent to `Configuração base concluída` while preserving explicit document/production warnings.
- [ ] Run the focused test and capture RED.
- [ ] Replace only the over-broad readiness copy; do not change readiness computation or server authority.
- [ ] Make the UI explain that document issuance readiness is evaluated separately by document type and that AO production may remain blocked by external prerequisites.
- [ ] Run focused configuration/readiness regressions and `git diff --check`.
- [ ] Commit: `fix(finance): clarify readiness product truth`.

### Task 2: Make Fiscal Configuration and Document Series Operable Through Normal UI (Canonical F7 Task 10)

**Files:**
- Modify: `src/components/finance/configuration/FinanceConfigurationWorkspace.tsx`
- Modify: `src/modules/finance/finance-readiness-client.ts`
- Modify only existing Finance configuration/series HTTP/service/repository files if the normal client lacks already-approved command exposure.
- Test: existing Finance configuration/series HTTP and UI tests; add focused integration tests for each newly exposed normal UI command.

**Interfaces:**
- Consumes: existing effective Financial Profile, fiscal-adapter policy, Fiscal Configuration authority, Document Series authority, membership/capability checks.
- Produces: normal UI management of effective fiscal configuration and series where server policy says the action is available.

- [ ] Inventory the exact existing create/update endpoints for Fiscal Configuration and Document Series; do not invent parallel routes.
- [ ] Write RED client/UI tests for server-authorized creation of fiscal configuration from the normal configuration workspace.
- [ ] Write RED client/UI tests for creation/management of the document series types already supported by backend policy: `receipt`, `invoice`, `invoice_receipt`, `credit_note`, and later `debit_note` only when Task 9 exists.
- [ ] Prove the UI cannot create a production AO configuration or series when the server returns AGT/policy/signing/production-series prerequisites as blocked.
- [ ] Expose only existing server commands through the client and UI. Browser must not select tenant authority, adapter authority, numbering authority or legal rules.
- [ ] Replace the current read-only series summary with actionable controls only when `canManageConfiguration` and server readiness allow the action.
- [ ] Show each document family separately; do not reduce all series readiness to `RECEIPT_SERIES` language in the user-facing explanation.
- [ ] Run targeted HTTP/client/UI tests, Finance regressions affected by configuration and `git diff --check`.
- [ ] Commit: `feat(finance): make fiscal configuration and series operable`.

### Task 3: Make Document Provenance and Correction Navigation Bilateral (Canonical F7 Task 11)

**Files:**
- Modify: `src/components/finance/FinanceWorkspace.tsx`
- Modify: `src/components/finance/documents/FinancialDocumentsWorkspace.tsx`
- Modify: `src/components/finance/documents/SelectedFinancialDocumentDetail.tsx`
- Test: existing Finance documents interaction tests; add focused navigation assertions.

**Interfaces:**
- Consumes: existing document detail sources/corrections, payment references, obligation references and document IDs.
- Produces: unambiguous source ↔ document and original ↔ correction navigation without changing financial authority.

- [ ] Write RED interaction tests for `document -> obligation` opening the exact referenced obligation, not merely the obligations area.
- [ ] Write RED interaction tests for `original document -> correction` opening the selected correction document.
- [ ] Write RED interaction tests for `credit note -> original document` opening the corrected original document.
- [ ] Preserve the already-clear `document -> payment` path.
- [ ] Add explicit semantic copy in document detail distinguishing `Proveniência do documento` from `Correções do documento`.
- [ ] On a Credit Note, state that obligation/payment shown are historical provenance inherited from the corrected document and are not being corrected directly.
- [ ] Wire selection/navigation using existing IDs/references; do not add browser-side finance authority.
- [ ] Run focused document interaction tests including the existing large-list/1000-document regression and `git diff --check`.
- [ ] Commit: `fix(finance): clarify document provenance navigation`.

### Task 4: Re-adjudicate Credit Note Semantics Without Expanding Eligibility

**Files:**
- Read/verify: `src/components/finance/documents/SelectedFinancialDocumentDetail.tsx`
- Read/verify: `src/modules/finance/financial-document-credit-note.ts`
- Read/verify: `src/modules/finance/financial-document-http.ts`
- Read/verify: `src/modules/finance/financial-document-service.ts`
- Read/verify: AO evidence/rule matrix.
- Production change: none unless a reproducible contradiction with the approved Task 8 contract is proven.

**Interfaces:**
- Consumes: current `invoice_receipt` V4 eligibility and evidence-backed policy.
- Produces: explicit adjudication of whether the current eligibility is a valid pilot limitation or a proven implementation defect.

- [ ] Verify UI and backend still agree on `invoice_receipt` V4-only eligibility.
- [ ] Verify original-document immutability, correction linkage, exact permitted amount, currency, tenant, idempotency, numbering, audit and outbox regressions remain green.
- [ ] Re-read the Angola evidence matrix for eligible original-document types.
- [ ] If evidence does not prove broader eligibility, record `CREDIT_NOTE_ELIGIBILITY=PILOT_LIMITATION` and make no expansion.
- [ ] If evidence proves a missing required original type, STOP and produce a separate bounded change request before modifying authority.
- [ ] No commit unless tracked adjudication evidence is required by repository policy.

### Task 5: Complete Task 8 Human Vertical Evidence

**Files:**
- Production change: none expected.
- Evidence/documentation: update only the existing approved evidence location if the repository requires tracked closure evidence.

**Interfaces:**
- Consumes: implemented Credit Note flow after Tasks 1-3 and existing authoritative backend.
- Produces: E8 + artifact + restart adjudication tied to an exact HEAD.

- [ ] Prepare one legitimate UAT state containing an eligible issued Factura-Recibo without issuing the Credit Note through helpers/API/SQL.
- [ ] Human performs normal UI flow: authenticated Finance user → Documents → select eligible Factura-Recibo → observe server readiness → issue Nota de Crédito → observe definitive number/value/original relation.
- [ ] Human refreshes and confirms the same Credit Note remains visible.
- [ ] Generate/open official artifact from the persisted issued document through the normal UI.
- [ ] Restart the application without changing data; log back in and confirm the same document number, amount, correction relation and artifact remain.
- [ ] After UI issuance, independently verify PostgreSQL row, original immutability, correction link, audit/outbox and absence of duplicate issuance.
- [ ] Adjudicate exactly:

```text
E8=PASS|UNPROVEN|FAIL
ARTIFACT=PASS|UNPROVEN|FAIL
RESTART_PERSISTENCE=PASS|UNPROVEN|FAIL
TASK_8=CLOSED|UNPROVEN|BLOCKED
READY_FOR_TASK_9=YES|NO
```

- [ ] Task 8 may be `CLOSED` only when E1-E8, artifact and restart evidence are all green on the exact final HEAD.

### Task 6: Solidification Closure and Handoff to Task 9

**Files:**
- Update only existing project state/evidence documents required by canonical governance after closure.

**Interfaces:**
- Consumes: Tasks 1-5 evidence.
- Produces: one bounded decision whether canonical F7 Task 9 may start.

- [ ] Run targeted Finance regressions affected by Tasks 1-3, lint/build only if required by the active Finance gate, and `git diff --check`.
- [ ] Confirm no new payable/expense domain was introduced.
- [ ] Confirm no Credit Note eligibility broadening occurred without primary evidence.
- [ ] Confirm base readiness copy no longer implies universal document/AO-production readiness.
- [ ] Confirm fiscal configuration/series normal UI is authoritative and server-gated.
- [ ] Confirm bilateral document navigation is usable and semantically clear.
- [ ] Confirm exact HEAD and remote parity.
- [ ] Return:

```text
RESULT=
FINAL_HEAD=
READINESS_PRODUCT_TRUTH=PASS|FAIL
FISCAL_CONFIGURATION_NORMAL_UI=PASS|FAIL|BLOCKED
DOCUMENT_SERIES_NORMAL_UI=PASS|FAIL|BLOCKED
DOCUMENT_NAVIGATION=PASS|FAIL
CREDIT_NOTE_ELIGIBILITY=PILOT_LIMITATION|PROVEN_COMPLETE|CHANGE_REQUIRED
TASK_8_STATUS=CLOSED|UNPROVEN|BLOCKED
E8=
ARTIFACT=
RESTART_PERSISTENCE=
AO_PRODUCTION_STATUS=
PRODUCT_STATUS=
PAP_STATUS=
READY_FOR_TASK_9=YES|NO
NEXT_CAUSAL_GAP=
```

## Self-Review

- The plan does not create a parallel Finance roadmap; Tasks 2 and 3 implement canonical F7 Tasks 10 and 11 early only because the Product Realism audit proved they are prerequisites for coherent validation of Task 8.
- No new Finance domain architecture is introduced.
- Payables/expenses remain explicitly out of current scope.
- Credit Note eligibility is not broadened without primary evidence.
- `Finance READY` is narrowed to truthful base-configuration language without weakening server readiness.
- Human UAT, artifact and restart evidence remain mandatory before Task 8 closure.
