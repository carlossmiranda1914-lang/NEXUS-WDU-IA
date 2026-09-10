# Nexus Canonical Document Architecture v1

**Status:** APPROVED DESIGN — written specification for human review
**Date:** 2026-09-11
**Scope:** Product-wide document truth, terminology, document parties, institutional legal identity, immutable documentary snapshots, presentation, jurisdiction boundaries, and Finance integration.
**First evidenced jurisdiction:** Angola (production enablement remains disabled until authoritative evidence is complete).

## 1. Purpose

Nexus must distinguish real economic facts, official/financial documents, customer-facing presentation, external payment evidence, and internal audit/technical metadata.

The target chain is:

```text
ECONOMIC FACTS
Payment / Obligation / Allocation / Adjustment
        ↓
DOCUMENT ELIGIBILITY
        ↓
DOCUMENT PARTY RESOLUTION
        ↓
JURISDICTION / DOCUMENT POLICY VALIDATION
        ↓
IMMUTABLE DOCUMENTARY SNAPSHOT
        ↓
OFFICIAL NUMBERING + ISSUANCE
        ↓
CANONICAL PRESENTATION MODEL
       ↙                       ↘
UI PREVIEW                 PDF / PRINT
```

Separately:

```text
EXTERNAL PAYMENT EVIDENCE
Bank / Multicaixa / PSP / transfer proof
```

Central invariants:

- PDF is not authority.
- Browser is not authority.
- Issued Financial Document truth is immutable.
- Preview and generated PDF consume the same canonical presentation truth.
- Missing mandatory documentary data fails closed.
- Technical IDs and implementation metadata are not normal product language.
- Jurisdiction rules are evidence-backed and isolated behind jurisdiction/document policy boundaries.
- Multi-jurisdiction architecture is preserved; no default country is introduced.

## 2. Repository baseline and current gap

At the audited Finance baseline, Payment already contains a human operational reference (`paymentReference`) plus provider/manual evidence fields, while Financial Document issuance persists source snapshot, historical policy provenance, numbering, document type/status, and correction linkage.

The existing issuance `sourceSnapshot` is intentionally narrow and includes values such as:

```text
sourceType
sourceId
paymentReference
journalTransactionId
amount
currency
effectiveAt
financialProfileVersion
```

That is sufficient for the current technical Finance guarantees, but insufficient for production-grade institutional/fiscal document reconstruction.

The current renderer is therefore classified as:

```text
CURRENT_RENDERER=TECHNICAL_UAT_EVIDENCE_RENDERER
PRODUCTION_DOCUMENT_PRESENTATION=NOT_IMPLEMENTED
```

It must not be relabeled as a production-compliant receipt merely by changing typography/layout.

The existing `institutions` authority currently proves only a minimal identity shape (`id`, `name`, `slug`, `status`, timestamps). This does not prove a complete legal/document identity profile. Any richer legal identity authority must extend/reuse Institution rather than create a Finance-specific duplicate.

## 3. Canonical terminology architecture

Internal canonical identifiers may remain stable English/domain identifiers. Normal institutional UX must use an explicit product terminology catalog rather than leaking raw internal identifiers.

Examples:

```text
invoice         → Factura
invoice_receipt → Factura-Recibo
receipt         → Recibo
credit_note     → Nota de Crédito
debit_note      → Nota de Débito
issued          → Emitido
confirmed       → Confirmado
payment         → Pagamento
```

No component should obtain human terminology by naive string replacement such as replacing underscores or title-casing raw enums.

Terminology authority must support at least:

```text
DOMAIN_TERM
PRODUCT_LABEL
SHORT_LABEL
DESCRIPTION
ACTION_LABEL
STATUS_LABEL
ERROR_GUIDANCE
```

Language tiers:

```text
LEVEL 1 — INSTITUTIONAL UX
Human operational language.

LEVEL 2 — ADVANCED / AUDIT UX
Controlled technical references needed for audit/support.

LEVEL 3 — INTERNAL DIAGNOSTICS
UUIDs, adapter keys, renderer versions, internal payload/provenance identifiers, stack/runtime details.
```

Normal Finance users operate at Level 1 unless a specific authorized audit surface requires Level 2.

