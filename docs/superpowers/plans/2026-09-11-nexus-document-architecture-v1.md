# Nexus Canonical Document Architecture v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved Nexus document architecture into a real, testable institutional document capability while preserving existing Finance authorities, eliminating technical leakage from normal UX, and keeping Angola production enablement fail-closed until authoritative legal/technical evidence is complete.

**Architecture:** Existing Finance facts, idempotency, numbering, immutable issued documents, corrections, audit/outbox, tenant isolation, and private artifacts remain protected. The implementation adds explicit product terminology, shared institutional legal identity, document-party resolution, a versioned immutable documentary snapshot, typed canonical presentation, preview/PDF parity, and a jurisdiction policy boundary. Angola is the first evidenced jurisdiction, but production activation is a later gate and must not be inferred from this plan.

**Tech Stack:** TypeScript, React, Node.js, Express, PostgreSQL, Firebase identity, existing Finance command/repository patterns, existing Node/tsx tests, existing Aurora frontend/theme stack.

**Spec:** `docs/superpowers/specs/2026-09-11-nexus-document-architecture-v1-design.md`

## Global Constraints

- `BROWSER_AUTHORITY=NO`.
- PDF/preview are presentation only; issued Financial Document truth remains server/PostgreSQL authority.
- Preserve existing Finance idempotency, atomic numbering, correction immutability, audit/outbox, tenant isolation, historical fiscal-policy provenance, and private artifact integrity.
- `Payment.id`, operational payment reference, provider/bank reference, and official document number are distinct concepts.
- `BENEFICIARY != BILL_TO_PARTY != PAYER != DOCUMENT_RECIPIENT` unless explicitly resolved by authoritative domain relationships.
- `DOCUMENT_RECIPIENT != AUTHORIZED_VIEWER`.
- Finance must not own a duplicate institutional legal profile.
- Missing required documentary data fails closed; no fake NIF, address, customer, tax value, series, provider reference, or legal mention.
- Synthetic `NEXUS_TEST`, `core`, `000-UAT-*`, or other test fixtures remain explicit test/UAT composition only.
- No Angola production compliance claim until the legal/e-invoicing evidence gate passes.
- Do not create/renumber a migration until the known migration authority/order conflict is explicitly adjudicated.
- Do not rebuild working Finance domain flows for presentation convenience.
- Normal UX must not expose raw UUIDs, adapter keys, renderer/template versions, source ids, stack/runtime details, or raw internal enum strings when approved human terminology exists.
- Preview and PDF must derive from the same canonical presentation model.
- Human UAT remains mandatory before the capability is declared complete.

---

## Task 1: Lock Baseline and Adjudicate Schema Authority Before Any Migration

**Files:**
- Read: `src/db/migration-runner.ts`
- Read: `src/db/migrations/*.sql`
- Read: `src/db/migrations/0041_finance_financial_documents.sql`
- Read: current main/Finance branch migration histories
- Test: `tests/migration-runner.test.ts`
- Production change: none until the adjudication report is complete

**Interfaces:**
- Consumes: current repository migration ledger/filenames and approved document spec.
- Produces: one authoritative next-migration policy and an exact statement whether this implementation may add schema files safely.

- [ ] **Step 1: Capture execution identity and migration inventories**

Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin --prune
git log --oneline --decorate -20
```
Then list migration filenames on the implementation branch and `origin/main`.

Expected: exact evidence of duplicate/competing numeric migration orders if still present.

- [ ] **Step 2: Run existing migration-runner characterization**

Run:
```bash
node --import tsx --test tests/migration-runner.test.ts
```
Expected: PASS; existing migrations remain immutable/checksummed.

- [ ] **Step 3: Produce and apply an explicit adjudication rule**

Acceptable result must define a single forward-only numbering/naming sequence from the current integrated baseline. It must not rewrite an already-applied migration.

If safe forward numbering cannot be proven, STOP before schema changes and return:
```text
REAL_BLOCKER=MIGRATION_AUTHORITY_CHANGE_REQUIRED
MIGRATION_CONFLICTS=<exact filenames/branches>
SAFE_NEXT_MIGRATION=<unknown>
```

If safe numbering is proven, record:
```text
MIGRATION_AUTHORITY=PASS
SAFE_NEXT_MIGRATION=<exact prefix>
HISTORY_REWRITE=NO
```

- [ ] **Step 4: Commit only the adjudication documentation/test if repository policy requires it**

No product schema changes in this task.

---

## Task 2: Establish the Nexus Product Terminology Contract

**Files:**
- Create: `src/lib/product-terminology.ts`
- Create: `tests/product-terminology.test.ts`
- Modify later consumers only after this contract is green.

**Interfaces:**
- Produces:
```ts
export type ProductTermKey =
  | 'financial_document.invoice'
  | 'financial_document.invoice_receipt'
  | 'financial_document.receipt'
  | 'financial_document.credit_note'
  | 'financial_document.debit_note'
  | 'financial_document.status.issued'
  | 'payment'
  | 'document.recipient'
  | 'document.issuer';

