# Nexus Edu IA — FINANCE-F7 Documentary Snapshot V2 Canonical Contract

**Status:** PRODUCT OWNER APPROVED — CANONICAL SNAPSHOT AUTHORITY  
**Date:** 2026-09-11  
**Risk:** FINANCE / FISCAL / HIGH  
**Applies to:** new FINANCE-F7 issuance and corrective issuance after the V2 cutover  
**Implementation authorization:** this document defines the required target contract; code changes remain subject to the execution plan, tests and repository gates.

## 1. Authority and relationship to the F7 design

This contract refines `docs/superpowers/specs/2026-09-08-finance-f7-financial-documents-design.md` without replacing its authority boundaries.

The original F7 design remains authoritative for Financial Document ownership, jurisdiction resolution, fiscal configuration, numbering, IAM, tenant isolation, artifact evidence and the prohibition on rewriting Finance truth. This document is the **single canonical authority for documentary snapshot versioning, content, validation, correction snapshot semantics and V1/V2 compatibility**.

Where a prior implementation or planning text is less specific about snapshot semantics, this contract governs.

## 2. Version law

- `DocumentarySnapshotV1` is historical compatibility only.
- Existing V1 documents remain readable, renderable and immutable.
- Existing V1 rows are not rewritten in place merely to resemble V2.
- All new normal issuances after the V2 cutover create `snapshotVersion = 2`.
- All new corrective documents after the V2 cutover create their own `snapshotVersion = 2` snapshot.
- New issuance must never silently fall back to V1.
- Read models and renderers may support both V1 and V2, but write authority after cutover is V2 only.

`V1_HISTORY_PRESERVED=YES`  
`V1_NEW_WRITES=FORBIDDEN_AFTER_CUTOVER`  
`V2_NEW_ISSUANCE=REQUIRED`  
`IN_PLACE_V1_REWRITE=FORBIDDEN`

## 3. Snapshot purpose

An issued snapshot is immutable historical documentary truth. It must contain enough frozen authoritative information to:

1. explain what was issued and why;
2. reproduce the official artifact without consulting mutable live Finance/profile/config data;
3. reconcile the document with the authoritative economic facts that existed at issuance;
4. prove the policy/profile/configuration provenance used for the documentary decision; and
5. preserve correction history without rewriting the original.

Live identifiers are retained for navigation/provenance, but live records are never required to reinterpret the historical values already frozen in the snapshot.

## 4. Canonical V2 conceptual shape

The exact TypeScript representation may follow accepted repository naming conventions, but it must preserve the following semantics without loss.

```text
DocumentarySnapshotV2
  snapshotVersion = 2
  document
    type
    issuedAt
    currency
  issuer
  recipient
  beneficiary?
  billingParty?
  payer?
  operation
  obligations[]
    obligation identity/reference
    description/context
    components[]
      kind
      amount
      provenance
    financial state required by document policy
  payment?
    payment identity/reference
    confirmed state/time as applicable
    method/reference as policy permits
    amount
  allocations[]
    allocation identity/reference
    obligation identity/reference
    before
    movement
    after
  unallocated?
    amount
  totals
  tax
  jurisdiction
  legalMentions[]
  correction?
  policyProvenance
```

Optionality is controlled by document type and jurisdiction policy; optional does not mean browser-authored.

## 5. Parties

The snapshot distinguishes documentary roles instead of collapsing them into one person/entity when Finance truth or jurisdiction policy differentiates them:

- `issuer`: institution/legal issuer frozen at issuance;
- `recipient`: documentary recipient;
- `beneficiary`: person receiving the educational/service benefit when distinct;
- `billingParty`: party legally/contractually billed when distinct;
- `payer`: party associated with the confirmed payment when distinct.

The same real-world person/entity may occupy multiple roles, but role semantics remain explicit in V2.

## 6. Obligation and component truth

V2 freezes the documentary-relevant obligation state instead of storing only a loose operation reference.

Each obligation represented by the document must preserve its authoritative identifier/reference and the component breakdown needed to explain the value. Supported component semantics include, when actually present in authoritative Finance truth:

- base charge;
- discount;
- scholarship/benefit;
- penalty;
- interest;
- adjustment;
- other explicitly modeled authoritative components.

The snapshot must not invent a component merely to force a desired total.

### 6.1 Component provenance

Each frozen component carries minimum immutable provenance sufficient to identify its authoritative origin. Provenance may include source type, source identifier, source/version identifier, rule/policy identifier or equivalent repository-native reference.

`COMPONENT_WITHOUT_TRACEABLE_ORIGIN=FORBIDDEN` when the component is derived from a versioned/rule-backed Finance authority.

## 7. Payments, partial settlement and allocations

