# Nexus Edu IA — FINANCE-F7 Official Financial Documents Design

**Status:** PRODUCT OWNER APPROVED DESIGN — NOT IMPLEMENTATION AUTHORITY  
**Date:** 2026-09-08  
**Risk:** FINANCE / FISCAL / HIGH  
**Scope:** Official financial/fiscal document authority, jurisdiction resolution, fiscal configuration, series/numbering, issuance, immutable snapshots/provenance, correction, artifacts, operational UX and verification.  
**Implementation authorization:** NO. This specification must be reviewed against the exact implementation baseline before an implementation plan is authorized.

## 1. Executive summary

FINANCE-F7 adds official financial-document capability on top of established Nexus Finance truth. It does not rebuild or replace Obligation, Payment, Allocation, Adjustment, Discount, Journal or Financial Profile authority.

Product outcome: an authorized operator in a correctly configured institution can start from real Nexus financial facts, see only document intents eligible under the institution's effective jurisdiction/policy, preview the proposed document, issue exactly one authoritative numbered document, view/download its official artifact, restart/re-enter the product and recover the same document, and later follow a supported corrective workflow without rewriting financial history.

Normal product completion must require no SQL, Postman, DevTools or test helper. Fixtures may prepare controlled test state but may not replace product functionality.

## 2. Authority precedence and repository baseline gate

This design derives from the Product Owner-approved F7 decisions and the existing Finance constitution. Existing Finance laws remain superior where they already establish authority: Financial Document is distinct from Obligation, Payment, Allocation and Reconciliation; confirmed economic facts are immutable; institutional context is server-derived; policy/profile context is versioned; canonical writes are transactional PostgreSQL authority.

Known process issue at authoring time: prior local execution evidence referenced a later SHA not visible from the current GitHub `main` baseline. This design therefore creates no implementation authorization. Before implementation planning/execution, the executor must reconcile the exact branch/SHA containing the accepted F1–F6 Finance implementation and prove clean remote parity. No force-push, destructive reset or history overwrite is authorized to resolve that discrepancy.

## 3. Goals

F7 must provide:

- a first-class Financial Document authority separate from economic authorities;
- server-side jurisdiction adapter resolution from the effective Institution Financial Profile;
- institution fiscal configuration and fiscal series within adapter policy;
- atomic, idempotent, concurrency-safe issuance and numbering in PostgreSQL;
- immutable issued snapshots and provenance;
- first-class corrective document relationships without historical rewrite;
- deterministic/versioned official artifact evidence;
- capability-based, tenant-safe read/issue/correct/configure operations;
- minimal operational UX from source financial context to eligible document;
- real PostgreSQL, HTTP/security, concurrency, restart, PDF and browser proof.

## 4. Non-goals

F7 does not implement bank reconciliation, recurring billing, payables, treasury, advanced BI/reporting, a full general ledger, generic ERP document authoring, generalized external tax-authority transmission, every jurisdiction, automatic email/WhatsApp delivery, a global design-system redesign, Microsoft 365 editing, or unrelated F1–F6 refactors.

## 5. Existing authorities preserved

Conceptual existing spine:

`Obligation -> Payment -> Unapplied Position -> Allocation -> Adjustments/Discounts -> Financial Position -> Journal/Projection/UI`

F7 begins where that spine needs official documentary representation. It references established financial facts and may derive documentary eligibility from them; it does not mutate their meaning.

- Invoice-like document primary economic truth: eligible Obligation.
- Receipt-like document primary economic truth: confirmed Payment.
- Invoice-receipt-like document: eligible Obligation + confirmed Payment + settlement relationship required by jurisdiction policy.
- Allocation remains separate truth.
- Reconciliation remains separate truth.

## 6. System context

`Authenticated intent -> Institutional Context -> capability authorization -> effective Financial Profile -> jurisdiction adapter/policy -> fiscal configuration -> source financial facts -> eligibility/validation -> PostgreSQL issuance transaction -> issued Financial Document + snapshots/provenance + audit/outbox -> authoritative projection -> read-only official artifact -> UI`