export type ProductTerm = Readonly<{
  label: string;
  shortLabel: string;
  description?: string;
  actionLabel?: string;
  confirmedLabel?: string;
}>;

export function productTerm(key: ProductTermKey): ProductTerm;
```

- [ ] **Step 1: Write RED tests for canonical labels and raw-enum prohibition**

Test at minimum:
```ts
assert.equal(productTerm('financial_document.receipt').label, 'Recibo');
assert.equal(productTerm('financial_document.credit_note').label, 'Nota de crédito');
assert.equal(productTerm('financial_document.status.issued').label, 'Emitido');
```
Also assert unknown string keys cannot be passed without a type escape.

- [ ] **Step 2: Run RED**

Run:
```bash
node --import tsx --test tests/product-terminology.test.ts
```
Expected: FAIL because `src/lib/product-terminology.ts` does not exist.

- [ ] **Step 3: Implement the minimal immutable catalog**

Use an explicit typed map; do not implement `replace('_', ' ')`, generic title-case, or raw-enum fallbacks.

- [ ] **Step 4: Run GREEN**

Run the focused test plus lint.

- [ ] **Step 5: Commit**

```bash
git add src/lib/product-terminology.ts tests/product-terminology.test.ts
git commit -m "feat(product): add canonical terminology contract"
```

---

## Task 3: Add Shared Institution Legal Profile Authority

**Precondition:** Task 1 must have established a safe migration authority.

**Files:**
- Create: the next approved migration file under `src/db/migrations/` using the exact safe number from Task 1.
- Create: `src/modules/institution/institution-legal-profile.ts`
- Create: `tests/institution-legal-profile-postgres.test.ts`
- Extend existing institution HTTP/configuration boundary only where repository-fit shows the canonical Administration owner.

**Interfaces:**
- Produces conceptual API:
```ts
export type InstitutionLegalProfile = Readonly<{
  id: string;
  institutionId: string;
  version: number;
  legalName: string;
  taxIdentifier: string | null;
  registeredAddress: Readonly<{
    countryCode: string;
    line1: string;
    line2?: string | null;
    locality?: string | null;
    administrativeArea?: string | null;
    postalCode?: string | null;
  }>;
  legalEmail: string | null;
  legalPhone: string | null;
  logoAssetReference: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}>;
```
- Required repository methods:
```ts
resolveEffective(institutionId: string, at: Date): Promise<InstitutionLegalProfile | null>
createVersion(...): Promise<InstitutionLegalProfile>
```

- [ ] **Step 1: Write RED PostgreSQL tests**

Prove:
- tenant-scoped profile lookup;
- exactly one effective version at a time;
- later version does not mutate older version;
- cross-tenant id lookup returns no profile;
- legal profile belongs to Institution, not Finance.

- [ ] **Step 2: Run RED against authorized local PostgreSQL**

Use the existing `TEST_DATABASE_LOCAL_AUTHORIZED=true` safety contract.

- [ ] **Step 3: Add the minimal forward-only migration**

Required persistence semantics:
```text
institution_id FK institutions(id)
version > 0
legal_name NOT NULL
country_code NOT NULL
address stored in a structured, validated shape
optional tax/contact/logo fields
valid_from / valid_to
unique institution + version
no destructive update of historical version used by issued documents
```
Do not add Finance-specific institution identity columns.

- [ ] **Step 4: Implement repository/service boundary**

Use server-side institution scoping for every command/read.

- [ ] **Step 5: Run GREEN + negative tenant tests + lint/build**

- [ ] **Step 6: Commit**

Use one commit for the shared legal-profile authority.

---

## Task 4: Define Document Party Resolution Without Assuming Payer = Recipient

**Files:**
- Create: `src/modules/finance/document-party-resolution.ts`
- Create: `tests/finance-document-party-resolution.test.ts`
- Read/consume: `finance_financial_account_parties`, obligations, `Payment.payer_person_id`, people/enrollment authorities.
- Do not add an organization table unless repository-fit proves an existing shared organization authority is absent and Product Owner authorizes that schema decision.

**Interfaces:**
- Produces:
```ts
export type DocumentaryPartyKind = 'person' | 'organization';

