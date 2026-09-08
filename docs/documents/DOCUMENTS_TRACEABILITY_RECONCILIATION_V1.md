# Documents Foundation — Traceability & Baseline Reconciliation v1.0

**Status:** DOCUMENTATION PACKAGE COMPLETE; REPOSITORY/SCHEMA RECONCILIATION GATE REMAINS BEFORE I1 CODE  
**Documentation baseline:** `main@02b7f0a454df922598b56660ce10216956539939`  
**Implementation authorization:** NO

## 1. Purpose

This document maps the approved specification to canonical documents, implementation missions and proof requirements, and records the known AS-IS conflicts that must be reconciled before I1 authorization.

Classification:

- ALIGNED — current evidence is compatible with v1.
- PARTIAL — some required capability exists but does not satisfy the complete v1 contract.
- CONFLICT — current/old documentation or implementation claims incompatible authority/state.
- LEGACY — intentionally preserved transitional/prototype surface; not canonical Documents authority.
- MISSING — required future capability not yet implemented.

## 2. Requirement traceability

| Area | Canonical specification | Primary future mission | Mandatory proof |
|---|---|---|---|
| document identity/version/provenance | Master + Data Model | I1 | PostgreSQL constraints, immutability, tenancy |
| authority boundaries | Authority & Boundaries | I1/I2/I9 | no cross-domain writes; contract tests |
| association/version pinning | Data Model + Integration | I2 | exact-version decision evidence; tenant checks |
| storage/upload | Storage/Upload/Verification | I3 | storage contract, hash, size/type, idempotency |
| verification/quarantine | Storage/Upload/Verification + Lifecycle | I4 | scanner/type/integrity failure paths |
| secure content access | Security & Privacy | I5 | permission matrix, expiry, revocation, IDOR/BOLA |
| retention/hold/deletion | Governance/Retention/Jurisdiction | I6 | policy/hold/deletion/backup negative tests |
| events/idempotent consumers | Integration & Events | I7 | duplicate/out-of-order/retry/dead-letter tests |
| product UX | UX & Product | I8 | E2E, accessibility, no false-success tests |
| Enrollment integration | Authority + I9 contract | I9 | preserve Enrollment decision authority |
| Attendance integration | Authority + I9 contract | I9 | decision owned by Attendance |
| Academic integration | Authority + I9 contract | I9 | academic meaning remains Academic |
| Finance integration | Authority + I9 contract | I9 | zero financial truth mutation by Documents |
| taxonomy/schema | Taxonomy & Schema Governance | I1+incremental | version compatibility/validation tests |
| privacy/derived processing | Security & Privacy | mission-specific | authorization/purpose/retention proofs |

## 3. Known AS-IS baseline

The repository authority audit at the documentation baseline records:

- `enrollment_documents` path as CANONICAL/PRESERVE for Enrollment document process metadata/decision authority; it is metadata-oriented and is not the general physical Documents store.
- generic `uploaded_documents` routes as TRANSITIONAL/PRESERVE-with-no-new-consumers until a real general Documents authority/storage command exists.
- AI document generation into `uploaded_documents` as TRANSITIONAL and not proof of physical storage, MIME/hash verification or human/business authorization.
- browser/localStorage document surfaces as PROTOTYPE/REPLACE-LATER.
- Google Sheets browser writes as external/prototype integration, not Nexus Documents authority.

These surfaces must not be opportunistically removed or reclassified during I1.

## 4. PR #92 reconciliation

PR #92 (`docs/documents): authorize isolated I1 preparation`) is open historical preparation evidence. Its diff contains contradictory governance facts:

- baseline/shared-file documents explicitly state `IMPLEMENTATION_AUTHORIZED=NO`;
- engineering config/mission pack sections state `implementation_authorized: true` / `IMPLEMENTATION_AUTHORIZED=YES`.

The Product Owner subsequently approved documentation-first governance and Master Specification v1.0 with implementation blocked.

Therefore:

```text
PR_92_AS_CURRENT_IMPLEMENTATION_GATE=INVALID
PR_92_MAY_BE_USED_AS_HISTORICAL_PREPARATION_EVIDENCE=YES
IMPLEMENTATION_AUTHORIZED=NO
```

PR #92 must not be merged unchanged as an implementation authorization. A future I1 mission pack must be reconciled to this v1.0 specification and the then-current main/schema baseline.

## 5. Current classification against v1 target

| Surface/capability | Classification | Required treatment |
|---|---|---|
| canonical Enrollment document process | ALIGNED boundary / PARTIAL Documents capability | preserve; integrate only under I9 contract |
| generic `uploaded_documents` | LEGACY / PARTIAL | preserve with no new consumers; replace only after canonical capability exists |
| AI direct document generation | LEGACY / CONFLICT with future authority | no expansion; later delegate to authorized command |
| browser/localStorage docs | LEGACY | must not claim durable canonical submission |
| Documents Core authority entities | MISSING at baseline | I1 after DoR/authorization |
| DocumentAssociation | MISSING | I2 |
| object storage authority | MISSING | I3 |
| technical verification/quarantine | MISSING | I4 |
| secure content access grants | MISSING | I5 |
| governed retention/deletion engine | MISSING | I6 |
| canonical Documents event integration | MISSING | I7 |
| canonical Documents UX | MISSING | I8 |

## 6. Mandatory schema audit before I1

Before production code, executor must inspect the actual PostgreSQL migration/schema baseline and prove:

- no existing canonical tables already own the proposed I1 concepts under different names;
- next migration number is derived from current execution baseline, never guessed from this document;
- constraints/foreign-key strategy are compatible with current institution/identity schema;
- no `uploaded_documents` or `enrollment_documents` destructive migration is required for I1;
- no shared migration runner/schema mechanism must be modified without explicit authorization;
- real PostgreSQL A->B and concurrency tests are feasible.

If any item fails, STOP and reconcile the I1 data contract before code.

## 7. I1 readiness status after documentation freeze

```text
MASTER_SPEC_APPROVED=YES
AUXILIARY_SPECS_COMPLETE=YES
TRACEABILITY_DEFINED=YES
KNOWN_LEGACY_SURFACES_CLASSIFIED=YES
PR_92_CONFLICT_IDENTIFIED=YES
CURRENT_EXECUTION_BASELINE_RECONFIRMATION_REQUIRED=YES
CURRENT_POSTGRES_SCHEMA_AUDIT_REQUIRED=YES
I1_OWNED_SHARED_FORBIDDEN_RECONFIRMATION_REQUIRED=YES
I1_ACCEPTANCE_MATRIX_RECONFIRMATION_REQUIRED=YES
PRODUCT_OWNER_I1_CODE_APPROVAL_REQUIRED=YES
IMPLEMENTATION_AUTHORIZED=NO
```

## 8. Final gate

Documentation closure authorizes factual read/audit/reconciliation work only. The next correct sequence is:

`CURRENT MAIN AUDIT -> CURRENT POSTGRES SCHEMA AUDIT -> I1 DELTA/FILE MATRIX -> I1 DoR -> PRODUCT OWNER APPROVAL -> IMPLEMENTATION_AUTHORIZED=YES -> CODE`