When a document represents payment/settlement consequences, V2 preserves the relationship between Payment and each affected Obligation through canonical `allocations[]`.

For every represented allocation, the snapshot freezes:

- `before`: relevant obligation/settlement position immediately before the movement;
- `movement`: exact amount applied by that allocation;
- `after`: resulting position immediately after that movement.

This is the canonical model for partial payment evidence.

A single confirmed Payment may therefore be represented against multiple obligations without flattening them into one synthetic obligation.

### 7.1 Unallocated value

If authoritative Payment truth contains value not allocated to an obligation at issuance time, V2 preserves it explicitly as unallocated value when relevant to the document type/policy.

The snapshot must not fabricate an allocation, obligation, discount, fee or other classification merely to eliminate an unallocated remainder.

## 8. Monetary reconciliation laws

All monetary values use the existing exact Finance Money/currency authority; binary floating-point arithmetic is forbidden for canonical calculations.

The V2 builder must fail closed if frozen values cannot be reconciled under the applicable document type and jurisdiction policy.

For payment-backed documents, where policy requires the complete payment movement to be represented:

`sum(allocation movement amounts) + unallocated amount = represented payment amount`

For each allocation:

`before - movement = after`

or the repository-equivalent signed convention, provided the convention is explicit, deterministic and tested. The implementation must not mix sign conventions within one snapshot contract.

Document totals must reconcile from authoritative frozen components according to the document type/policy. Rendering may format those totals; it may not recompute different economic truth.

## 9. Tax, jurisdiction and legal mentions

V2 has explicit `tax`, `jurisdiction` and `legalMentions` semantics.

- Jurisdiction is server-derived from the effective Financial Profile.
- Tax/document rules come from the selected versioned jurisdiction policy/adapter.
- Required legal mentions are frozen into the issued snapshot or referenced through immutable/versioned policy provenance in a way that permits deterministic historical rendering.
- Unsupported or incompletely evidenced jurisdiction behavior fails closed.
- Generic core code must not invent country-specific legal rules.

## 10. Policy provenance

`policyProvenance` freezes the versions/identities that governed issuance, including as applicable:

- effective Financial Profile version;
- jurisdiction adapter/policy version;
- fiscal configuration version;
- fiscal series identity/version;
- discount/adjustment/rule versions that materially affected frozen components;
- other policy authorities required to explain eligibility or mandatory documentary content.

Current policy must never be substituted later for the policy provenance of an already issued document.

## 11. Four validation boundaries

V2 validation is separated into four explicit layers. A pass in one layer never substitutes for another.

### 11.1 Structural validation

Proves schema/version shape, required fields, identifiers, Money/currency consistency, duplicate/ambiguous relationship rejection and internal before/movement/after coherence.

### 11.2 Financial reconciliation validation

Reconciles the frozen snapshot against authoritative Finance facts reloaded for issuance: obligation components, payment state, allocation movements, unallocated value and document totals as applicable.

### 11.3 Document-type validation

Proves the selected document type is eligible for the authoritative source state and that all type-required snapshot fields are present and coherent.

### 11.4 Jurisdiction validation

Delegates jurisdiction-specific required fields, tax/document rules, series constraints, legal mentions and correction eligibility to the versioned adapter/policy.

`STRUCTURAL_PASS != FINANCIAL_PASS != DOCUMENT_TYPE_PASS != JURISDICTION_PASS`

All required layers must pass before definitive numbering is consumed.

## 12. Issuance ordering and transaction boundary

Canonical ordering is:

`intent -> server institution/capability -> idempotency lookup -> effective profile/policy/config -> reload authoritative Finance sources -> build V2 candidate -> structural validation -> financial reconciliation -> document-type validation -> jurisdiction validation -> BEGIN/approved lock boundary -> allocate definitive number -> persist document + V2 snapshot + provenance + audit/outbox atomically -> COMMIT -> authoritative read`

The implementation may move repository reads/locks within the accepted concurrency model, but these laws do not change:

- no definitive number is consumed before all pre-number validations that can safely occur have passed;
- document, definitive number, snapshot, provenance, audit and required outbox authority commit atomically;
- a failed canonical transaction cannot leave a partially issued document;
- no external network call occurs while canonical Finance locks/transaction are held.

## 13. Idempotency and replay

After a command has successfully issued a document, replay of the same accepted idempotency identity returns the canonical already-issued result.

Replay must **not** rebuild the snapshot from current live facts, current profile, current fiscal config or current policy.

A retry with the same key but a mismatched canonical fingerprint follows existing Finance idempotency rejection semantics.

`IDEMPOTENT_REPLAY_REBUILDS_SNAPSHOT=NO`

## 14. Correction law