export type ResolvedDocumentParties = Readonly<{
  beneficiary: DocumentaryPartyRef | null;
  billingParty: DocumentaryPartyRef;
  payer: DocumentaryPartyRef | null;
  recipient: DocumentaryPartyRef;
}>;
```
with `DocumentaryPartyRef` carrying an authority type/id, not a UI label snapshot.

- [ ] **Step 1: Write RED tests for party independence**

Cases:
```text
beneficiary João / billing Maria / payer Pedro / recipient Maria
payer absent but billing/recipient resolvable
payer same as recipient only when the authority relation actually resolves so
missing billing/recipient -> fail closed
cross-tenant party reference -> reject
```

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement person-based resolution using existing account/obligation relationships**

Do not derive recipient from `Payment.payerPersonId` as fallback.

- [ ] **Step 4: Handle organization capability explicitly**

If no shared organization authority exists, return a typed unsupported-capability result for organization recipient creation instead of inventing a person surrogate.

- [ ] **Step 5: Run GREEN**

- [ ] **Step 6: Commit**

---

## Task 5: Introduce Versioned Immutable Documentary Snapshot v1

**Precondition:** Task 1 migration authority PASS.

**Files:**
- Create: `src/modules/finance/documentary-snapshot.ts`
- Modify: `src/modules/finance/financial-document-service.ts`
- Add the next approved migration to persist documentary snapshot + schema version without rewriting `source_snapshot`.
- Test: extend `tests/finance-financial-document-issuance-postgres.test.ts`
- Create: `tests/finance-documentary-snapshot.test.ts`

**Interfaces:**
- Produces:
```ts
export type DocumentarySnapshotV1 = Readonly<{
  schemaVersion: 1;
  issuer: DocumentaryIssuerSnapshot;
  recipient: DocumentaryRecipientSnapshot;
  beneficiary: DocumentaryPartySnapshot | null;
  billingParty: DocumentaryPartySnapshot | null;
  payer: DocumentaryPartySnapshot | null;
  operation: DocumentaryOperationSnapshot;
  payment: DocumentaryPaymentSnapshot | null;
  totals: DocumentaryTotalsSnapshot;
  tax: DocumentaryTaxSnapshot;
  correction: DocumentaryCorrectionSnapshot | null;
  jurisdiction: DocumentaryJurisdictionSnapshot;
}>;
```

- [ ] **Step 1: Write RED pure-model tests**

Prove deep immutability/serialization shape and explicit schema version.

- [ ] **Step 2: Write RED PostgreSQL issuance tests**

Issue a document, then change live institution/person data in a later effective version. Assert persisted documentary snapshot remains unchanged.

- [ ] **Step 3: Add forward-only snapshot persistence**

Preferred shape: dedicated structured JSONB snapshot + integer schema version on Financial Document, preserving existing narrow provenance `source_snapshot` for compatibility/audit.

- [ ] **Step 4: Build snapshot before number allocation but persist it atomically with issuance**

Required order inside the issue transaction:
```text
lock/validate source and series
resolve effective legal profile + parties + jurisdiction policy
validate required documentary fields
assemble immutable snapshot
allocate official number
insert issued Financial Document + sources + snapshot + audit/outbox
commit
```
If snapshot validation fails, no sequence number may be consumed.

- [ ] **Step 5: Preserve idempotency**

Replay returns the previously issued document/snapshot; it must not rebuild against current live data.

- [ ] **Step 6: Run GREEN + existing F7 issuance regressions**

- [ ] **Step 7: Commit**

---

## Task 6: Expand Readiness into Document-Type-Specific Server Authority

**Files:**
- Modify: `src/modules/finance/finance-readiness.ts`
- Modify: `src/modules/finance/finance-readiness-http.ts`
- Modify: `src/modules/finance/financial-document-eligibility.ts`
- Test: `tests/finance-readiness.test.ts`
- Test: existing documentary eligibility/issuance suites.

**Interfaces:**
- Extend readiness without replacing module readiness:
```ts
type DocumentIssuanceReadiness =
  | { status: 'READY'; documentType: string }
  | { status: 'BLOCKED'; documentType: string; reasonCode: string; requirements: readonly Requirement[] };
