# F7-G02 Angola Production Jurisdiction Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance the real Finance F7 corridor by implementing Angola (`AO`) as the first production jurisdiction for Factura, Factura-Recibo, Recibo, Nota de Crédito and Nota de Débito without reopening frozen Finance authorities or regressing already-proven behavior.

**Architecture:** Reuse the existing Finance F7 architecture as authoritative: Institution Financial Profile resolves jurisdiction; Fiscal Configuration remains adapter-governed; universal issuance concerns stay in the shared Finance core; Angola contributes only evidence-backed jurisdiction/document semantics. Each document type receives its own eligibility/source semantics and is production-ready only after evidence, policy, persistence, numbering, artifact and human normal-flow proof are all green.

**Tech Stack:** TypeScript, Node.js, Express, React, PostgreSQL, Firebase identity, existing Finance command/repository patterns, Node/tsx tests, existing artifact/PDF pipeline.

**Spec:** `docs/superpowers/specs/2026-09-12-finance-f7-g02-angola-production-jurisdiction-design.md`

## Global Constraints

- `PRIMARY_PRIORITY=FULL_REAL_FINANCE_CORRIDOR`.
- `EVOLUTION_NOT_REGRESSION=YES`.
- Existing F0/F1 Finance Constitution, G01 institutional configuration, Financial Document authority, numbering authority, Documentary Snapshot V2, Institution Legal Profile, document-party architecture, tenant/IAM model, correction-chain invariant, canonical presentation and artifact authority are frozen unless a reproducible defect proves otherwise.
- `NEW_FINANCE_ARCHITECTURE=NO`.
- `PRIMARY_OFFICIAL_EVIDENCE_REQUIRED=YES`.
- Secondary sources may assist research but cannot enable production fiscal behavior.
- `NEXUS_TEST` and adapter key `core` remain test/UAT-only and are forbidden as Angola production fallbacks.
- No country-specific legal branches in generic Finance core.
- No hidden default jurisdiction, currency, fiscal profile, series or legal rule.
- Unsupported, incomplete, ambiguous or conflicting Angola evidence fails closed.
- Readiness is per document type; one blocked type must not falsely mark the whole jurisdiction ready or force supported types to fail.
- No document type is declared production-ready from registry presence, unit tests, HTTP 200 or non-empty PDF bytes alone.
- Normal product flow must not require SQL, direct DB mutation, Postman, fabricated DevTools requests or hidden helpers.
- Human UAT is mandatory before a capability is marked complete.
- Visual/Aurora redesign remains deferred until the functional corridor closes.
- A task may modify generic shared code only when the change is required to expose an already-approved extension point. Unrelated refactoring is forbidden.
- Before every commit, run targeted regressions proving previously frozen behavior still passes.
- A test failure or environment setup issue is `IN_PROGRESS`, not a Product Owner blocker, unless investigation proves an architectural/security/product decision is required.

---

## File/Responsibility Map

The executor must first reconcile exact repository names at the implementation baseline, then keep responsibilities aligned to these existing boundaries:

- `src/modules/finance/fiscal-adapter-registry.ts` — production adapter registration and generic adapter lookup only.
- `src/modules/finance/financial-document-eligibility.ts` — shared/document-family eligibility orchestration; no Angola legal constants.
- `src/modules/finance/financial-document-service.ts` — shared issuance/correction transaction authority; document-specific source loaders/composers must not turn it into a monolith.
- `src/modules/finance/documentary-snapshot.ts` — existing immutable documentary snapshot contracts/composers; extend only where a new document family cannot be represented without an approved typed addition.
- `src/modules/finance/finance-readiness.ts` and `finance-readiness-http.ts` — server-derived readiness and reason codes.
- `src/modules/finance/financial-document-series.ts` and existing series HTTP/configuration boundaries — authoritative series resolution/creation.
- `src/modules/finance/financial-document-presentation.ts` and artifact renderer/service — canonical presentation and PDF/artifact generation, never fiscal authority.
- New Angola jurisdiction files must live under the existing Finance jurisdiction boundary, preferably `src/modules/finance/jurisdictions/angola/`, and must not duplicate generic Finance authorities.
- Evidence documentation must live under `docs/finance/angola/` or the closest existing Finance documentation authority discovered during Task 1; do not create a parallel documentation hierarchy if one already exists.

