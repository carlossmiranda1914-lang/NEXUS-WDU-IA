# Documents Foundation — Master Specification v1.0

**Status:** APPROVED / FROZEN V1  
**Authority:** Product Owner approved Blocks 01–17  
**Implementation authorization:** NO  
**Production code write:** BLOCKED until mission DoR + explicit Product Owner authorization  
**Baseline for documentation branch:** `main@02b7f0a454df922598b56660ce10216956539939`

## 1. Purpose

Documents Foundation is the canonical Nexus authority for document identity, immutable versions, provenance, technical state, storage references, retention metadata, technical history and document-domain audit evidence. It is not the authority for business meaning or decisions owned by Enrollment, Attendance, Finance, Academic or IAM.

A `Document` is a permanent logical entity. A file/binary is a representation/version of that document. Material content changes create a new immutable `DocumentVersion`; prior versions remain historically traceable while retention allows.

## 2. Authority boundaries

- Documents owns document identity, versions, provenance, technical verification state, opaque storage reference metadata, retention assignment, holds, deletion workflow, transfer evidence and document audit facts.
- Enrollment remains authority for enrollment process/document decisions and existing `enrollment_documents` business metadata until an explicit integration mission changes that contract.
- Attendance remains authority for absence-justification decisions.
- Finance remains absolute authority for financial truth, including obligations, payments, allocations, fiscal numbering, corrections and ledger facts.
- Academic remains authority for academic meaning and decisions.
- IAM / InstitutionalContext remains authority for identity, membership and access context. Documents must not create a parallel IAM path.

## 3. Core invariants

1. Document identity is separate from file content.
2. Version bytes are immutable.
3. Technical state is separate from business decision.
4. Knowing an ID, URL, filename, hash, external ID or storage reference never grants access.
5. Every sensitive read/write is institution-scoped and server-authorized.
6. Cross-tenant access fails closed and must not leak existence.
7. A storage reference is opaque and is never an authorization capability by itself.
8. New document versions do not automatically inherit prior business decisions.
9. Business decisions are owned by the competent domain and may be referenced factually by Documents.
10. Historical evidence is append-only where required; no destructive rewrite of provenance/audit facts.
11. Idempotent retries produce one canonical logical result.
12. Critical transitions require valid authority, guard conditions, persistence, audit evidence and controlled event publication.
13. Deletion and restore must never resurrect legally final deletion.
14. AI, OCR, preview, redaction, signatures, external sharing and M365 integration are not implicit Core capabilities.

## 4. Initial document families

- `IDENTITY_ENROLLMENT`
- `ABSENCE_JUSTIFICATION`
- `ACADEMIC`
- `ADMINISTRATIVE_FINANCIAL`

Category, subtype and sensitivity/classification are separate concepts. Subtypes and metadata schemas are governed and versioned.

## 5. Ingestion and file handling

Safe default formats include PDF, JPG/JPEG, PNG and modern Office formats without macros when category policy permits. Extension, filename and client-declared MIME are untrusted. Real type must be verified.

File-size policy hierarchy:

`GLOBAL_HARD_LIMIT -> INSTITUTION_LIMIT -> CATEGORY_LIMIT`

Lower layers may be stricter but never exceed global limits.

Future upload architecture supports direct temporary authorization, resumable sessions where eligible, retry/idempotency and server-side integrity verification. Upload authorization target: 15 minutes. Resumable session target: up to 24 hours within global policy bounds.

Explicit user cancel terminates the upload session; later retry requires a new upload session. Network interruption or pause may resume within a still-valid session.

## 6. Duplicate and replacement semantics

- Same process + same logical retry/operation: automatic idempotent deduplication.
- Same content + new legitimate intent: inform authorized user and require confirmation.
- Same hash in another process: never silently associate based on hash alone.
- Hash never authorizes access and deduplication must not leak cross-tenant existence.
- Replacement never overwrites prior content; it creates a new version.
- Prior versions remain historical while policy requires.

