# Documents Foundation — Canonical Documentation Index

**Specification:** v1.0  
**Status:** APPROVED / FROZEN V1; I1–I8 IMPLEMENTATION INTEGRATED
**Implementation authorization:** Historical pre-I1 gate closed; no new Documents scope is authorized by this index.

## Current implementation truth

The v1 package remains the normative authority for Documents boundaries and
invariants. Its original "implementation authorization: NO" language was the
pre-I1 planning gate; it is historical context, not the current status.

- Documents Foundation I1–I8 is integrated: core model, associations, upload
  and verification, secure access, retention/deletion, events, API, and UI.
- Technical code/tests and PostgreSQL migrations are implementation evidence;
  they do **not** by themselves prove Human UAT or production operation.
- I8C GCP storage capability is implemented in the repository, but production
  credentials/bucket deployment evidence and Human UAT remain pending.
- Office/M365/SharePoint integration remains deferred.

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
I1_I8_IMPLEMENTATION=INTEGRATED
HUMAN_UAT=NOT_YET_EVIDENCED
PRODUCTION_OPERATIONAL=NOT_YET_EVIDENCED
NEW_DOCUMENTS_SCOPE=REQUIRES_EXPLICIT_AUTHORIZATION
```

## Next gate

No new Documents scope is authorized by this package. Before an I9 or other
new Documents mission, reconcile against the current canonical branch/schema,
confirm the legacy-surface boundary, establish the required operational/UAT
evidence, and obtain explicit Product Owner authorization. PR #92 remains
historical preparation evidence only and must not be treated as a live
implementation authorization.