---

### Task 1: Lock the Implementation Baseline and Prove No Regression Before Change

**Files:**
- Read: `docs/superpowers/specs/2026-09-12-finance-f7-g02-angola-production-jurisdiction-design.md`
- Read: `docs/superpowers/specs/2026-09-08-finance-f7-financial-documents-design.md`
- Read: `docs/superpowers/specs/2026-09-11-nexus-document-architecture-v1-design.md`
- Read: `docs/superpowers/plans/2026-09-12-finance-f7-g01-normal-institutional-configuration.md`
- Read: current `src/modules/finance/*` implementation and Finance migrations/tests.
- Production change: none.

**Interfaces:**
- Consumes: exact implementation branch/SHA and existing frozen contracts.
- Produces: one baseline report that later tasks use as the non-regression reference.

- [ ] **Step 1: Create an isolated implementation worktree/branch from the exact approved Finance baseline**

Run the repository-approved worktree workflow. Capture:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin --prune
git log --oneline --decorate -20
```

Expected: clean worktree; exact baseline identified; no implementation on `main`.

- [ ] **Step 2: Reconcile current Finance migration authority and working files**

List current Finance migrations and confirm the next safe forward-only migration number if any schema change becomes necessary. Do not create a migration merely because G02 exists.

- [ ] **Step 3: Run the currently accepted Finance regression gates before touching production code**

Run the repository scripts that cover F2-F6/F7, Foundation, lint, build, diff and secret scanning. Record exact commands and outcomes.

Expected: baseline PASS. If baseline is already red, diagnose before G02 and do not attribute the failure to new work.

- [ ] **Step 4: Record the frozen-boundary checklist**

Create an execution note outside tracked product files or in the approved evidence location with:

```text
BASELINE_SHA=<sha>
G01_CONFIGURATION=FROZEN
FINANCE_CONSTITUTION=FROZEN
NUMBERING=FROZEN
SNAPSHOT_V2=FROZEN
TENANT_IAM=FROZEN
DOCUMENT_IMMUTABILITY=FROZEN
CORRECTION_CHAIN=FROZEN
CANONICAL_PRESENTATION=FROZEN
ARTIFACT_AUTHORITY=FROZEN
```

- [ ] **Step 5: Commit only if repository policy requires tracked adjudication evidence**

No production code change belongs in Task 1.

---

### Task 2: Build the Authoritative Angola Evidence Inventory and Rule Matrix

**Files:**
- Create: `docs/finance/angola/ANGOLA_FISCAL_EVIDENCE_PACK_V1.md` (or exact existing canonical equivalent discovered in Task 1).
- Create: `docs/finance/angola/ANGOLA_DOCUMENT_RULE_MATRIX_V1.md`.
- Test: documentation/evidence validation test only if repository already has a pattern for machine-validating evidence manifests.

**Interfaces:**
- Consumes: official primary legal/technical sources only for production-enabling claims.
- Produces: explicit `PROVEN | NOT_APPLICABLE | BLOCKED` status for every required rule category of every document type.

- [ ] **Step 1: Inventory authoritative primary sources**

For each source record:

```text
source_id
official_title
issuing_authority
publication_date
effective_date_if_known
official_location/reference
scope
supersedes_or_amends
retrieval_date
```

At minimum reconcile the already-identified Decreto Presidencial n.º 71/25 and Decreto Executivo n.º 683/25. Do not copy technical/e-invoicing requirements from secondary summaries when the primary source has not been verified.

- [ ] **Step 2: Build the per-document rule matrix**

For each of `invoice`, `invoice_receipt`, `receipt`, `credit_note`, `debit_note`, classify:

```text
legal recognition/applicability
authoritative issuance event/source
mandatory fields
series/numbering requirements
tax/document treatment
related-document references
correction/cancellation semantics
mandatory legal mentions/validation elements
electronic/technical requirements
exceptions/regime limits
```

Every cell must be `PROVEN`, `NOT_APPLICABLE` or `BLOCKED`, with source reference and interpretation.

- [ ] **Step 3: Add a rule-to-source traceability section**

Each executable production rule must have:

```text
RULE_ID -> SOURCE_ID -> EXACT_NORMATIVE_BASIS -> NEXUS_INTERPRETATION -> DOCUMENT_TYPE -> EXPECTED_POLICY_BEHAVIOR
```

- [ ] **Step 4: Run a self-review for unsupported claims**

Search the evidence pack for language such as `assume`, `probably`, `normally`, `likely`, `TBD`, `TODO`. Any production-relevant occurrence must become either precise evidence or `BLOCKED`.

- [ ] **Step 5: Gate production enablement**

If any mandatory rule for a document type remains unresolved, mark that type `BLOCKED`. Do not remove it from G02 scope.

- [ ] **Step 6: Commit**

```bash
git add docs/finance/angola
git commit -m "docs(finance): establish Angola fiscal evidence pack"
```

---

### Task 3: Implement the Angola Policy Boundary Without Duplicating Finance Core

**Files:**
- Create: `src/modules/finance/jurisdictions/angola/angola-document-policy.ts`
- Create: `src/modules/finance/jurisdictions/angola/angola-evidence-manifest.ts`
- Create: `tests/finance-angola-document-policy.test.ts`
- Modify: `src/modules/finance/fiscal-adapter-registry.ts` only after policy tests are green.

**Interfaces:**
- Consumes: the rule matrix from Task 2.
- Produces:

```ts
export type AngolaDocumentType =
  | 'invoice'
  | 'invoice_receipt'
  | 'receipt'
  | 'credit_note'
  | 'debit_note';