External provider/network calls are forbidden while canonical Finance transaction/locks are held.

## 7. F7-D01 — Financial Document authority

Financial Document is its own institution-scoped authority. It references Payment, Obligation, Allocation and other explicitly eligible facts but never replaces or mutates them. Merely creating a document does not create payment, settlement or reconciliation truth.

## 8. F7-D02 — Lifecycle and immutability

Conceptual lifecycle:

`DRAFT/PREPARATION -> issuance validation -> ISSUED -> later policy-governed correction/cancellation -> COMPENSATING/CORRECTIVE DOCUMENT relationship`

Pre-issuance preparation may change. After issuance, definitive series/number, issued snapshots, values and provenance are immutable. Destructive update/delete is not a correction mechanism. Definitive numbering occurs only during authoritative issuance. Adapter policy controls legally valid corrective/cancellation lifecycle.

## 9. F7-D03 — Series, numbering and concurrency

- series authority is institution-scoped;
- institution may configure series only within jurisdiction policy;
- number assignment is PostgreSQL-authoritative and atomic with issuance;
- database uniqueness prohibits duplicate institution+series+number;
- `MAX(number)+1` application logic is forbidden;
- issuance is idempotent;
- assigned definitive numbers are never reused;
- internal document ID is separate from public number;
- gap behavior is adapter/policy-controlled, not invented by the core;
- browser has no numbering authority.

Exact lock ordering must reuse/reconcile the accepted repository transaction conventions before implementation.

## 10. F7-D04 — Semantic truth, snapshots and provenance

Issued documents capture immutable issuer, recipient, economic and provenance snapshots sufficient to explain historical issuance. Live source references are also preserved. Later source/profile/config changes do not rewrite the issued snapshot.

The issued record captures at minimum the applicable Financial Profile version, jurisdiction policy version, fiscal configuration version, series identity/version and authoritative source references as required by type/policy.

Browser-supplied totals, taxes, payment status, jurisdiction or institutional identity are not authority.

## 11. F7-D05 — Jurisdiction Adapter Contract

Jurisdiction is resolved server-side from the effective Institution Financial Profile. A canonical adapter registry resolves the supported jurisdiction adapter and effective policy version.

Core owns universal authority: identity, tenant boundary, provenance, immutable snapshot semantics, idempotency, transaction, document relationships, audit/outbox and universal invariants.

Jurisdiction adapters own jurisdiction-specific document types, required fiscal fields, tax/document validation, series restrictions, eligibility and legally permitted correction/cancellation behavior.

Country-specific legal rules are forbidden in generic core logic. Unsupported jurisdiction fails closed. Technical reuse between Portugal and Angola is allowed only where semantics are genuinely common; legal assumptions must remain separately evidenced.

## 12. F7-D06 — Institutional Fiscal Configuration

F7 creates no second region/jurisdiction selector. Jurisdiction comes from the Financial Profile.

Institution fiscal configuration may contain adapter-supported fiscal identity, establishments/locations, series configuration, presentation choices and other allowed institutional options. It is versioned/effective-dated, adapter-validated and must reach a valid/active state before dependent issuance.

Institution operators may configure only options permitted by the adapter policy; they cannot alter legal policy or economic truth. Configuration authorization is distinct from issuance authorization. Used series/history cannot be silently redefined.

## 13. F7-D07 — Issuance command and transaction boundary

Required flow:

`authenticated request -> server institution -> capability -> idempotency -> effective profile -> adapter/policy -> fiscal config -> document eligibility -> reload source facts -> economic/fiscal validation -> BEGIN -> lock canonical authorities in repository-approved order -> lock/advance series -> assign definitive number -> persist immutable issued document -> snapshots/provenance -> audit/outbox -> COMMIT -> authoritative post-commit read -> response/UI`

The browser sends intent only. It may send document type intent, allowed source references, allowed series selection, permitted supplemental recipient data and idempotency key. It may not authoritatively send institution, jurisdiction, policy/profile version, definitive number, authoritative totals/tax or payment state.