## 4. Identifier semantics

Nexus distinguishes three identifier categories:

```text
TECHNICAL_ID
Internal UUID/key. Not normal product-facing reference.

OPERATIONAL_REFERENCE
Human-recognizable Nexus reference, e.g. Payment.paymentReference.

OFFICIAL_DOCUMENT_NUMBER
Jurisdiction/document-policy-controlled series + sequence/number.
```

These values are never conflated.

Examples:

```text
Payment.id                  → technical UUID
Payment.paymentReference    → operational payment reference
providerTransactionRef      → external provider/bank reference
document series + sequence  → official document number/reference
```

A UI must not display a UUID merely because no presentation mapping was implemented. If no safe human reference exists, expose a product gap or use an explicitly approved audit view.

## 5. Document taxonomy

The internal `FinancialDocument` may remain a generic domain supertype, but customer-facing documents are typed.

First-class document semantics required by the architecture include:

```text
INVOICE          → Factura
INVOICE_RECEIPT  → Factura-Recibo
RECEIPT          → Recibo
CREDIT_NOTE      → Nota de Crédito
DEBIT_NOTE       → Nota de Débito (architecture-ready; product exposure only when BPM/jurisdiction requires it)
```

Document type is not cosmetic. Each type controls required source relationships, documentary fields, payment semantics, correction semantics, and permitted issuance paths.

### Receipt vs bank proof

```text
RECEIPT
= document issued by the institution through Nexus under document/jurisdiction policy.

BANK/PROVIDER PROOF
= external evidence originated by bank/payment provider or manually attached as evidence.
```

Nexus must never generate a bank-looking document and present it as bank-issued evidence when the bank/provider did not issue it.

## 6. Document parties

Nexus explicitly distinguishes:

```text
ISSUER
Entity legally/documentarily issuing the document.

BENEFICIARY
Student/learner/person receiving the educational/commercial service.

BILL_TO_PARTY
Person or organization financially responsible for the obligation.

PAYER
Person/organization/provider actor that actually performed the payment.

DOCUMENT_RECIPIENT
Person or organization in whose name the document is issued.

AUTHORIZED_VIEWER
User/person permitted by IAM/document access policy to view the document.
```

Critical invariant:

```text
BENEFICIARY != BILL_TO_PARTY != PAYER != DOCUMENT_RECIPIENT
```

They may be the same real-world party, but the system must never assume equivalence.

Example:

```text
Beneficiary: João
Billing party: Maria
Payer: Pedro
Document recipient: Maria
```

`Payment.payerPersonId` must never automatically become the document recipient.

`DOCUMENT_RECIPIENT != AUTHORIZED_VIEWER`; access remains an IAM/policy concern.

The document model must support both persons and organizations as recipients/billing parties. This architectural requirement does not authorize creation of a new `organizations` table until repository-fit proves the correct shared authority.

## 7. Institution Legal Profile

Legal/document identity is a transversal Institution concern, not a Finance-owned duplicate.

Conceptual ownership:

```text
Institution
    1
    ↓
Institution Legal Profile (effective-dated/versioned)
```

Finance, Secretariat, certificates/contracts, and other official-document producers consume the same legal identity authority.

A Finance-specific duplicate such as `financeInstitutionName`, `financeNif`, `financeAddress`, or `financeLogo` is prohibited.

Conceptual legal-profile fields include:

```text
institutionId
legalName
tradeName? / displayName?
taxIdentifier
registeredAddress
countryCode
province/municipality/locality
postalCode? when applicable
legalEmail?
legalPhone?
establishmentName?
establishmentAddress?
logoAssetReference?
documentLanguage
legalProfileVersion
effectiveFrom
effectiveTo?
```

Exact names/schema are implementation decisions only after repository reconciliation.

### Effective dating

Institution legal identity must be historically recoverable. A changed legal name/address/tax identity must not rewrite previously issued documents.

Conceptually:

```text
Legal Profile v1: effective A → B
Legal Profile v2: effective B → ...
```

At issuance, the effective profile version contributes to the immutable issuer snapshot.

## 8. Billing party and document recipient resolution

Billing responsibility is resolved before payment where the domain relationship supports it. Payment must not determine the billing party retroactively.