export type AngolaDocumentCapability = Readonly<{
  documentType: AngolaDocumentType;
  status: 'READY' | 'BLOCKED';
  reasonCode?: string;
  policyVersion: string;
}>;

export function resolveAngolaDocumentCapability(
  documentType: AngolaDocumentType,
  at: Date,
): AngolaDocumentCapability;
```

- [ ] **Step 1: Write RED tests for evidence-gated capability resolution**

Test at minimum:

```ts
assert.equal(resolveAngolaDocumentCapability('receipt', effectiveDate).status, expectedReceiptStatus);
assert.equal(resolveAngolaDocumentCapability('invoice', effectiveDate).policyVersion, expectedPolicyVersion);
```

Add negative tests proving blocked evidence cannot return `READY`, ambiguous effective policy fails closed, and unsupported dates do not silently select a policy.

- [ ] **Step 2: Run RED**

Run:

```bash
node --import tsx --test tests/finance-angola-document-policy.test.ts
```

Expected: FAIL because the Angola policy files do not exist.

- [ ] **Step 3: Implement the smallest evidence-backed policy representation**

Do not place Payment/Obligation repositories, tenant context, numbering, persistence or IAM inside the Angola policy files.

- [ ] **Step 4: Run GREEN**

Run the focused policy test.

- [ ] **Step 5: Register Angola in `productionFiscalAdapterRegistry` only if at least one document capability is legitimately production-ready**

Use a production adapter key distinct from `core`, and support jurisdiction `AO`. The adapter must expose only document types whose capability status is `READY`; blocked document types remain unsupported/fail-closed.

- [ ] **Step 6: Prove UAT composition remains isolated**

Tests must prove `NEXUS_TEST/core` is still selected only through explicit UAT composition and cannot satisfy `AO` production resolution.

- [ ] **Step 7: Commit**

```bash
git add src/modules/finance/jurisdictions/angola src/modules/finance/fiscal-adapter-registry.ts tests/finance-angola-document-policy.test.ts
git commit -m "feat(finance): add evidence-backed Angola jurisdiction policy"
```

---

### Task 4: Extend Server Readiness to Per-Document Angola Capability

**Files:**
- Modify: `src/modules/finance/finance-readiness.ts`
- Modify: `src/modules/finance/finance-readiness-http.ts`
- Modify: `src/modules/finance/financial-document-eligibility.ts` only to share stable reason codes/evaluators.
- Test: existing readiness tests plus new `tests/finance-angola-readiness.test.ts` if needed.

**Interfaces:**
- Consumes: `resolveAngolaDocumentCapability` and existing profile/config/series authorities.
- Produces document-type readiness projection, e.g.:

```ts
type DocumentIssuanceReadiness = Readonly<{
  documentType: 'invoice' | 'invoice_receipt' | 'receipt' | 'credit_note' | 'debit_note';
  status: 'READY' | 'BLOCKED';
  reasonCode?: string;
}>;
```

- [ ] **Step 1: Write RED tests for mixed readiness**

Prove one document type can be `READY` while another is `BLOCKED`; module-level jurisdiction support must not imply all types are ready.

- [ ] **Step 2: Add RED tests for missing fiscal configuration and missing document-specific series**

No blocked precondition may be converted into generic success.

- [ ] **Step 3: Implement server-side per-document readiness using existing authorities**

Resolution order:

```text
institution/context
-> legal profile
-> financial profile/jurisdiction
-> Angola policy capability
-> effective fiscal configuration
-> document-specific series
-> source/documentary prerequisites when source is known
```

- [ ] **Step 4: Run GREEN and existing G01 readiness regressions**

G01 actionable legal/financial profile configuration must remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance/finance-readiness.ts src/modules/finance/finance-readiness-http.ts src/modules/finance/financial-document-eligibility.ts tests
git commit -m "feat(finance): expose per-document Angola readiness"
```