A correction is new documentary truth, not mutation of the original and not a byte-for-byte reuse of the original snapshot.

For a corrective issuance after V2 cutover:

1. load the original document as immutable historical reference;
2. resolve the current authoritative corrective fact/intent allowed by policy;
3. reload all Finance facts required for the correction;
4. build a **new V2 snapshot** describing the corrective document;
5. include first-class correction relationship/provenance to the original;
6. validate the new snapshot through the four validation boundaries;
7. issue the corrective document atomically with its own identity/number/snapshot/provenance.

The original V1 or V2 snapshot remains unchanged.

`CORRECTION_COPIES_ORIGINAL_SNAPSHOT_AS_NEW_TRUTH=FORBIDDEN`  
`CORRECTION_HAS_OWN_V2_SNAPSHOT=REQUIRED`

## 15. V1/V2 compatibility

Compatibility is explicit rather than implicit migration.

- Reader: supports V1 and V2.
- Renderer: dispatches by `snapshotVersion` and can reproduce historical V1 artifacts without consulting live mutable data.
- New issuer: writes V2 only after cutover.
- Corrective issuer: writes V2 only after cutover, even when correcting a V1 original.
- API/read model: exposes snapshot version so clients/renderers do not guess shape.
- Database: preserves old V1 JSON/document rows; additive schema changes are preferred.
- Migration/backfill: no automatic semantic upgrade of historical issued documents.

## 16. Required proof before implementation closure

At minimum, tests/evidence must prove:

1. new normal issuance persists V2 and never V1 after cutover;
2. V1 historical document still reads/renders unchanged;
3. V2 contains frozen parties, obligations/components and policy provenance required by its document type;
4. partial payment records correct `before -> movement -> after` values;
5. one payment across multiple obligations produces multiple canonical allocations without synthetic collapse;
6. unallocated value is preserved without invented classification;
7. monetary reconciliation failure blocks issuance before definitive number allocation;
8. structural failure blocks issuance before definitive number allocation;
9. document-type failure blocks issuance before definitive number allocation;
10. jurisdiction failure blocks issuance before definitive number allocation;
11. idempotent replay returns the original issued V2 snapshot even after live facts change;
12. correction of V1 creates a new V2 snapshot and leaves V1 unchanged;
13. correction of V2 creates a distinct V2 snapshot and leaves the original unchanged;
14. renderer for V2 uses only immutable snapshot/provenance for authoritative document values;
15. rollback leaves no partial document/snapshot/provenance/number authority;
16. restart preserves exact V2 identity and payload;
17. tenant isolation applies to all V2 source/provenance/correction references.

No `PASS` may be claimed from fixture shape, HTTP 200, PDF byte count or test name alone.

## 17. Implementation-gap classification

The existing V1 implementation is not classified as corrupt merely because it predates this contract. It is historical implementation truth.

Any current behavior that creates a new correction while simply reusing the original `documentary_snapshot` is incompatible with this V2 correction law and must be treated as a bounded implementation gap, not as authority to weaken the contract.

## 18. Canonical decision summary

`SNAPSHOT_AUTHORITY=IMMUTABLE_POSTGRESQL_DOCUMENTARY_TRUTH`  
`SNAPSHOT_V1=HISTORICAL_READ_COMPATIBILITY`  
`SNAPSHOT_V2=CANONICAL_NEW_WRITE_FORMAT`  
`SNAPSHOT_REQUIRES_LIVE_DATA_TO_RENDER=NO`  
`PARTIAL_PAYMENT_MODEL=BEFORE_MOVEMENT_AFTER`  
`MULTI_OBLIGATION_PAYMENT=ALLOCATIONS_ARRAY`  
`UNALLOCATED_VALUE_PRESERVED=YES`  
`INVENTED_CLASSIFICATION=FORBIDDEN`  
`COMPONENT_PROVENANCE=REQUIRED_WHEN_RULE_BACKED`  
`VALIDATION_BOUNDARIES=STRUCTURAL+FINANCIAL+DOCUMENT_TYPE+JURISDICTION`  
`VALIDATE_BEFORE_DEFINITIVE_NUMBER=REQUIRED`  
`IDEMPOTENT_REPLAY_REBUILDS_FROM_LIVE_DATA=NO`  
`CORRECTION_REWRITES_ORIGINAL=NO`  
`CORRECTION_REUSES_ORIGINAL_SNAPSHOT_AS_NEW_TRUTH=NO`  
`CORRECTION_NEW_V2_SNAPSHOT=REQUIRED`  
`RENDERER_SUPPORTS_V1_AND_V2=REQUIRED`  
`HISTORICAL_V1_BACKFILL=NOT_AUTOMATIC`
