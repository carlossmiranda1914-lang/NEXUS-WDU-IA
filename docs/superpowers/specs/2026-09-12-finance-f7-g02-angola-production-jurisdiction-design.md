# Nexus Edu IA — F7-G02 Angola Production Jurisdiction Completion

**Status:** PRODUCT OWNER APPROVED DESIGN — READY FOR HUMAN SPEC REVIEW  
**Date:** 2026-09-12  
**Risk:** FINANCE / FISCAL / HIGH  
**Primary priority:** close the real end-to-end Finance F7 corridor before UX/visual redesign  
**Baseline:** `b0cf0ba553be19c2414c7fb675d489621fe02e92`

## 1. Purpose

F7-G02 removes the first causal blocker preventing the real Finance corridor from reaching official fiscal-document issuance in production.

G02 does **not** create a new Finance architecture. It completes the already-approved F7 multi-jurisdiction architecture by adding Angola as the first real production jurisdiction, while preserving all existing Finance authorities and fail-closed behavior.

The larger Finance priority remains:

`institution configuration -> real jurisdiction -> real fiscal configuration -> official series -> obligation -> payment -> allocation -> documentary eligibility -> official issuance -> immutable snapshot -> official artifact/PDF -> later retrieval -> correction -> refresh/relogin/restart persistence`

G02 is complete only insofar as it materially advances that corridor. G02 completion must never be misreported as full F7 closure unless all downstream corridor gates also pass.

## 2. Existing architecture is authoritative

The following repository decisions remain authoritative and must not be redesigned:

- International Finance Core with country-specific jurisdiction adapters.
- Institution Financial Profile is the server-authoritative source of primary financial jurisdiction.
- Jurisdiction, currency, locale, timezone and provider are independent dimensions.
- Fiscal Configuration is adapter-governed; no synthetic/default configuration is allowed when a production jurisdiction policy is unavailable.
- Financial Document is distinct from Obligation, Payment, Allocation and Reconciliation.
- Issued Financial Documents are immutable.
- Numbering is server/PostgreSQL authoritative, atomic and idempotent.
- Documentary Snapshot V2 is immutable historical documentary truth.
- Institution Legal Profile is shared institutional authority, not Finance-owned duplication.
- Document parties are explicit; beneficiary, billing party, payer and recipient are not assumed equal.
- Canonical Presentation is distinct from financial authority.
- PDF/artifact is representation, not authority.
- Country-specific rules are forbidden in generic Finance core logic.
- Unsupported or ambiguous jurisdiction behavior fails closed.
- `NEXUS_TEST` / `core` remain test/UAT-only composition and are forbidden as production Angola substitutes.

## 3. Scope

G02 covers Angola (`AO`) as the first real production jurisdiction for the following document semantics:

- `invoice` -> Factura
- `invoice_receipt` -> Factura-Recibo
- `receipt` -> Recibo
- `credit_note` -> Nota de Crédito
- `debit_note` -> Nota de Débito

Support is evaluated per document type. Angola is not represented by one global editable `READY` boolean.

A document type may be `READY` while another remains `BLOCKED`, but no type may be declared `READY` without complete evidence, policy, source semantics, fiscal configuration compatibility, effective series and end-to-end proof.

## 4. Non-goals

G02 does not authorize:

- visual/Aurora redesign;
- new Finance architecture;
- a new jurisdiction selector;
- a second Institution Legal Profile;
- a second numbering authority;
- a second Financial Document authority;
- replacement of Obligation, Payment or Allocation authorities;
- rebuilding Documentary Snapshot V2;
- generic future-country abstractions beyond what Angola requires now;
- hard-coded Angola branches in generic Finance core;
- fake compliance claims;
- inference of unverified fiscal/e-invoicing behavior;
- reuse of `NEXUS_TEST` or adapter key `core` as production Angola behavior.

## 5. Production evidence standard

A production rule may be enabled only from authoritative primary evidence.

Accepted authority for production enablement must be an official primary source or an officially published normative/technical source applicable to the rule being encoded.

Secondary sources may assist discovery or interpretation but cannot independently enable production behavior.

For every production-relevant rule, the implementation evidence must trace:

`rule -> official source -> exact normative basis -> Nexus interpretation -> affected document type/capability -> executable policy -> verification test`

Unverified, ambiguous or conflicting requirements fail closed.

## 6. Angola evidence state

Current approved baseline identifies:

- Decreto Presidencial n.º 71/25 as the canonical legal baseline already researched for invoice/document semantics;
- Decreto Executivo n.º 683/25 as material to electronic invoicing/technical requirements.

However, detailed technical/electronic requirements must not be inferred where primary-source evidence remains incomplete.

Therefore:

- `LEGAL_EVIDENCE_PROVEN` and `LEGAL_EVIDENCE_STILL_MISSING` must be explicit.
- `PRODUCTION_ADAPTER_ENABLEMENT` must remain blocked for any document capability whose mandatory evidence is incomplete.
- No environment flag may convert incomplete evidence into production compliance.

## 7. Evidence pack contract

The existing Angola architecture already requires an `AngolaEvidencePack` boundary. G02 implements/consolidates that authority rather than inventing a parallel architecture.