Issuance is all-or-nothing for canonical document authority. Retry/ambiguous timeout recovers by idempotent canonical lookup before creating anything new. Success is shown only after authoritative commit.

## 14. F7-D08 — Correction, cancellation and cross-authority consequences

Document correction, document cancellation, payment reversal and allocation reversal are distinct operations. Changes to Payment/Allocation/Obligation never rewrite an issued document.

When a later financial event creates a documentary consequence, adapter policy determines whether no action, corrective document, cancellation/replacement or explicit review is required. Nexus must not automatically fabricate an unauthorized fiscal document.

Corrective relationships are first-class, institution-scoped PostgreSQL relationships. The original remains visible and immutable. Partial correction is structurally supported by the core where policy permits it. Issuance state is distinct from derived compliance/action-required state.

## 15. F7-D09 — Rendering, PDF, storage and evidence

PostgreSQL Financial Document authority is primary; PDF is an artifact representation, not financial authority. Rendering consumes the immutable issued snapshot and must not recalculate economic truth from current live data.

Artifact evidence should preserve document ID, render/template version, generation timestamp, content hash, storage reference, media type and byte size as applicable. Historical rendering uses the issued snapshot and versioned rendering policy.

Issuance and artifact generation/delivery are distinct outcomes. If artifact generation fails after commit, the Financial Document remains issued and artifact generation is retryable from the immutable snapshot; a second Financial Document is not created. Missing/corrupt integrity evidence is an incident, never justification for silent replacement.

Artifact access is private and server-authorized; cross-tenant artifact access is forbidden.

## 16. F7-D10 — Operational UX

Normal operator flow is source-context-first, not a generic fiscal form:

`financial source -> server-derived eligible document actions -> read-only preview -> confirm issue -> definitive number -> view official document -> PDF/print/history`

The user does not re-enter country, currency, financial totals, tax authority, profile or number already known by Nexus. Unsupported/ineligible document types are not presented as valid actions.

Configuration errors are actionable and permission-aware. Double-click is protected. Ambiguous timeout performs idempotent recovery. Document history is navigable source-to-document and document-to-source. Corrective chains and action-required state are understandable to normal operators without exposing technical internals.

An institution-level Document Workspace may list/search/filter official documents and expose allowed actions, but advanced financial reporting is outside F7.

## 17. F7-D11 — IAM, security and tenant boundaries

Institution context is server-authoritative. Exact capability names must reuse the accepted IAM model rather than invent a parallel permission framework.

Capabilities must distinguish at least the semantic abilities to read documents, issue documents, correct documents, read/manage fiscal configuration and read/manage series. Issuance does not imply configuration management or correction.

All document/source/series/correction/artifact relationships are tenant-validated. Foreign identifiers fail closed/non-disclose. Knowing an ID grants no access. Artifact download requires server authorization. Security-sensitive actions preserve actor/capability provenance and audit evidence. Platform-level identity does not implicitly grant institution access outside canonical context.

## 18. F7-D12 — Verification strategy and Definition of Done

Verification is layered and risk-based:

`targeted RED/GREEN -> domain -> real PostgreSQL -> HTTP/IAM -> concurrency -> Finance integration -> restart persistence -> real PDF -> real browser -> regression -> human UAT`

Full unchanged regressions are not repeated wastefully, but closure requires complete relevant regression evidence. A technical pass cannot override failed product UAT.

PT/AO or any other real jurisdiction compliance requires separate current authoritative regulatory evidence. Generic adapter architecture does not prove legal compliance.

## 19. F7-D13 — Nexus Document Platform boundary

F7 follows `docs/superpowers/specs/2026-09-08-nexus-document-platform-architecture-design.md`.

Official Financial Document classification is immutable/read-only in the common document experience. It may be previewed, downloaded, printed and corrected through Finance policy; arbitrary Word/Excel/PowerPoint editing is forbidden.

