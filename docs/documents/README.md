# Documents Foundation — Canonical Documentation Index

**Specification:** v1.0  
**Status:** APPROVED / FROZEN V1  
**Implementation authorization:** NO

## Authority order

1. `DOCUMENTS_FOUNDATION_MASTER_SPEC_V1.md` — top-level functional/architectural authority.
2. Auxiliary v1 specifications below — normative detail under the Master Specification.
3. Approved mission packs — incremental execution authority only after their own DoR and Product Owner approval.
4. Historical Documents planning/audit documents — evidence/context only where they do not conflict with v1.

If historical documentation conflicts with approved v1, v1 governs after merge. Historical evidence should be preserved and marked superseded/archived rather than silently rewritten.

## Canonical package

- `DOCUMENTS_FOUNDATION_MASTER_SPEC_V1.md`
- `DOCUMENTS_AUTHORITY_AND_BOUNDARIES_V1.md`
- `DOCUMENTS_CANONICAL_DATA_MODEL_V1.md`
- `DOCUMENTS_LIFECYCLES_AND_STATE_MACHINES_V1.md`
- `DOCUMENTS_SECURITY_PRIVACY_V1.md`
- `DOCUMENTS_STORAGE_UPLOAD_VERIFICATION_V1.md`
- `DOCUMENTS_GOVERNANCE_RETENTION_JURISDICTION_V1.md`
- `DOCUMENTS_INTEGRATION_EVENTS_CONTRACT_V1.md`
- `DOCUMENTS_UX_PRODUCT_SPEC_V1.md`
- `DOCUMENTS_ACCEPTANCE_TEST_ARCHITECTURE_V1.md`
- `DOCUMENTS_TAXONOMY_SCHEMA_GOVERNANCE_V1.md`
- `DOCUMENTS_IMPLEMENTATION_ROADMAP_V1.md`
- `DOCUMENTS_TRACEABILITY_RECONCILIATION_V1.md`

## Frozen governance

```text
DOCUMENTS_FOUNDATION_MASTER_SPEC_VERSION=1.0
BLOCKS_01_17=APPROVED
CONCEPTUAL_P0_OPEN=0
CONCEPTUAL_P1_OPEN=0
DOCUMENTATION_STATUS=APPROVED
SPECIFICATION_STATUS=FROZEN_V1
DOCUMENTATION_FIRST=SATISFIED
IMPLEMENTATION_AUTHORIZED=NO
ANTIGRAVITY_PRODUCTION_CODE_WRITE=BLOCKED
```

## Next gate

No production implementation is authorized by this package. Before I1 code:

1. confirm current `main` SHA;
2. audit actual PostgreSQL schema/migration baseline;
3. reconcile legacy Documents surfaces and PR #92;
4. create/reconcile I1 mission pack against v1;
5. pass I1 DoR with P0=0/P1=0;
6. obtain explicit Product Owner approval and `IMPLEMENTATION_AUTHORIZED=YES`.