For each of the five document types, the evidence pack must resolve at least:

1. whether the document type is legally recognized/applicable;
2. event/source conditions that permit issuance;
3. mandatory documentary fields;
4. numbering/series requirements;
5. tax/document treatment required for the supported scenario;
6. required related-document references;
7. correction/cancellation semantics;
8. mandatory legal mentions/validation elements;
9. electronic/technical requirements when applicable;
10. applicable exceptions or regime limits.

Every category is one of:

- `PROVEN` — authoritative evidence is sufficient to encode the rule;
- `NOT_APPLICABLE` — authoritative evidence proves it does not apply to that capability;
- `BLOCKED` — evidence is missing, ambiguous or conflicting.

No category may silently default to `PROVEN`.

## 8. Policy authority and versioning

Legal/jurisdiction policy is Nexus Product authority. Institutions configure only institution-owned operational values permitted by that policy.

Institutions may not edit the legal meaning of:

- supported document types;
- required fiscal/document fields;
- legal mentions;
- correction semantics;
- document eligibility rules;
- statutory numbering restrictions;
- electronic/fiscal protocol requirements.

Jurisdiction policy is versioned, effective-dated and historically immutable once used for issuance.

Issued documents preserve at least the already-established provenance needed to identify the governing context, including Financial Profile version, Fiscal Configuration version, adapter key/policy version, series/number and Documentary Snapshot.

A future policy change creates new prospective policy truth; it never rewrites an issued document.

## 9. Existing production registry contract

At the G02 baseline, the production fiscal adapter registry is empty and the only implemented adapter composition is synthetic `NEXUS_TEST/core` for UAT.

G02 may register Angola in the production registry only when the registration is backed by the approved evidence/policy boundary.

Registry presence alone does not mean all Angola document capabilities are ready.

Production readiness remains per document type.

## 10. Document-type source semantics

G02 preserves the source semantics already established by F7 and current code.

### 10.1 Recibo

Primary source authority: confirmed Payment.

The existing receipt corridor is the most complete implementation and already includes fiscal-configuration resolution, adapter selection, series resolution, document parties, settlement capture, Documentary Snapshot V2, numbering, audit/outbox and persistence.

G02 must add real Angola policy/configuration/series and prove the normal Angola flow; it must not rebuild the receipt engine.

### 10.2 Factura

Primary source authority: eligible Obligation.

Current code already recognizes invoice eligibility against an institution-scoped open Obligation, but complete issuance remains unimplemented.

G02 must add a complete invoice eligibility/snapshot/issuance path using the shared issuance authorities without routing Factura through payment-only receipt semantics.

### 10.3 Factura-Recibo

Primary source authorities: eligible Obligation + confirmed Payment + valid settlement/allocation relationship as required by policy.

Current code already contains an explicit invoice-receipt eligibility relationship requiring an active allocation between Payment and Obligation.

G02 must turn this existing semantic direction into a complete jurisdiction-backed issuance path.

### 10.4 Nota de Crédito

Primary documentary authority: an eligible original issued document plus the policy-permitted corrective basis and applicable economic/provenance facts.

The existing correction architecture preserving the original and creating a new linked document remains authoritative.

G02 must not model Nota de Crédito as merely another receipt derived from Payment. Angola-specific correction eligibility, amounts, references and documentary semantics require explicit evidence-backed policy.

### 10.5 Nota de Débito

Primary documentary authority: an eligible original/source relationship plus policy-permitted debit/corrective basis.

No production pipeline is currently proven. G02 must implement only evidence-backed semantics and must not derive Nota de Débito by sign-flipping Nota de Crédito.

## 11. Shared issuance core vs document-specific semantics

G02 must preserve shared issuance infrastructure for universal concerns:

- institutional context and tenant isolation;
- IAM/capability authorization;
- idempotency;
- Financial Profile and jurisdiction resolution;
- Fiscal Configuration;
- series and numbering;
- transaction boundaries;
- immutable issued-document persistence;
- Documentary Snapshot persistence;
- audit/outbox;
- artifact integrity;
- historical immutability.

Document-specific logic owns only the semantic differences needed for eligibility, source relationships, documentary fields, snapshot composition and policy-required correction behavior.

The target is neither five duplicate engines nor one generic function that ignores document semantics.

## 12. Readiness contract

Readiness is server-derived and document-type-specific.

A document type can be `READY` only when all required gates are satisfied:

`active institution + authorized institutional context + effective Financial Profile + effective Institution Legal Profile + supported/evidenced Angola jurisdiction policy + effective Fiscal Configuration + effective document-specific series + eligible source relationship + resolved document parties + required documentary data`

The authoritative issuance command revalidates applicable requirements inside its transaction/locking boundary before number allocation.

Missing evidence or mandatory data never consumes a definitive number.

Frontend reads server readiness; it does not reconstruct fiscal readiness locally.

## 13. Fail-closed behavior

The following conditions block the affected capability without fallback:

- unsupported/ambiguous policy version;
- missing authoritative evidence;
- unsupported document type;
- invalid/missing fiscal configuration;
- missing/effective-series failure;
- source not eligible;
- unresolved required document party;
- missing mandatory documentary field;
- adapter/configuration mismatch;
- conflicting effective policy versions;
- technical/e-invoicing requirement that is mandatory but not implemented/proven.

A blocked document type must expose a stable reason code and safe product guidance, not technical leakage or false success.

## 14. Sequencing inside G02

G02 remains one product objective but is executed through closed capabilities to avoid five partially implemented document types:

- G02-A — authoritative Angola evidence/policy gate;
- G02-B — Recibo Angola end-to-end;
- G02-C — Factura Angola end-to-end;
- G02-D — Factura-Recibo Angola end-to-end;
- G02-E — Nota de Crédito Angola end-to-end;
- G02-F — Nota de Débito Angola end-to-end;
- G02-G — aggregate regression, persistence/restart and full human UAT.

Each capability is completed before it is treated as production-ready.

## 15. Verification standard

A capability does not pass because a class exists, registry entry exists, unit test passes, HTTP returns 200, or a PDF contains bytes.

Verification is layered:

`evidence traceability -> policy tests -> targeted RED/GREEN -> domain -> real PostgreSQL -> HTTP/IAM -> tenant negatives -> concurrency/idempotency where applicable -> artifact/PDF -> browser normal flow -> refresh -> logout/login -> application restart -> regression -> human UAT`

For every document type marked `READY`, normal operator proof must establish:

`real source -> eligible action -> preview -> issue -> definitive series/number -> immutable snapshot -> official artifact -> source/document navigation -> refresh -> relogin -> restart -> same authoritative document`

Corrective document types additionally prove the original remains immutable and the corrective relationship survives restart.

## 16. Human UAT closure

G02 human UAT must use normal product routes and authenticated institutional context.

Fixtures may prepare controlled source facts, but may not replace product capabilities needed by a normal operator.

No SQL, direct database mutation, Postman, DevTools request fabrication or hidden helper may be required to complete the normal institutional configuration/issuance flow.

## 17. G02 Definition of Done

G02 is closed only when:

- authoritative Angola source inventory is complete for every production-enabled rule;
- rule-to-source traceability passes;
- unsourced production rules = 0;
- ambiguous production rules = 0;
- Angola-specific rules added to generic core = 0;
- synthetic production fallback = 0;
- each of the five document types is either fully `READY` with complete proof or is explicitly `BLOCKED` by a named unresolved authoritative evidence dependency;
- all document types declared `READY` have real PostgreSQL, IAM/tenant, idempotency/numbering, artifact, browser and restart proof;
- no existing Finance invariant regresses;
- normal product flow requires no technical intervention.

Because Product Owner selected the five-document G02 scope, an explicitly blocked type remains an open G02 gap until its authoritative evidence dependency is resolved; it may not be silently dropped from scope.

## 18. Relationship to full Finance F7 closure

G02 completion is necessary but not sufficient for full Finance F7 closure.

After G02, the complete Finance corridor must still be audited for any remaining P0/P1/unproven gaps, including source-document navigation, persistence/restart, pre-issue product flow, Office-edit prohibition and any normal-flow defects not already closed by G02.

The visual/Aurora implementation phase remains deferred until the functional corridor reaches:

- `P0_OPEN=0`
- `P1_OPEN=0`
- `UNPROVEN_CRITICAL_REQUIREMENTS=0`
- `NORMAL_PRODUCT_FLOW=PASS`
- `RESTART_PERSISTENCE=PASS`
- `HUMAN_UAT=PASS`

## 19. Frozen boundaries

G02 must not reopen the following without a reproducible defect or explicit Product Owner-approved requirement change:

- G01 normal institutional configuration architecture;
- Finance Constitution F0/F1 invariants;
- Obligation/Payment/Allocation authority separation;
- tenant/IAM authority model;
- numbering authority;
- Financial Document immutability;
- Documentary Snapshot V2;
- document-party architecture;
- Institution Legal Profile ownership;
- correction-chain structural invariant;
- canonical presentation boundary;
- artifact authority;
- no-default-country rule.

## 20. Final design contract

```text
G02_SCOPE=ANGOLA_PRODUCTION_JURISDICTION_COMPLETION
PRIMARY_PRIORITY=FULL_REAL_FINANCE_CORRIDOR
EXISTING_ARCHITECTURE=AUTHORITATIVE
NEW_FINANCE_ARCHITECTURE=NO
DOCUMENT_TYPES=5
READINESS=PER_DOCUMENT_TYPE
PRIMARY_OFFICIAL_EVIDENCE_REQUIRED=YES
SECONDARY_SOURCE_CAN_ENABLE_PRODUCTION=NO
AMBIGUITY=FAIL_CLOSED
SYNTHETIC_PRODUCTION_FALLBACK=FORBIDDEN
POLICY_VERSIONING=REQUIRED
HISTORICAL_REWRITE=FORBIDDEN
NORMAL_PRODUCT_FLOW_REQUIRED=YES
RESTART_PROOF_REQUIRED=YES
VISUAL_UX_PHASE=DEFERRED
```