The common Document Platform may later store/expose Finance artifacts through provider-neutral infrastructure but may not become Finance authority, recalculate financial truth or create fiscal corrections. Full Microsoft 365 integration is outside F7.

## 20. Closed invariant register

| ID | Mandatory invariant | Primary proof |
|---|---|---|
| F7-I01 | Issuing a document never mutates Obligation, Payment or Allocation truth. | Domain + PostgreSQL + Finance regression |
| F7-I02 | An `ISSUED` document is immutable. | PostgreSQL + negative mutation tests |
| F7-I03 | Jurisdiction comes exclusively from the effective server-side Financial Profile. | Domain + HTTP + PostgreSQL |
| F7-I04 | Fiscal rules come from a versioned adapter/policy. | Adapter tests + provenance |
| F7-I05 | Definitive number is assigned only by the server inside issuance. | PostgreSQL + HTTP |
| F7-I06 | Institution+series+number cannot duplicate. | DB constraint + concurrency |
| F7-I07 | Retry of the same issuance intent cannot create a second document. | Idempotency + concurrency |
| F7-I08 | Preview has no financial/fiscal authority. | Domain + HTTP |
| F7-I09 | Issuance reloads and revalidates authoritative source facts. | Concurrent-state integration |
| F7-I10 | Issued snapshots and provenance are historically preserved. | PostgreSQL + restart |
| F7-I11 | Later profile/config/policy changes cannot rewrite issued history. | Historical-state regression |
| F7-I12 | Correction creates new documentary truth and preserves the original. | PostgreSQL + HTTP + browser |
| F7-I13 | Every document/source/series/correction relation is same-institution. | Cross-tenant negatives |
| F7-I14 | Knowing resource identifiers grants no access. | IAM/HTTP negatives |
| F7-I15 | PDF/artifact represents issued truth; it is not authority. | Artifact + real PDF |
| F7-I16 | Renderer never recalculates financial truth. | Snapshot/render tests |
| F7-I17 | Post-commit artifact failure never reverses issuance or creates a second document. | Failure/recovery integration |
| F7-I18 | Issued fiscal documents cannot be edited through Office/general editing. | Domain + UI/browser |
| F7-I19 | UI reports issuance success only after authoritative commit/read. | HTTP + browser |
| F7-I20 | Restart preserves the exact issued identity, number, snapshots and provenance. | Restart persistence gate |

Any violation of F7-I01–F7-I20 blocks closure.

## 21. Product Outcome Contract

FINANCE-F7 is complete only when a correctly configured institution can transform real existing Nexus financial truths into eligible, persistent, auditable and recoverable official/fiscal documents through normal product UI, without creating a second financial authority and without technical intervention to complete the normal flow.

If a later relevant financial change occurs, the historical issued document remains intact and Nexus exposes the policy-supported documentary consequence without rewriting financial history.

## 22. Canonical human UAT

### UAT-01 — Normal issuance

Authorized operator opens a real Obligation/Payment context, sees only eligible document actions, previews read-only, confirms, receives one definitive numbered document, can open its history/provenance and official artifact.

Required invariants: I01, I03, I04, I05, I08, I09, I19.

### UAT-02 — Real persistence

After UAT-01: refresh, logout/login, application restart and return to Finance. The same document ID, series, number, values, snapshots and provenance remain.

Required: I02, I10, I11, I20.

### UAT-03 — Incomplete fiscal configuration

Missing mandatory configuration fails closed without hidden defaults or false success. UI explains what is missing and exposes an authorized recovery path when the operator has configuration permission.

Required: I03, I04, I19.

### UAT-04 — Authorization

An operator with issue capability can issue; an operator with read-only capability can read but cannot issue/correct/configure. Browser/request manipulation does not bypass server authorization.

Required: I14, I19 plus F7-D11 negative capability proof.

### UAT-05 — Retry, double-click, concurrency and timeout