---

### Task 5: Close Recibo Angola End-to-End Without Rebuilding the Receipt Engine

**Files:**
- Modify only the minimum existing receipt eligibility/issuance/readiness/configuration files required.
- Test: extend receipt PostgreSQL/HTTP/artifact/browser tests.

**Interfaces:**
- Consumes: confirmed `Payment`, Angola policy, effective fiscal configuration, receipt series, existing document parties, Documentary Snapshot V2, issuance transaction.
- Produces: official Angola Recibo through the existing Financial Document authority.

- [ ] **Step 1: Write RED integration tests using real PostgreSQL**

Required cases:

```text
AO profile + valid evidence-backed receipt policy + valid fiscal config + active receipt series + confirmed payment -> eligible
missing mandatory Angola receipt rule/data -> blocked
wrong adapter/config -> blocked
cross-tenant payment/series -> blocked
```

- [ ] **Step 2: Prove current failure before implementation**

Expected current state: `JURISDICTION_POLICY_UNAVAILABLE` or unsupported AO adapter.

- [ ] **Step 3: Implement only missing Angola-specific receipt policy/configuration integration**

Do not rewrite `resolveReceiptEligibility`, numbering, snapshot V2, document-party resolution or idempotent issuance unless a reproducible defect demands it.

- [ ] **Step 4: Run issuance, idempotency and numbering tests**

Same idempotency key must return the same document; concurrent distinct issuance in one series must remain unique and policy-valid.

- [ ] **Step 5: Run artifact/PDF verification from persisted snapshot**

The artifact must represent the issued document and not query current mutable economic truth to rebuild it.

- [ ] **Step 6: Perform authenticated browser UAT through normal product routes**

Required story:

```text
real confirmed payment
-> Recibo eligible
-> preview
-> issue once
-> definitive series/number
-> open official artifact
-> refresh
-> logout/login
-> application restart
-> same document/number/snapshot/artifact
```

- [ ] **Step 7: Commit only after machine + human receipt evidence is green**

```bash
git commit -m "feat(finance): close Angola receipt corridor"
```

---

### Task 6: Implement Factura from Obligation as a True Document Family

**Files:**
- Modify: `src/modules/finance/financial-document-eligibility.ts`
- Create focused invoice source/snapshot helper if required, e.g. `src/modules/finance/financial-document-invoice.ts`.
- Modify: `src/modules/finance/financial-document-service.ts` minimally to call the document-specific pipeline.
- Modify snapshot/presentation code only where typed invoice semantics are genuinely missing.
- Test: create `tests/finance-financial-document-invoice-postgres.test.ts` and focused HTTP/browser tests.

**Interfaces:**
- Consumes: eligible institution-scoped Obligation + existing shared issuance core.
- Produces: Factura issuance that never depends on a Payment merely to fit receipt code.

- [ ] **Step 1: Write RED eligibility tests**

Prove open eligible obligation passes; foreign-tenant, ineligible/closed/cancelled source fails; missing AO invoice policy/config/series fails before numbering.

- [ ] **Step 2: Write RED issuance tests**

Assert invoice source provenance points to Obligation and does not fabricate payment fields.

- [ ] **Step 3: Implement the smallest invoice-specific eligibility/source loader and documentary composition**