```

- [ ] **Step 1: Write RED tests**

Required cases:
```text
Finance base configured but Institution Legal Profile incomplete -> receipt issuance blocked
recipient unresolved -> receipt issuance blocked
unsupported jurisdiction -> blocked
module readiness may be READY while a specific document readiness is BLOCKED
preflight and transactional issue return same canonical domain reason for unchanged input
missing documentary field never consumes a series number
```

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement shared documentary validation boundary**

Readiness/preflight and issuance reuse the same evaluator; issuance adds locks/transaction/mutation only.

- [ ] **Step 4: Run GREEN + TOCTOU/idempotency regressions**

- [ ] **Step 5: Commit**

---

## Task 7: Separate External Payment Evidence from Nexus-Issued Receipt Semantics

**Files:**
- Create: `src/modules/finance/payment-evidence.ts`
- Create: `tests/finance-payment-evidence.test.ts`
- Modify existing Payment read model only if necessary to expose safe evidence metadata already persisted.
- Do not generate bank/provider-looking documents.

**Interfaces:**
- Produces a typed projection such as:
```ts
export type ExternalPaymentEvidence = Readonly<{
  source: 'bank_transfer' | 'provider' | 'manual_external_reference';
  providerKey: string | null;
  externalReference: string | null;
  occurredAt: Date | null;
  artifactReference: string | null;
}>;
```

- [ ] **Step 1: Write RED tests**

Prove provider transaction refs remain external evidence and are never used as official Nexus document numbers.

- [ ] **Step 2: Implement the projection from existing Payment fields**

No new bank proof is fabricated.

- [ ] **Step 3: Run GREEN**

- [ ] **Step 4: Commit**

---

## Task 8: Create Canonical Financial Document Presentation Model and Builder

**Files:**
- Create: `src/modules/finance/financial-document-presentation.ts`
- Create: `tests/finance-financial-document-presentation.test.ts`
- Modify no renderer yet.

**Interfaces:**
- Produces:
```ts
export type CanonicalFinancialDocumentPresentation = Readonly<{
  document: { typeLabel: string; officialNumber: string; issueDate: string; currency: string; statusLabel: string };
  issuer: { legalName: string; taxIdentifier: string | null; addressLines: readonly string[]; logoAssetReference: string | null };
  recipient: { name: string; taxIdentifier: string | null; addressLines: readonly string[]; operationalReference: string | null };
  operation: { reference: string | null; lines: readonly PresentationLine[] };
  totals: PresentationTotals;
  payment: PresentationPayment | null;
  correction: PresentationCorrection | null;
  legalMentions: readonly string[];
  verification: readonly PresentationVerificationElement[];
}>;