Double-click/same idempotent command produces exactly one document and one definitive number. Concurrent distinct issuance in the same series produces unique policy-valid numbering. A stale/concurrently changed source is coherently revalidated or fails closed. Ambiguous timeout recovers by canonical lookup, not blind reissuance.

Required: I05, I06, I07, I09, I19.

### UAT-06 — Tenant isolation

Institution A cannot use/read Institution B's Obligation, Payment, Allocation, series, document, corrective target or artifact even when identifiers are known.

Required: I13, I14.

### UAT-07 — Historical change and correction

A later legitimate financial event does not mutate the original issued document. Policy-required action is visible; an authorized supported correction creates a new linked document/fact and the original/correction chain remains navigable.

Required: I01, I02, I10, I11, I12.

### UAT-08 — Real human document

A real official PDF/artifact opens and is visually verified for applicable document type, issuer/institution, recipient, definitive series/number, date, currency, lines/descriptions, totals, required jurisdiction fiscal information and corrective references. It matches immutable issued truth. The official document offers no Office editing action.

Required: I15, I16, I17, I18.

## 23. Evidence rules

- `PASS` without traceable evidence is forbidden.
- A test name without an execution result is not evidence of pass.
- HTTP 200 alone is not product proof.
- non-empty PDF bytes alone are not PDF UAT.
- screenshot alone is not backend-authority proof.
- browser success alone is not tenant-isolation proof.
- unit tests alone are not persistence proof.
- fixtures may prepare state but cannot replace product behavior.
- normal flow requiring manual SQL, Postman or DevTools is not closed.

Each invariant must map to the strongest technical owner of proof plus behavioral evidence. Example: numbering uniqueness requires DB constraint, repository/concurrency behavior and UAT-05; no single layer substitutes for the others.

## 24. Concurrency and rollback proof contract

At minimum test deliberately:

A. same series, distinct valid documents -> unique valid definitive numbers;  
B. same idempotent command -> exactly one document/number;  
C. same semantically single-issuance source -> policy-safe single allowed outcome;  
D. source changes while issuance competes -> coherent revalidated state or fail closed.

Rollback tests must prove no partial authoritative document/snapshot/provenance/audit success leaks from a failed issuance transaction and numbering behavior follows the jurisdiction series policy.

## 25. HTTP/API semantic surface

Exact routes are implementation-plan decisions after repository-fit review. The product requires server-authorized capabilities for eligibility/preview, issue, list/detail, artifact access, corrective action and fiscal/series configuration as included by the chosen slice.

Domain failures must remain semantic (for example profile unavailable, jurisdiction unsupported, fiscal config incomplete, document type unsupported/ineligible, payment not confirmed, source changed, series unavailable/ineligible, recipient incomplete, already issued/concurrent conflict) rather than collapsing into fabricated success.

## 26. Artifact and Document Platform integration

The F7 artifact model must remain compatible with the provider-neutral Document Platform but may initially use the repository's existing safe storage mechanism. Do not create a second storage framework solely to satisfy this spec if an accepted repository mechanism already exists.

Official financial artifact classification is read-only. Common document search/navigation may reference it; Finance owns its authority and correction semantics.

## 27. Jurisdiction compliance evidence gate

Before implementing a real jurisdiction adapter, identify current authoritative legal/regulatory sources, record source/effective/version date where available, map each concrete fiscal requirement to source evidence and explicitly flag unresolved interpretation.

Portugal and Angola may be target adapters, but their legal policies are independently evidenced. No rule may be frozen merely from memory, country stereotypes or similarity between regimes. Unsupported/incompletely evidenced jurisdiction behavior fails closed.

## 28. Repository-fit review required before implementation plan

The executor must compare this design with the exact accepted baseline for:

- Finance transaction/repository conventions and lock ordering;
- migration naming/constraints;
- Money/exact-decimal types;
- Financial Profile effective resolution;
- Obligation, Payment, Allocation, Adjustment and Discount repositories;
- Journal, idempotency, audit and outbox;
- IAM capabilities and InstitutionalContext;
- HTTP error conventions and clients;
- Finance UI patterns;
- existing file/artifact/storage mechanisms.