## 7. Technical verification

Canonical pipeline:

`RECEIVING -> RECEIVED -> VERIFYING -> AVAILABLE | QUARANTINED | TECHNICALLY_FAILED`

Before normal availability when policy requires, verify integrity/hash, size, real type, type compatibility, category policy and antimalware status where applicable.

Scanner unavailable does not mean clean. Required verification not completed means content is not available for normal consumption. Verification over 24 hours triggers alert/escalation but never auto-approval.

Quarantine is isolation, not deletion. A normal administrator cannot override malware or security outcomes. Any future manual release requires special security authorization, justification, review/new assessment and audit; some result classes may remain non-overridable.

## 8. Associations and business decisions

`DocumentAssociation` links a document/version to an authorized domain resource and purpose. It does not transfer authority.

A business decision may reference the exact version used. The same document can be accepted in one process and pending/rejected in another. No global `documents.approved` field is permitted.

Other domains access Documents through explicit contracts, not direct repository/table writes.

## 9. Multi-tenancy and authorization

Authorization is action-specific and server-side. Typical actions include metadata view, content open, download, upload, replace, withdraw, review, audit and administration.

Role alone is insufficient. Category, sensitivity, institutional policy, relationship and purpose may further restrict access.

Temporary content-access authorization target: 5 minutes. No permanent public URLs.

Repeated denied access can produce security events and risk-based blocking. Interinstitutional access is denied by default and requires an explicit audited contract.

## 10. Retention, jurisdiction and deletion

Policy hierarchy:

`Global Platform Policy -> Jurisdiction Profile -> Institutional Policy -> Category/Process Rule`

The platform must not hard-code a silent Portugal/Angola default. Jurisdiction profiles are versioned and governed. If applicable policies conflict materially or no valid profile exists where required, fail closed and require review.

Retention clocks begin from an explicit rule trigger, not automatically from upload time.

Canonical retention lifecycle:

`RETENTION_ACTIVE -> RETENTION_EXPIRED -> ELIGIBLE_FOR_DELETION -> DELETION_AUTHORIZED -> DELETED`

A valid hold blocks deletion. Definitive deletion removes recoverable content/references under system authority and leaves only minimal pseudonymized deletion evidence as policy permits. Backups are not an exception to legal deletion.

## 11. Transfer and restore

International/interinstitutional transfer requires explicit source/destination, purpose, category/sensitivity, jurisdiction and authorized legal/policy basis. Insufficient conditions deny the transfer.

Transfer creates a controlled copy/association and preserves provenance; it never silently changes source ownership or truth.

Restore cannot resurrect legally final deletion. Restored content returns through technical verification:

`RESTORED -> TECHNICAL_VERIFICATION -> AVAILABLE | QUARANTINED`

## 12. Audit and traceability

Separate concepts:

- Audit Evidence
- Operational Logs
- Security Events

Audit evidence is factual and append-only for critical operations. It must support reconstruction of WHO, INSTITUTION, WHAT, DOCUMENT, EXACT VERSION, ASSOCIATION/PURPOSE, WHEN, AUTHORITY, RESULT and CORRELATION.

Never log document content, credentials, tokens, signed URLs or secrets.

If mandatory audit evidence cannot be guaranteed for a critical operation, the operation fails closed rather than falsely reporting success.

## 13. Privacy and data protection

Privacy by design, minimization and purpose limitation are mandatory. Consent is not treated as the universal legal basis. Minor/guardian authority is resolved by the appropriate canonical relationship source, not Documents.

Administration does not imply unrestricted content access. AI, OCR, embeddings, semantic indexing and derived processing do not receive implicit access merely because the source document is stored.

Derived data inherits applicable privacy, authorization and retention constraints.

## 14. Canonical conceptual model

Core concepts:

- `Document`
- `DocumentVersion`
- `DocumentProvenance`
- `StorageObjectReference`
- `TechnicalAssessment`
- `DocumentAssociation`
- `BusinessDecisionReference`
- `IdempotencyRecord`
- `DocumentAuditEvent`
- `RetentionAssignment`
- `RetentionHold`
- `DeletionRecord`
- `DocumentTransfer`
- `UploadSession`
- governed `DocumentTypeSchema`
- governed `DocumentRequirement`

Physical table/column names are intentionally not frozen by this specification and must be reconciled against the actual PostgreSQL baseline before I1.

## 15. Service-contract principles

Commands mutate; queries read. Clients never directly set canonical states.

Every command/query derives trusted institution and actor context server-side. Retryable commands use institution + command scope + idempotency key + canonical fingerprint. Same key/same fingerprint replays the same canonical result; same key/different fingerprint fails closed.

HTTP is an adapter, not the domain. Other modules must not write Documents repositories/tables directly.

## 16. UX principles

The UI must separately communicate technical state and business decision. Upload 100% sent does not mean accepted. Quarantine messages are safe/generic. Rejection reason comes from the deciding domain.

Accessibility minimum includes keyboard operation, focus, screen-reader semantics, contrast, associated errors and no color-only status. Core flows must be responsive/mobile-capable. UI language follows user locale; persisted canonical timestamps remain normalized.

## 17. NFR and continuity

Critical integrity/security/isolation/auditability take precedence over apparent availability. Strong consistency is required for critical invariants; eventual consistency is allowed for projections, notifications, search, analytics and asynchronous integrations.

PostgreSQL is canonical metadata authority. Binary content belongs in object storage through a provider-neutral abstraction. RPO/RTO remain operational decisions that must be approved before production.

## 18. Acceptance and quality gate

Implementation evidence must include unit/domain tests, real PostgreSQL integration tests, cross-tenant A->B negatives, concurrency, idempotency, storage/event contract tests where applicable, security tests and migration tests.

Gate:

- `P0=0`
- `P1=0`
- all `P2` explicitly dispositioned

Documentation approval does not authorize code.

Implementation gate:

`DOCUMENTATION_STATUS=APPROVED + MISSION_DOR=PASS + PRODUCT_OWNER_APPROVAL=YES + IMPLEMENTATION_AUTHORIZED=YES`

Until then, production code writes remain blocked.

## 19. Mission decomposition

- `I0` Documentation & Baseline Closure
- `I1` Core Authority & Persistence
- `I2` Associations & Domain Contracts
- `I3` Storage & Upload Foundation
- `I4` Technical Verification & Quarantine
- `I5` Secure Content Access
- `I6` Retention, Holds & Deletion
- `I7` Events & Operational Integration
- `I8` Product UX
- `I9` Domain Integrations
- `I10` Advanced Capabilities (deferred)

Each mission must explicitly declare IN_SCOPE, OUT_OF_SCOPE, OWNED_FILES, SHARED_FILES, FORBIDDEN_FILES, DEPENDENCIES, PRECONDITIONS, ACCEPTANCE and STOP_CONDITIONS.

## 20. Deferred decisions that do not block Core documentation freeze

The following are deliberately deferred to the appropriate mission/production gate:

- concrete global file-size value;
- RPO/RTO values;
- object-storage provider;
- antimalware provider;
- full subtype catalogue;
- complete role x action x category matrix before relevant content exposure;
- concrete jurisdiction retention profiles before automated retention/deletion;
- advanced capabilities listed in I10.

## 21. Supersession and change control

This v1.0 specification supersedes conflicting historical Documents planning decisions once merged. Historical documents are preserved and should be marked superseded/archived rather than silently rewritten.

Material changes require a versioned change request, impact analysis, approval and specification update.

## 22. Current governance state

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

The next mandatory activity is factual reconciliation against current `main`, actual PostgreSQL schema, legacy document surfaces and PR #92 before any I1 implementation authorization.