Target flow:

```text
Beneficiary / Enrollment / Service context
        ↓
Financial Account / Obligation
        ↓
Billing Party
        ↓
Document Policy
        ↓
Document Recipient
        ↓
Payment
        ↓
Payer recorded separately
```

Recipient resolution is a domain/policy responsibility, never a renderer fallback.

Conceptual resolution output:

```text
recipientKind = person | organization | other-supported-legal-party
recipientAuthorityId
resolvedFrom = billingParty | explicitRecipient | enrollment/contract | other approved domain relation
```

At issuance, the chosen recipient identity is snapshotted.

## 9. Immutable Documentary Snapshot

The current narrow source snapshot is preserved as valuable provenance, but production-grade document issuance requires a richer immutable documentary boundary.

Conceptually:

```text
DocumentarySnapshot v1

identity
issuer
recipient
beneficiary?
billingParty?
payer?
operation
lines?
payment?
totals
tax
correction?
jurisdiction
legalMentions
policyProvenance
```

This is a conceptual contract, not final persisted JSON/schema.

### Source authorities at issuance

The snapshot is assembled from trusted live authorities such as:

```text
Institution / Institution Legal Profile
Person / Organization / Billing Party authority
Enrollment / Beneficiary authority
Financial Account / Obligation
Payment
Financial Profile
Fiscal Configuration
Document Series
Jurisdiction / Document Policy
```

The exact set depends on document type.

### Historical invariant

After issuance:

```text
LIVE DATA CHANGE
→ MUST NOT MODIFY ISSUED DOCUMENTARY TRUTH
```

Regeneration uses persisted documentary truth:

```text
Issued Financial Document
        ↓
stored Documentary Snapshot
        ↓
Canonical Presentation Model
        ↓
PDF / Preview
```

Forbidden:

```text
Issued Document
→ query current Institution/Person/prices/policy
→ regenerate changed historical document
```

## 10. Canonical Presentation Model

Renderer inputs must be presentation-shaped, not persistence-shaped.

Target boundary:

```text
IssuedFinancialDocument
        +
DocumentarySnapshot
        ↓
CanonicalPresentationBuilder
        ↓
CanonicalFinancialDocumentPresentation
       ↙                         ↘
UI Preview                    PDF Renderer
```

Conceptual presentation sections:

```text
DOCUMENT
- documentType
- officialNumber
- series
- issueDate
- currency
- status

ISSUER
- legalName
- displayName?
- taxIdentifier
- registeredAddress
- establishment?
- contacts?
- logoReference?

RECIPIENT
- name
- taxIdentifier?
- address?
- operationalReference?

ORIGIN / RELATED DOCUMENTS
- operationReference?
- relatedDocumentReferences[]
- paymentReference?

LINES (when document type requires/supports)
- description
- quantity?
- unit?
- unitPrice?
- discounts?
- taxTreatment?
- lineTotal

TOTALS
- subtotal
- discounts
- taxes
- adjustments
- amountDue
- amountPaid
- documentTotal

PAYMENT (when relevant)
- paymentDate?
- method?
- externalReference?
- amountPaid?

CORRECTION (when relevant)
- originalDocumentReference?
- correctionKind?
- correctionReason?
- acknowledgement/evidence? when policy requires

JURISDICTION PRESENTATION
- legalMentions[]
- validationElements[]
- jurisdictionSpecificFields

BRANDING
- institutionLogo
- institutionName
- permittedFooter

CUSTOMER-VISIBLE VERIFICATION
- verification reference/elements only where policy permits/requires
```

The renderer must not query Finance repositories or decide fiscal eligibility. It renders an already validated canonical model.

## 11. Field classification

Every documentary field belongs to one of three classes:

```text
CORE_REQUIRED
Required by Nexus to represent the document coherently.

JURISDICTION_REQUIRED
Required by evidence-backed jurisdiction/document policy.

OPTIONAL_PRESENTATION
Permitted to improve presentation but not a legal/integrity requirement.
```

Visual desirability must never be misclassified as legal obligation.

If any required field is missing:

```text
MISSING_REQUIRED_DOCUMENT_DATA
        ↓
DO NOT INVENT
DO NOT SUBSTITUTE N/A BY DEFAULT
DO NOT ISSUE/RENDER AS OFFICIAL
        ↓
FAIL CLOSED WITH SAFE ACTIONABLE REASON
```

Synthetic UAT fixtures may supply synthetic values only inside explicitly isolated test/UAT composition.

## 12. Document readiness

Generic `FINANCE_READY` is insufficient for documentary operations.

Readiness is derived per capability/document type. Conceptual readiness includes:

```text
FINANCE_OPERATIONAL_READINESS
DOCUMENT_IDENTITY_READINESS
JURISDICTION_READINESS
INVOICE_ISSUANCE_READINESS
INVOICE_RECEIPT_ISSUANCE_READINESS
RECEIPT_ISSUANCE_READINESS
CREDIT_NOTE_ISSUANCE_READINESS
```

Readiness is not a manually editable boolean.

Example receipt requirements may include:

```text
active institution
server-derived IAM capability
effective Financial Profile
complete Institution Legal Profile for required fields
effective Fiscal Configuration
supported/evidenced jurisdiction adapter
effective receipt series
eligible source relationship
confirmed Payment where receipt semantics require it
resolved Document Recipient
required related document where policy requires it
jurisdiction-required documentary fields
```

The authoritative issuance command revalidates within its transactional/locking boundary before mutation/number allocation.

Frontend uses the server projection; it never reconstructs readiness locally.

## 13. Human product language for readiness/errors

Safe internal codes remain available to API/audit, but institutional UX translates allowlisted codes into human guidance.

Example:

```text
DOCUMENT_RECIPIENT_REQUIRED
```

Normal UX:

```text
Falta identificar o destinatário do documento.
Defina a pessoa ou entidade em nome de quem este documento será emitido.
```

Do not expose phrases such as:

```text
server validation failed
adapterKey mismatch
renderer-1
sourceId UUID
```

unless the surface is explicitly an authorized technical/audit diagnostic surface.

## 14. Preview and PDF parity

Content truth must be identical:

```text
Preview Model = PDF Model
```

Preview may adapt visual composition responsively, but labels, values, document number, parties, totals, legal mentions, and document semantics derive from the same `CanonicalFinancialDocumentPresentation`.

The user must not preview document A and download document B.

## 15. Audit metadata boundary

The following remain valuable internal/audit data but are not automatically customer-facing:

```text
document UUID
source UUID
adapter key
financial profile version
policy version
renderer version
template version
storage reference
internal provenance identifiers
raw payloads
```

Customer-facing verification/hash/certification elements appear only where the document policy requires or explicitly permits them.

## 16. Correction semantics

The current Finance correction architecture correctly preserves the original issued document and creates a new corrective fact linked to it. This structural invariant is retained.

Jurisdiction/document policy may require additional correction semantics, including conceptually:

```text
correctionKind = cancellation | rectification | other policy-supported type
correctionReason
originalDocumentReference
recipient/customer acknowledgement/evidence when required
```

Do not infer these semantics for a jurisdiction without authoritative evidence.

## 17. Angola — first evidenced jurisdiction

Angola is the first jurisdiction to be researched/implemented against this architecture.

Current architectural status:

```text
ANGOLA_FIRST_REAL_JURISDICTION=YES
ANGOLA_PRODUCTION_ADAPTER=DISABLED
UNVERIFIED_LEGAL_RULES=PROHIBITED
```

The design discussion identified the current legal baseline as Decreto Presidencial n.º 71/25 and identified Decreto Executivo n.º 683/25 as material to electronic invoicing/technical requirements. Production enablement remains prohibited until the legal evidence pack is complete and the detailed technical requirements are verified from authoritative/current sources.

The Angola package should separate concerns rather than become one giant adapter:

```text
AngolaLegalProfile
AngolaDocumentPolicy
AngolaElectronicInvoicingPolicy
AngolaDocumentPresentationRequirements
AngolaTaxPolicy (only evidence-backed behavior)
AngolaEvidencePack
```

The jurisdiction layer controls requirements/validation; the Nexus renderer controls presentation mechanics.

## 18. Document semantics for Angola architecture

The architecture must support at least:

