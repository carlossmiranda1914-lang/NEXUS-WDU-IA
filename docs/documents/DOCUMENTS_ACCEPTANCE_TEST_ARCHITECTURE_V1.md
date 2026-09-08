# Documents Foundation — Acceptance & Test Architecture v1.0

**Status:** APPROVED / FROZEN V1  
**Implementation authorization:** NO

## 1. Quality principle

A Documents capability is not DONE because the happy path works. It is DONE only when its authority, tenancy, idempotency, concurrency, failure behavior and evidence requirements are proven.

Requirement traceability follows:

`REQUIREMENT -> ACCEPTANCE CRITERION -> TEST -> EVIDENCE -> GATE`

## 2. Canonical error categories

At minimum:

- VALIDATION
- AUTHENTICATION
- AUTHORIZATION
- NOT_FOUND_OR_UNAVAILABLE
- CONFLICT
- IDEMPOTENCY_CONFLICT
- POLICY_DENIED
- QUARANTINED
- DEPENDENCY_UNAVAILABLE
- RATE_LIMITED
- INTEGRITY_FAILURE
- INTERNAL

External errors must not expose storage paths, SQL, stack traces, secrets, malware signatures or cross-tenant existence.

## 3. Mandatory multi-tenant matrix

For every sensitive operation, test at least:

- A owns resource + A authorized -> ALLOW
- A owns resource + A unauthorized -> DENY
- B requests A resource -> DENY, non-disclosing
- unknown/non-member context -> DENY
- manipulated/malformed identifier -> DENY or safe error

This applies progressively to metadata, versions, associations, open/download, replace, withdraw, audit, retention, transfer and deletion.

## 4. Mandatory edge cases

- response lost after persistence then retry -> one canonical logical result;
- same idempotency key + different fingerprint -> fail closed;
- concurrent version creation -> no duplicate canonical sequence;
- revocation during session -> new action denied according to current authority;
- object missing while metadata exists -> controlled incident/state, never false AVAILABLE;
- orphan object -> reconciliation, never invented document authority;
- scanner unavailable -> pending/inconclusive, never clean;
- malware confirmed -> quarantine;
- MIME/extension/content mismatch -> quarantine/controlled failure;
- verification exceeds operational target -> escalation, no auto-approval;
- duplicate event delivery -> one logical consumer effect;
- out-of-order event -> no silent regression;
- hold + deletion request -> deletion blocked while hold valid;
- final deletion + restore -> content not resurrected;
- V2 after V1 business decision -> no automatic decision inheritance;
- disassociation -> no automatic document deletion;
- same hash across tenants -> no existence leak;
- absent/conflicting jurisdiction policy -> block/review.

## 5. Test layers

Required according to mission scope:

1. Unit tests for deterministic rules.
2. Domain/application service tests for commands, state guards and idempotency.
3. Real PostgreSQL integration tests for constraints, transactions, tenancy and concurrency.
4. Storage contract/integration tests when storage enters scope.
5. Event producer/consumer contract tests when events enter scope.
6. Security tests for authorization, BOLA/IDOR, enumeration and temporary grants.
7. End-to-end tests once HTTP/UI exist.
8. Migration tests from representative baseline, not only empty DB.
9. Restore/DR tests according to operational policy.

## 6. Concurrency proofs

At minimum where applicable:

- version race;
- idempotency race;
- delete/access race;
- retention/hold race;
- association race.

No critical state may rely on silent last-write-wins.

## 7. Security proofs

Test:

- IDOR/BOLA;
- enumeration resistance;
- expiry of temporary content-access grants;
- immediate revocation behavior;
- cross-tenant storage access denial;
- filename/MIME manipulation;
- oversized upload;
- safe malware test artefacts appropriate to the scanner contract;
- logs free of secrets/tokens/reusable grants/content;
- permission matrix by action, not only role.

## 8. Acceptance criterion format

Every mission criterion should use:

```
GIVEN
WHEN
THEN
EVIDENCE
```

Example:

```
GIVEN Institution A owns Document D
AND actor belongs only to Institution B
WHEN actor requests D
THEN access is denied
AND no metadata from D is disclosed
AND no storage capability is returned
EVIDENCE: automated PostgreSQL/service integration test
```

## 9. Severity gate

- P0: absolute blocker (e.g. cross-tenant disclosure, authority corruption, critical authorization bypass).
- P1: blocks capability implementation/release.
- P2: requires explicit disposition.
- P3: non-blocking improvement only if no higher requirement is undermined.

Required gate:

`P0_OPEN=0`
`P1_OPEN=0`
`P2_OPEN=EXPLICITLY_DISPOSITIONED`

## 10. Definition of Ready

No implementation mission is authorized without:

- SCOPE_DEFINED=YES
- AUTHORITY_DEFINED=YES
- OWNED_FILES_DEFINED=YES
- FORBIDDEN_FILES_DEFINED=YES
- DEPENDENCIES_IDENTIFIED=YES
- DATA_CONTRACT_DEFINED=YES
- SECURITY_INVARIANTS_DEFINED=YES
- TEST_MATRIX_DEFINED=YES
- ACCEPTANCE_CRITERIA_DEFINED=YES
- OPEN_P0=0
- OPEN_P1=0
- BASELINE_CONFIRMED=YES
- PRODUCT_OWNER_APPROVAL=YES
- IMPLEMENTATION_AUTHORIZED=YES

## 11. Definition of Done

Within mission scope:

`IMPLEMENTATION_COMPLETE + REQUIRED_TESTS_PASS + SECURITY_NEGATIVES_PASS + MIGRATIONS_VALIDATED + NO_FORBIDDEN_SCOPE_CHANGE + DOCUMENTATION_UPDATED + EVIDENCE_RECORDED + P0=0 + P1=0 + P2_DISPOSITIONED + REVIEW_COMPLETE`

## 12. Evidence rules

Critical evidence must be reproducible and identify relevant baseline/environment/command/result. Test data must be synthetic or anonymized. Tests must never introduce production bypasses. A failing invariant is fixed in behavior, not hidden by weakening the test.