Reuse shared IAM, adapter selection, fiscal configuration, series, numbering, persistence, audit/outbox, idempotency and artifact boundaries.

- [ ] **Step 4: Prove snapshot historical stability**

Issue Factura, change live obligation/presentation profile where allowed by normal domain flow, and prove the issued documentary snapshot remains unchanged.

- [ ] **Step 5: Run HTTP/IAM/tenant/idempotency/concurrency regressions**

- [ ] **Step 6: Perform browser normal-flow + restart UAT**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(finance): add Angola invoice issuance corridor"
```

---

### Task 7: Implement Factura-Recibo from Obligation + Payment + Valid Settlement Relationship

**Files:**
- Modify: `src/modules/finance/financial-document-eligibility.ts`
- Create focused invoice-receipt helper if needed.
- Modify shared service/snapshot/presentation minimally.
- Test: create `tests/finance-financial-document-invoice-receipt-postgres.test.ts`.

**Interfaces:**
- Consumes: eligible Obligation, confirmed Payment and an active/non-reversed Allocation/settlement relationship required by policy.
- Produces: Factura-Recibo with both commercial/obligation and payment/settlement provenance.

- [ ] **Step 1: Write RED tests around the existing `requireInvoiceReceipt` semantic direction**

Cases:

```text
matching active allocation -> potentially eligible
no allocation -> blocked
reversed allocation -> blocked
foreign-tenant relationship -> blocked
payment/obligation currency or amount relationship inconsistent with policy -> blocked
```

- [ ] **Step 2: Write RED snapshot tests**

The snapshot must preserve both obligation and payment/settlement truth needed to explain the document; it must not collapse Factura-Recibo into a Recibo label.

- [ ] **Step 3: Implement document-specific composition while reusing shared issuance core**

- [ ] **Step 4: Run numbering/idempotency/historical immutability tests**

- [ ] **Step 5: Perform browser normal-flow + refresh/relogin/restart UAT**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(finance): add Angola invoice-receipt corridor"
```

---

### Task 8: Implement Nota de Crédito as an Evidence-Backed Corrective Document

**Files:**
- Modify: `src/modules/finance/financial-document-service.ts` correction path.
- Create focused correction policy helper under Angola jurisdiction if needed.
- Modify snapshot/presentation only to represent evidence-backed correction fields.
- Test: create/extend credit-note PostgreSQL/HTTP/browser tests.

**Interfaces:**
- Consumes: eligible original issued document + evidence-backed Angola correction policy + permitted economic/provenance basis.
- Produces: new linked Nota de Crédito; original remains immutable.

- [ ] **Step 1: Write RED tests proving the current receipt-derived correction shortcut is insufficient**

Test that correction cannot be authorized merely because the original has a Payment source.

- [ ] **Step 2: Write RED tests for policy limits**

Cover original document type eligibility, allowed correction reason/basis, same-institution requirement, amount bounds and required related-document reference according to proven evidence.

- [ ] **Step 3: Implement correction eligibility through Angola policy, preserving the existing correction-chain authority**

Do not create destructive update/delete/cancel behavior unless authoritative policy explicitly requires a separate first-class operation.

- [ ] **Step 4: Prove original immutability and linked corrective persistence**

- [ ] **Step 5: Prove artifact and restart behavior**

Original and Nota de Crédito remain navigable after restart; correction does not rewrite historical source/snapshot.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(finance): add Angola credit-note corridor"
```

---

### Task 9: Implement Nota de Débito from Explicit Policy Semantics, Never Sign-Flipping Credit Note

**Files:**
- Add the minimum focused debit-note policy/source helper under Angola jurisdiction/Finance document family.
- Modify shared issuance/correction service only through existing extension points.
- Test: create `tests/finance-financial-document-debit-note-postgres.test.ts` plus HTTP/browser tests.

**Interfaces:**
- Consumes: the exact original/source relationship and policy-permitted debit basis proven by Task 2.
- Produces: first-class Nota de Débito with its own provenance and policy validation.

- [ ] **Step 1: Write RED tests directly from the evidence matrix**

Every test name must map to a `RULE_ID` from the Angola evidence pack.

- [ ] **Step 2: Add a negative test proving credit-note sign inversion is not accepted as debit-note semantics**

- [ ] **Step 3: Implement the minimal debit-note pipeline**

Reuse transaction, series, numbering, idempotency, snapshot persistence, audit/outbox and artifact infrastructure.

- [ ] **Step 4: Run tenant/IAM/idempotency/numbering/history tests**

- [ ] **Step 5: Perform browser normal-flow + restart UAT**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(finance): add Angola debit-note corridor"
```