```text
Factura
Factura-Recibo
Recibo
Nota de Crédito
Nota de Débito (when evidenced/required)
```

Receipt is distinct from bank-transfer proof.

The existing generic `Payment → Receipt` path is a useful current technical slice but must not be assumed to cover full production invoicing semantics. Future Angola-compliant flows may require explicit relationships among obligation/commercial operation, invoice/invoice-receipt, payment, receipt, and corrective documents according to verified rules.

## 19. Institution branding

Official/customer-facing document branding is institution-first:

```text
PRIMARY BRANDING = issuing institution
NEXUS BRANDING = discreet platform attribution when permitted
```

Example intent:

```text
[Institution logo]
Institution legal/display name
Tax identifier / address / contact as required or permitted

... document body ...

Issued through Nexus Edu IA (optional/permitted footer)
```

Nexus must not visually impersonate a bank/provider.

## 20. Relationship to Nexus Aurora

Nexus Aurora governs application surfaces and may influence the document design system, but document presentation has separate documentary constraints.

Aurora never alters:

- document type semantics;
- legal/jurisdiction requirements;
- numbering authority;
- immutable snapshots;
- parties;
- tax values;
- evidence/provenance truth.

Finance Aurora remains a parallel track. Current proven Finance domain flows (eligibility, issuance, idempotency, numbering, correction, artifacts, audit/outbox, tenant isolation) are protected unless a reproducible defect exists.

The current Aurora visual implementation remains subject to a separate human visual checkpoint before broad propagation.

## 21. Schema strategy

A richer immutable documentary snapshot is likely to require schema work, but this design does NOT authorize a migration.

Rejected strategies:

```text
A. Grow source_snapshot into an unstructured bag of issuer/recipient/tax data.
B. Add many jurisdiction-specific columns directly to finance_financial_documents.
```

Preferred conceptual direction:

```text
Financial Document
+ versioned structured documentary snapshot
+ documentary schema version
+ existing jurisdiction/policy provenance as appropriate
```

Exact persistence shape requires repository-fit and migration authority adjudication.

Known migration-order conflicts remain a separate P0 concern. No new migration may be created/renumbered automatically under this design.

If implementation requires schema change before migration authority is reconciled, execution must stop with an explicit migration-authority blocker.

## 22. End-to-end target BPM

The architecture is successful only when it supports a real institutional flow, not merely a renderer test:

```text
CONFIGURE INSTITUTION
        ↓
valid legal identity
        ↓
CREATE FINANCIAL RELATIONSHIP
        ↓
beneficiary / billing party / document recipient
        ↓
CREATE REAL OBLIGATION / COMMERCIAL OPERATION
        ↓
issue appropriate charge/invoice document when policy requires
        ↓
REGISTER / CONFIRM PAYMENT
        ↓
link external bank/provider evidence when available
        ↓
issue appropriate receipt/invoice-receipt document
        ↓
immutable documentary snapshot
        ↓
official number
        ↓
Preview = PDF presentation truth
        ↓
persistence / history / audit / correction
```

The exact document sequence is jurisdiction/document-policy controlled and must not be invented by presentation code.

## 23. Definition of Done

A production-grade document capability is not complete until applicable gates pass:

```text
DOMAIN_TRUTH=PASS
BPM_FLOW=PASS
TENANT_ISOLATION=PASS
AUTHORIZATION=PASS
DOCUMENT_PARTIES=PASS
INSTITUTION_LEGAL_IDENTITY=PASS
DOCUMENT_RECIPIENT_RESOLUTION=PASS
DOCUMENT_READINESS=PASS
DOCUMENTARY_SNAPSHOT=PASS
NUMBERING_IDEMPOTENCY=PASS
HISTORICAL_IMMUTABILITY=PASS
TERMINOLOGY=PASS
TECHNICAL_LEAKAGE_TO_NORMAL_UX=NO
PREVIEW_PDF_PARITY=PASS
PERSISTENCE_EVIDENCE=PASS
AUDITABILITY=PASS
RESPONSIVE_PREVIEW=PASS
ACCESSIBILITY=PASS
REAL_HUMAN_UAT=PASS
```

For jurisdiction production compliance additionally:

