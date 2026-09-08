# Documents Foundation — Taxonomy & Schema Governance v1.0

**Status:** APPROVED / FROZEN V1  
**Implementation authorization:** NO

## 1. Initial canonical families

- `IDENTITY_ENROLLMENT`
- `ABSENCE_JUSTIFICATION`
- `ACADEMIC`
- `ADMINISTRATIVE_FINANCIAL`

Category is not subtype, sensitivity, business decision or process state.

## 2. Governed subtype model

A category may contain governed subtypes, for example identity document, residence proof, certificate, transcript or supporting evidence. The exhaustive catalogue is not frozen in Core v1 and must evolve through versioned governance.

Subtypes are controlled identifiers, not arbitrary frontend strings.

## 3. Sensitivity/classification

Sensitivity remains orthogonal to category and subtype. The final classification vocabulary may include tiers such as STANDARD, CONFIDENTIAL, HIGHLY_SENSITIVE and RESTRICTED, but concrete policy effects must be approved before use.

Filename does not determine classification.

## 4. Core metadata

A logical document must support canonical identity and context such as:

- document identifier;
- institution identifier;
- category;
- subtype/schema reference;
- classification;
- lifecycle facts;
- creation actor/time.

A version must support:

- version identifier;
- document identifier;
- immutable sequence;
- original filename where retained;
- declared and detected media type where applicable;
- size;
- integrity/hash facts;
- provenance reference;
- creation actor/time.

## 5. DocumentTypeSchema

Conceptual governed schema:

- schema_id
- category
- subtype
- version
- valid_from
- status
- field definitions
- validation rules

Schema status may be DRAFT, ACTIVE, DEPRECATED or RETIRED.

A historical document remains linked to the applicable schema/version. Activating v2 does not silently reinterpret v1 evidence.

## 6. Layered requirements

Effective metadata requirements may derive from:

`GLOBAL SCHEMA + JURISDICTION PROFILE + INSTITUTION POLICY + PROCESS REQUIREMENT`

Lower layers may add permitted constraints but may not weaken superior mandatory rules.

## 7. Extension policy

A generic ungoverned `metadata:any` is not a canonical authority surface. Extensible metadata must be namespaced/governed, validated, versioned and unable to override Core invariants.

Domain relationships such as invoice, attendance case or enrollment process must use explicit association contracts rather than hiding foreign identifiers in arbitrary JSON.

## 8. Provenance and audit separation

Metadata fields do not replace provenance or append-only audit evidence. `uploadedBy` or `lastEditedBy` in free-form metadata is insufficient.

## 9. Sensitive identifiers

Government/identity numbers and similarly sensitive values must not become URL IDs, object keys, log identifiers, correlation IDs or global search keys by convenience.

Any future search over sensitive metadata requires explicit authorization, institution scope, minimization and appropriate audit.

## 10. Validity vs retention

Document validity is separate from retention.

A document can be expired for new business use while still legally/operationally retained as historical evidence.

Where relevant, validity facts may include `valid_from` and `valid_until`; `created_at` is not automatically validity.

## 11. Issuer and authenticity

Issuer information may be governed metadata for relevant types. Presence of issuer metadata does not prove authenticity.

Digital signature/authenticity verification is a technical assessment/capability, not a boolean metadata field invented by the client.

## 12. DocumentRequirement

Conceptual process requirement:

- requirement_id
- requesting domain
- allowed category/subtypes
- required/optional
- quantity/cardinality
- validity rules
- version acceptance rules
- policy references

A requirement is not a document. A document may exist without satisfying a particular requirement; a requirement may exist before any document is supplied.

## 13. Geographic semantics

Document issuer country/jurisdiction may differ from institution operational jurisdiction. Origin geography alone does not decide retention, access or international-transfer policy.

## 14. Schema migration

Historical metadata migration must preserve source, be audited and idempotent, never invent missing facts and record transformations. Unknown historical values remain explicitly unknown/not available when allowed.

## 15. Authority invariant

Canonical semantics are derived from:

`DOCUMENT IDENTITY + TYPE SCHEMA + VERSION + PROVENANCE + CLASSIFICATION + ASSOCIATION/PURPOSE + GOVERNED POLICY`

Never from `filename + arbitrary JSON`.