---

### Task 10: Make Fiscal Configuration and Series Operable for AO Through Normal Product Paths

**Files:**
- Modify existing fiscal-configuration HTTP/client/UI boundaries only as required to expose policy-permitted AO configuration.
- Modify existing series configuration boundaries only as required for document-specific AO series.
- Do not redesign Aurora/visual system.
- Test: existing configuration tests + AO-specific HTTP/browser tests.

**Interfaces:**
- Consumes: `AO` Financial Profile + production Angola adapter/policy.
- Produces: normal authorized configuration flow for fiscal config and series without helpers.

- [ ] **Step 1: Write RED tests for authorized AO fiscal configuration**

Prove browser cannot choose an adapter inconsistent with the server-resolved jurisdiction.

- [ ] **Step 2: Write RED tests for document-specific series creation**

Only document types allowed by the current effective Angola policy can receive active series.

- [ ] **Step 3: Implement minimal operational UI/API changes**

Keep styling inside existing design system; this task is functional, not visual redesign.

- [ ] **Step 4: Run G01 regression**

Legal Profile and Financial Profile actions must remain operational and jurisdiction-policy block behavior must remain correct for unsupported jurisdictions.

- [ ] **Step 5: Human UAT configuration story**

```text
legal profile
-> financial profile AO
-> jurisdiction recognized
-> fiscal configuration through normal UI
-> document-specific series through normal UI
-> readiness updates from server
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(finance): enable normal Angola fiscal configuration"
```

---

### Task 11: Close Source ↔ Document Navigation, Preview and Office-Edit Boundary

**Files:**
- Modify current Finance document client/UI navigation and preview surfaces only where gaps are proven.
- Reuse canonical presentation model.
- Test: browser/product tests.

**Interfaces:**
- Consumes: issued documents and source references.
- Produces: normal operator navigation and read-only official-document experience.

- [ ] **Step 1: Write RED browser/component tests for source-to-document and document-to-source navigation**

- [ ] **Step 2: Write RED test proving pre-issue preview uses the same canonical presentation truth as the eventual artifact for unchanged input**

Preview has no numbering/issuance authority.

- [ ] **Step 3: Write RED test proving issued official Finance documents expose no Word/Excel/PowerPoint/general-edit action**

- [ ] **Step 4: Implement only the proven missing product-path wiring**

Do not redesign page layout or visual identity.

- [ ] **Step 5: Human UAT all navigation directions**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(finance): close official document product navigation"
```

---

### Task 12: Aggregate Persistence, Restart, Security and Non-Regression Gate

**Files:**
- Modify/create only aggregate test runner/evidence files if the repository already uses them.
- No new product feature unless a failing gate reveals a reproducible defect in G02 scope.

**Interfaces:**
- Consumes: Tasks 1-11.
- Produces: objective-level G02 closure evidence.

- [ ] **Step 1: Run the five-document capability matrix**

For each type report exactly:

```text
EVIDENCE=PASS|BLOCKED
POLICY=PASS|BLOCKED
CONFIG=PASS|BLOCKED
SERIES=PASS|BLOCKED
ELIGIBILITY=PASS|BLOCKED
ISSUANCE=PASS|BLOCKED
SNAPSHOT=PASS|BLOCKED
ARTIFACT=PASS|BLOCKED
BROWSER=PASS|BLOCKED
RESTART=PASS|BLOCKED
```

No `READY` if any required row is blocked.

- [ ] **Step 2: Run refresh/relogin/application-restart persistence gate**

For every `READY` type, prove same document ID, series, number, snapshot, policy provenance and artifact after restart.

- [ ] **Step 3: Run tenant/IAM negative matrix**

Foreign institution identifiers for source, series, original document, correction target or artifact must fail closed/non-disclose.

- [ ] **Step 4: Run idempotency and concurrency matrix**

Same intent must not duplicate; concurrent distinct issuance in the same series must keep unique authoritative numbering.

- [ ] **Step 5: Run Finance/Foundation regressions**

Run all relevant existing F2-F7/Foundation tests, lint, build, diff check, secret scan and migration bootstrap/runner gates.

Expected: no regression against Task 1 baseline.

- [ ] **Step 6: Perform final human normal-flow UAT**

Use only normal product routes. Fixtures may prepare legitimate source facts, but must not substitute configuration, eligibility, issuance, correction, retrieval or persistence capabilities.

- [ ] **Step 7: Produce the G02 closure report**

Required final format:

```text
FINANCE_F7_G02=PASS|FAIL
BASELINE_SHA=<sha>
FINAL_SHA=<sha>
REMOTE_PARITY=MATCH|MISMATCH