export function buildFinancialDocumentPresentation(input: {
  document: IssuedDocumentRecord;
  snapshot: DocumentarySnapshotV1;
  terminology: typeof productTerm;
}): CanonicalFinancialDocumentPresentation;
```

- [ ] **Step 1: Write RED tests for receipt, credit note, and raw-metadata exclusion**

Assert output contains human labels and operational references but does not contain source UUID, `adapterKey`, renderer version, template version, storage reference, or raw policy JSON.

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement presentation builder**

No DB queries and no tax/eligibility calculations in this file.

- [ ] **Step 4: Run GREEN**

- [ ] **Step 5: Commit**

---

## Task 9: Replace Technical UAT PDF with Production-Shaped Renderer Behind the Same Artifact Authority

**Files:**
- Modify: `src/modules/finance/financial-document-artifact-renderer.ts`
- Modify: `src/modules/finance/financial-document-artifact-service.ts`
- Create/extend renderer tests.
- Keep existing artifact storage/hash/private-access authority intact.

**Interfaces:**
- Renderer input becomes `CanonicalFinancialDocumentPresentation` plus render/template version metadata held outside the customer-facing content.

- [ ] **Step 1: Write RED PDF tests**

Generated PDF text/content must include:
```text
institution legal name
human document label
series/official number
issue date
recipient human name/reference where present
amount/total/payment semantics appropriate to document type
```
And must exclude:
```text
Document id:
Provenance:
Policy provenance:
Renderer:
template:
raw source UUID
raw adapter key
```

- [ ] **Step 2: Run RED**

Expected: current technical renderer fails.

- [ ] **Step 3: Implement production-shaped renderer**

Use institution-first branding. Nexus attribution may be a discreet permitted footer, never the primary issuer identity.

- [ ] **Step 4: Keep artifact integrity unchanged**

Existing SHA-256, byte-size, provider-neutral storage, missing-byte failure, tamper failure, retry and append-only artifact behavior must remain green.

- [ ] **Step 5: Run GREEN + `tests/finance-financial-document-artifact.test.ts` and PostgreSQL artifact suites**

- [ ] **Step 6: Commit**

---

## Task 10: Enforce Preview = PDF Presentation Truth and Remove Technical Leakage from Finance UX

**Files:**
- Modify: `src/components/finance/documents/FinancialDocumentsWorkspace.tsx`
- Modify: `src/modules/finance/financial-document-client.ts`
- Modify server read projection as needed to return a safe canonical presentation DTO.
- Test: `tests/finance-financial-document-ui.test.ts`
- Create: `tests/finance-document-presentation-parity.test.ts`

**Interfaces:**
- UI preview consumes the same canonical presentation fields used by artifact generation.

- [ ] **Step 1: Write RED tests**

Required:
```text
receipt -> “Recibo”
credit_note -> “Nota de crédito”
issued -> “Emitido”
Payment provenance uses paymentReference, never raw source UUID
renderer/template version absent from primary UI actions
technical metadata absent from normal document detail
Preview values equal the canonical presentation values used to generate the PDF
```

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement safe presentation read projection**

Do not expose a giant raw documentary snapshot to the browser when a bounded presentation DTO suffices.

- [ ] **Step 4: Update UI**

Use Nexus product terminology and evidence hierarchy. Keep advanced audit metadata out of normal Finance UX.

- [ ] **Step 5: Run GREEN + lint/build**

- [ ] **Step 6: Commit**

---

## Task 11: Angola Jurisdiction Contract — Evidence-Gated, Production Disabled

**Files:**
- Create: `src/modules/finance/jurisdictions/angola/angola-document-policy.ts`
- Create: `src/modules/finance/jurisdictions/angola/angola-evidence.ts`
- Create: `tests/finance-angola-document-policy.test.ts`
- Do not register the adapter in `productionFiscalAdapterRegistry` until the explicit enablement gate passes.

**Interfaces:**
- Policy must expose only evidence-backed requirements, with source identifiers for every enforced rule.

- [ ] **Step 1: Re-open the authoritative legal evidence pack before coding rules**

Required minimum evidence categories:
```text
current governing invoice/document regime
receipt semantics
invoice-receipt semantics
credit-note correction requirements
mandatory fields per document type
series/numbering requirements
e-invoicing/software-validation/hash requirements
DE 683/25 technical requirements
private-school/tax-regime applicability
```

- [ ] **Step 2: Classify every candidate rule**

For each rule store:
```text
RULE_ID
SOURCE
ARTICLE_OR_SECTION
EFFECTIVE_DATE
APPLIES_TO
CONFIDENCE
```
No rule with unresolved applicability is enforced as production compliance.

- [ ] **Step 3: Write RED policy tests only for verified rules**

- [ ] **Step 4: Implement verified rule predicates/requirements**

- [ ] **Step 5: Keep production registry fail-closed**

Test:
```ts
assert.throws(() => productionFiscalAdapterRegistry.select(...Angola...), /UNSUPPORTED|NOT_ENABLED/);
```
until explicit Product Owner enablement after evidence + UAT.

- [ ] **Step 6: Commit evidence-backed policy code separately**

---

## Task 12: Reconcile Aurora Visual Authority and Implement Only the Three Approved Pilot Surfaces

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/finance/FinanceWorkspace.tsx`
- Modify: Finance Overview surface
- Modify: `src/components/finance/payments/FinancePaymentsWorkspace.tsx`
- Modify: `src/components/finance/documents/FinancialDocumentsWorkspace.tsx`
- Tests: existing Aurora/Finance UI contract tests.