```text
AUTHORITATIVE_LEGAL_EVIDENCE=PASS
UNVERIFIED_RULES=0
JURISDICTION_ADAPTER_ENABLEMENT=EXPLICITLY_APPROVED
JURISDICTION_SPECIFIC_UAT=PASS
```

## 24. Protected baseline

The following current Finance guarantees are protected and should not be rewritten merely to implement presentation:

```text
receipt eligibility authority
server-side issuance validation
atomic numbering
idempotency
Financial Document persistence
correction immutability
artifact generation/private access
audit/outbox
tenant isolation
historical fiscal policy provenance
```

A new document architecture extends these boundaries; it does not casually replace them.

## 25. Non-goals

This design does not authorize:

- immediate Angola production enablement;
- guessed legal/tax/e-invoicing rules;
- a new default jurisdiction;
- rendering a technical UAT artifact as a production receipt;
- a Finance-owned duplicate Institution identity;
- automatic assumption that payer = recipient;
- automatic assumption that beneficiary = recipient;
- bank/provider impersonation;
- live-data reconstruction of issued historical documents;
- schema migrations before migration authority adjudication;
- redesign of all Nexus modules;
- reopening proven Finance domain flows without a reproducible defect.

## 26. Architecture freeze decisions

The approved architecture freezes the following decisions:

```text
DOCUMENT_ARCHITECTURE_V1=FROZEN
CANONICAL_DOCUMENT_MODEL=FROZEN
DOCUMENT_PARTIES_V1=FROZEN
INSTITUTION_LEGAL_PROFILE=TRANSVERSAL_AUTHORITY
BILLING_PARTY_SEMANTICS=FROZEN
DOCUMENT_RECIPIENT_RESOLUTION=DOMAIN_POLICY_RESPONSIBILITY
DOCUMENTARY_SNAPSHOT_BOUNDARY=FROZEN
DOCUMENT_READINESS_MODEL=FROZEN
PRESENTATION_BOUNDARY=FROZEN
BANK_PROOF_IS_RECEIPT=NO
PAYER_EQUALS_RECIPIENT=NOT_ASSUMED
BENEFICIARY_EQUALS_RECIPIENT=NOT_ASSUMED
PDF_IS_AUTHORITY=NO
RENDERER_CONTAINS_FISCAL_RULES=NO
LIVE_DATA_REBUILDS_OLD_DOCUMENT=NO
TECHNICAL_METADATA_IN_NORMAL_DOCUMENT=NO
PRODUCTION_FAKE_DATA=PROHIBITED
MISSING_REQUIRED_DATA=FAIL_CLOSED
ANGOLA_FIRST_REAL_JURISDICTION=YES
MULTI_JURISDICTION_ARCHITECTURE=PRESERVED
ANGOLA_PRODUCTION_ENABLEMENT=PENDING_EVIDENCE
```

## 27. Written-spec self-review

### Placeholder scan
No TBD/TODO implementation placeholders are intentionally present. Items marked conceptual require repository-fit by design and are not permission to guess an implementation shape.

### Authority consistency
- Institution Legal Profile extends the shared Institution authority; Finance is a consumer.
- Document recipient resolution belongs to domain/document policy, not renderer/UI.
- Issued snapshot is immutable and historical.
- Renderer is presentation-only.
- Jurisdiction policy is evidence-backed.
- Browser and PDF remain non-authoritative.

### Scope consistency
This specification defines the product/document architecture and explicit boundaries. It does not authorize schema change or Angola production enablement. Those require separate implementation/migration/legal gates.

### Repository-fit findings preserved
- `Payment.paymentReference` exists and is the appropriate human payment reference candidate.
- Payment/provider evidence fields already exist and must not be confused with official document numbering.
- Current Financial Document source snapshot is too narrow for a production documentary snapshot.
- Current Institution schema does not prove a complete legal profile.
- Current renderer is persistence-shaped/technical rather than production-document-shaped.

### Remaining implementation planning questions
These are execution/repository-fit questions, not open product architecture decisions:
- exact shared storage authority for organization recipients;
- exact Institution Legal Profile persistence shape;
- exact documentary snapshot persistence format/versioning;
- exact migration sequencing after P0 migration adjudication;
- exact current legal/technical evidence required to enable Angola production adapter.