ANGOLA_PRODUCTION_REGISTRY=PASS|FAIL
UNSOURCED_PRODUCTION_RULES=0
AMBIGUOUS_PRODUCTION_RULES=0
SYNTHETIC_PRODUCTION_FALLBACKS=0
COUNTRY_RULES_IN_GENERIC_CORE=0

FACTURA=READY|BLOCKED
FACTURA_RECIBO=READY|BLOCKED
RECIBO=READY|BLOCKED
CREDIT_NOTE=READY|BLOCKED
DEBIT_NOTE=READY|BLOCKED

NORMAL_PRODUCT_FLOW=PASS|FAIL
RESTART_PERSISTENCE=PASS|FAIL
TENANT_ISOLATION=PASS|FAIL
IDEMPOTENCY_NUMBERING=PASS|FAIL
OFFICE_EDIT_BOUNDARY=PASS|FAIL
FINANCE_REGRESSION=PASS|FAIL
FOUNDATION_REGRESSION=PASS|FAIL

P0_OPEN=<n>
P1_OPEN=<n>
UNPROVEN_CRITICAL_REQUIREMENTS=<n>
NEXT_CAUSAL_GAP=<exact gap or NONE>
```

If any of the five Product Owner-approved document types remains `BLOCKED`, state the exact unresolved authoritative dependency. Do not silently remove it from scope.

- [ ] **Step 8: Commit final evidence only after fresh verification**

```bash
git add <approved evidence files only>
git commit -m "test(finance): prove Angola production jurisdiction corridor"
```

---

## Objective-Level Stop Rules

Stop and return to Product Owner only for a real decision blocker, including:

```text
- authoritative legal sources conflict materially;
- primary technical/legal evidence needed for production cannot be obtained;
- implementation requires changing a frozen Finance invariant;
- implementation requires a new economic/document authority;
- safe schema evolution cannot be proven;
- a required Angola rule would force a cross-module authority change not already approved;
- a real product regression cannot be fixed inside the approved G02 contract without changing scope/semantics.
```

Do **not** stop for ordinary test failures, local environment setup, fixture preparation, process lifecycle issues, turn expiry or a bug whose root cause can be safely repaired inside G02.

## Evolution Law

This plan is intentionally one-way:

```text
DEFINE existing gap
-> IMPLEMENT minimum complete capability
-> PROVE with machine + human evidence
-> FREEZE capability
-> MOVE to the next causal gap
```

The executor must not reopen a previously frozen capability because a later task is inconvenient. Reuse or extend approved interfaces. A previously closed capability may be reopened only for a reproducible defect or an explicit Product Owner-approved requirement change.

`PROGRESS = NUMBER_OF_REAL_CAPABILITIES_CLOSED`, not commits, files, tests, branches or hours.

## Plan Self-Review Result

- Spec coverage: all G02 sections map to Tasks 1-12.
- Five document types: each has an explicit implementation/verification task.
- Evidence gate: explicit and precedes production registration.
- Frozen boundaries: explicit and guarded by baseline/final regressions.
- Normal product flow: configuration, preview, issuance, artifact, navigation and restart are included.
- Placeholders: none intentionally permitted; evidence-dependent rules must be marked `BLOCKED`, not left as TODO/TBD.
- Type/authority consistency: Financial Profile remains jurisdiction authority; Angola policy remains jurisdiction-only; shared Finance core remains issuance/persistence authority.
- Regression control: baseline captured before change; targeted regressions per task; full regression at closure.