**Interfaces:**
- Consumes: approved Aurora spec + canonical document presentation DTO.
- Produces: one scoped Aurora authority for Finance pilot surfaces; legacy styles remain contained for untouched modules.

- [ ] **Step 1: Write RED visual-authority tests**

Prove new/touched Aurora Finance surfaces do not depend on legacy blue brand tokens or broad new `!important` overrides.

- [ ] **Step 2: Reconcile token scope**

Create a scoped semantic Aurora surface authority and stop legacy `Premium Institutional Palette` rules from overriding Finance pilot surfaces. Do not globally restyle untouched modules in this task.

- [ ] **Step 3: Replace the rejected nested-sidebar presentation**

Keep hierarchy:
```text
Visão Geral
Operação
Configuração
```
but use a compact internal navigation composition where work dominates. Do not return to horizontal-scroll peer tabs.

- [ ] **Step 4: Implement the three visual pilots only**

1. Finance shell/overview
2. Recebimentos operational collection
3. Documentos evidence surface

Do not migrate Obrigações, Catálogo, or Configuração yet.

- [ ] **Step 5: Verify machine contracts**

Run Aurora navigation, receipt-evidence, financial-document UI tests, lint, build.

- [ ] **Step 6: Stop for human visual checkpoint**

Return:
```text
AURORA_SHELL_SCREENSHOT_READY=YES
AURORA_OPERATIONAL_COLLECTION_SCREENSHOT_READY=YES
AURORA_EVIDENCE_SCREENSHOT_READY=YES
FUNCTIONAL_FINANCE_REGRESSIONS=PASS
```
Do not propagate the design before Product Owner visual approval.

---

## Task 13: Complete Remaining Finance Surfaces Only After Human Visual Approval

**Precondition:** Task 12 human visual approval.

**Files:**
- Modify: Obligations, Catalogue, Finance Configuration presentation files.
- Do not modify protected domain authorities unless a reproducible defect is found.

- [ ] **Step 1: Apply the approved pilot patterns to remaining surfaces**

No new visual language.

- [ ] **Step 2: Keep configuration authority truthful**

Legal identity is linked back to Institution/Admin authority; Finance does not duplicate the profile form unless the shared product architecture explicitly routes there.

- [ ] **Step 3: Run full Finance UI regression + lint/build**

- [ ] **Step 4: Commit**

---

## Task 14: Integrated PostgreSQL, Security, Regression, and Real UAT Closure

**Files:**
- No product changes unless a UAT finding is first reproduced and classified.
- Update approved UAT/evidence documentation.

- [ ] **Step 1: Run fresh machine regression closure**

At minimum run current canonical:
```text
migration runner
institution legal-profile PostgreSQL tests
document party tests
document readiness/eligibility tests
F7 issuance/document/artifact regressions
F6 → F3 regressions
Foundation
tenant-negative tests
lint
build
secret/diff gates
```

- [ ] **Step 2: Prove historical regeneration**

Issue an authorized UAT document, then create a later Institution Legal Profile version. Regenerate/retrieve the old document and prove its issuer/recipient/documentary values are unchanged.

- [ ] **Step 3: Prove no number is consumed on failed documentary readiness**

Missing issuer/recipient/jurisdiction-required data must leave series counters unchanged.

- [ ] **Step 4: Human UAT — real institutional flow**

Using canonical `http://localhost:3000` UAT runtime and explicitly isolated test fixtures:
```text
institution legal identity
→ financial relationship / billing party
→ obligation
→ confirmed payment
→ external payment evidence when present
→ document readiness
→ issue eligible document
→ persisted document
→ preview
→ private PDF
→ reload persistence
→ correction
→ immutable original
```