Reuse existing mechanisms. Parallel frameworks are forbidden without explicit architectural adjudication.

Any conflict must be recorded as `REPOSITORY_CONFLICT_ID`, `APPROVED_DESIGN`, `CURRENT_IMPLEMENTATION`, `RECOMMENDATION` before implementation.

## 29. Risk register

| Risk | Prevention | Detection/proof |
|---|---|---|
| Duplicate numbering under concurrency | PostgreSQL atomic series authority + uniqueness | concurrent real-DB test |
| Retry creates duplicate document | scoped persisted idempotency | same-key race/retry test |
| Stale preview issued | reload/revalidate sources at issuance | concurrent source-change test |
| Cross-tenant source/artifact use | server tenant validation everywhere | negative tenant matrix |
| Current profile/config rewrites history | immutable version provenance/snapshot | historical-change regression |
| Legal rules hard-coded in core | adapter registry/policy boundary | architecture/code fence tests |
| Unsupported jurisdiction silently proceeds | fail closed | unsupported-jurisdiction test |
| Correction rewrites original | append/new relationship only | mutation-negative + correction test |
| PDF recalculates financial values | render issued snapshot only | render-source test |
| Artifact failure after issuance fabricates failure/reissue | separate artifact state/retry | injected failure/recovery test |
| Ambiguous timeout causes reissue | idempotent lookup/recovery | timeout UAT/integration |
| Policy changes reinterpret issued docs | captured policy version | version-change regression |
| Fiscal config changes during issuance | effective/version validation + transaction discipline | concurrent config-change test |
| Office integration exposes fiscal edit | immutable document class/action policy | UI/domain negative test |

## 30. Recommended independently closable slices

Final slice boundaries must follow repository dependencies after baseline reconciliation. Current recommended decomposition:

1. **F7-01 Financial Document Core Authority** — identity/lifecycle/snapshot/provenance/read model foundations.
2. **F7-02 Jurisdiction Resolution & Eligibility** — effective profile -> adapter/policy -> eligible document intents.
3. **F7-03 Institutional Fiscal Configuration & Series** — validated versioned config and series authority.
4. **F7-04 Numbering & Issuance Authority** — atomic issuance, idempotency, locking/concurrency, audit/outbox.
5. **F7-05 Jurisdiction Adapter v1** — only after current authoritative compliance evidence.
6. **F7-06 Rendering / Artifact Evidence** — deterministic artifact generation/integrity/retry.
7. **F7-07 Operational UX** — source-context issuance, history, correction/action-required experience.
8. **F7-08 Real Browser + PostgreSQL + Jurisdiction UAT** — closure proof, not substitute functionality.

Do not turn these into one giant implementation mission. Each slice must produce independently reviewable/testable progress without weakening the complete product outcome.

## 31. Migration and backward compatibility law

F7 migrations must be additive and tenant-safe unless an explicitly reviewed migration requires otherwise. No legacy mutable field becomes document authority. Existing Payment/Allocation/Obligation records are referenced through validated canonical identifiers; F7 does not rewrite them to manufacture documentary history.

Historical pre-F7 data requires an explicit product/migration policy before being represented as an official issued document. Backfilling an official fiscal document merely because an old payment exists is forbidden without jurisdiction/business authority.

## 32. Deferred work

Deferred beyond F7: generalized tax-authority network transmission, automated document delivery, advanced reporting/BI, generic template editing, Microsoft 365 editing, full cross-provider document synchronization, every jurisdiction, and unrelated Finance domains.

If a jurisdiction requires external authorization/communication, later design must distinguish Nexus internal issuance state from external authorization/communication state rather than holding a Finance DB transaction open across network calls.

## 33. Closure gate

Required final closure evidence conceptually includes:

`FINANCE_F7_01_IMPLEMENTATION=DONE`  
`DOMAIN_INVARIANTS=PASS`  
`POSTGRESQL_AUTHORITY=PASS`  
`ISSUANCE_ATOMICITY=PASS`  
`IMMUTABILITY=PASS`  
`IDEMPOTENCY=PASS`  
`NUMBERING_INTEGRITY=PASS`  
`CONCURRENCY=PASS`  
`FINANCIAL_TRUTH_PRESERVATION=PASS`  
`DOCUMENT_PROVENANCE=PASS`  
`CORRECTION_CHAIN=PASS`  
`IAM_AUTHORIZATION=PASS`  
`TENANT_ISOLATION=PASS`  
`NEGATIVE_SECURITY=PASS`  
`FISCAL_PROFILE_INTEGRATION=PASS`  
`JURISDICTION_POLICY=PASS`  
`FISCAL_CONFIGURATION=PASS`  
`ARTEFACT_INTEGRITY=PASS`  
`REAL_PDF_GATE=PASS`  
`PERSISTENCE_RESTART_GATE=PASS`  
`HTTP_OPERATIONAL_GATE=PASS`  
`REAL_BROWSER_GATE=PASS`  
`FINANCE_REGRESSION=PASS`  
`FOUNDATION_REGRESSION=PASS`  
`LINT=PASS`  
`BUILD=PASS`  
`TRACEABILITY_MATRIX=PASS`  
`DECISIONS_TRACEABLE=13/13`  
`INVARIANTS_PROVEN=20/20`  
`CANONICAL_UAT=8/8`  
`UNPROVEN_INVARIANTS=0`  
`PASS_WITHOUT_EVIDENCE=0`  
`P0_OPEN=0`  
`P1_OPEN=0`  
`HUMAN_UAT=ACCEPTED`  
`FINANCE_F7_01=CLOSED`

`IMPLEMENTED` is not synonymous with `CLOSED`.

## 34. Open decisions intentionally deferred to repository/compliance evidence

The following are not permission to improvise:

- exact existing IAM capability names;
- exact accepted Finance lock ordering;
- concrete artifact/storage implementation;
- first legally compliant jurisdiction adapter and exact supported document types/fields;
- external fiscal-authority state model if required by that jurisdiction;
- exact HTTP route naming consistent with accepted repository conventions.

Each must be resolved from repository evidence or current authoritative regulatory evidence before implementation.

## 35. Architecture decision summary

`FINANCIAL_DOCUMENT_AUTHORITY=SEPARATE`  
`DOCUMENT_MUTATES_FINANCIAL_FACTS=NO`  
`JURISDICTION_SOURCE=EFFECTIVE_FINANCIAL_PROFILE`  
`SECOND_REGION_AUTHORITY=NO`  
`COUNTRY_RULES_IN_CORE=FORBIDDEN`  
`NUMBERING_AUTHORITY=POSTGRESQL`  
`NUMBER_ASSIGNMENT=ATOMIC_ON_ISSUANCE`  
`IDEMPOTENT_ISSUANCE=REQUIRED`  
`ISSUED_DOCUMENT_IMMUTABLE=YES`  
`CORRECTION_REWRITES_ORIGINAL=NO`  
`BROWSER_FINANCIAL_AUTHORITY=NO`  
`EXTERNAL_NETWORK_INSIDE_FINANCE_TRANSACTION=NO`  
`PDF_IS_FINANCIAL_AUTHORITY=NO`  
`F7_FINANCIAL_PREVIEW=READ_ONLY`  
`ISSUED_FISCAL_DOCUMENT_OFFICE_EDITING=FORBIDDEN`  
`TENANT_CONTEXT=SERVER_AUTHORITATIVE`  
`REAL_POSTGRESQL_PROOF=REQUIRED`  
`REAL_PDF_UAT=REQUIRED`  
`REAL_BROWSER_UAT=REQUIRED`  
`PT_AO_COMPLIANCE_FROM_MEMORY=FORBIDDEN`  
`TECHNICAL_PASS_WITH_FAILED_PRODUCT_UAT=NOT_CLOSED`  
`IMPLEMENTATION_AUTHORIZED=NO`