- [ ] **Step 5: Human UAT — terminology/technical leakage**

Fail UAT if normal UX/document displays raw UUID, `credit_note`, `issued`, `adapterKey`, renderer/template version, raw source ids, or debug/server terminology where a product term/reference exists.

- [ ] **Step 6: Human UAT — Aurora experience**

Evaluate desktop, non-maximized desktop/tablet, mobile, keyboard focus, Light/Dark/Tonal/System behavior and professional visual quality.

- [ ] **Step 7: Do not claim Angola production compliance unless Task 11 enablement prerequisites are independently complete**

If legal/technical evidence remains incomplete:
```text
ANGOLA_PRODUCTION_ADAPTER=DISABLED
ANGOLA_ARCHITECTURE_READY=YES
ANGOLA_COMPLIANCE=NOT_CLAIMED
```

- [ ] **Step 8: Final closure report**

Return exactly:
```text
NEXUS_DOCUMENT_ARCHITECTURE_V1=PASS|FAIL
INSTITUTION_LEGAL_PROFILE=PASS|FAIL
DOCUMENT_PARTIES=PASS|FAIL
DOCUMENT_RECIPIENT_RESOLUTION=PASS|FAIL
DOCUMENTARY_SNAPSHOT=PASS|FAIL
DOCUMENT_READINESS=PASS|FAIL
NUMBERING_IDEMPOTENCY=PASS|FAIL
HISTORICAL_IMMUTABILITY=PASS|FAIL
EXTERNAL_PAYMENT_EVIDENCE=PASS|FAIL
TERMINOLOGY=PASS|FAIL
TECHNICAL_LEAKAGE_TO_NORMAL_UX=YES|NO
PREVIEW_PDF_PARITY=PASS|FAIL
AURORA_FINANCE_REFERENCE_VERTICAL=PASS|FAIL
TENANT_ISOLATION=PASS|FAIL
AUTHORIZATION=PASS|FAIL
PERSISTENCE_EVIDENCE=PASS|FAIL
AUDITABILITY=PASS|FAIL
RESPONSIVE=PASS|FAIL
ACCESSIBILITY=PASS|FAIL
REGRESSION=PASS|FAIL
ANGOLA_ARCHITECTURE_READY=YES|NO
ANGOLA_PRODUCTION_ADAPTER=ENABLED|DISABLED
ANGOLA_COMPLIANCE_CLAIM=AUTHORIZED|NOT_AUTHORIZED
FINAL_SHA=<sha>
REMOTE_PARITY=YES|NO
WORKTREE_CLEAN=YES|NO
```

---

## Plan Self-Review

### Spec coverage

- Terminology / technical leakage: Tasks 2, 8, 10, 14.
- Institution Legal Profile: Task 3.
- Document parties / payer-vs-recipient separation: Task 4.
- Immutable documentary snapshot / historical regeneration: Tasks 5, 14.
- Document-specific readiness / fail-closed missing data: Task 6.
- External payment evidence != receipt: Task 7.
- Canonical Presentation Model: Task 8.
- Preview/PDF parity + production-shaped document: Tasks 9–10.
- Angola evidence-gated jurisdiction: Task 11.
- Aurora visual authority and human checkpoint: Tasks 12–13.
- Security/tenant/idempotency/audit/end-to-end UAT: Task 14.
- Migration conflict: Task 1 hard gate.

### Placeholder scan

No `TBD`, `TODO`, guessed production legal rule, or generic “add tests later” instruction is permitted. The only runtime-dependent value is the safe next migration number, which Task 1 must derive from the actual branch histories before any schema file is created.

### Type consistency

- `InstitutionLegalProfile` is shared/transversal and consumed by Finance.
- `ResolvedDocumentParties` carries authority references; snapshots are created only at issuance.
- `DocumentarySnapshotV1` is persistence/documentary truth.
- `CanonicalFinancialDocumentPresentation` is presentation truth derived from issued document + snapshot.
- Renderer consumes presentation truth only.
- Browser consumes bounded presentation/readiness projections only.
- Angola policy never becomes production-active merely because code/tests exist.
