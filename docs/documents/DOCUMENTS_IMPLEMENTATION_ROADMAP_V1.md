# Documents Foundation — Implementation Roadmap v1.0

**Status:** APPROVED planning sequence  
**Implementation authorization:** NO

## Governance

The roadmap is incremental. Completion or approval of one mission does not authorize another. Every implementation mission must pass its own DoR and receive explicit Product Owner authorization.

Every mission pack declares IN_SCOPE, OUT_OF_SCOPE, OWNED_FILES, SHARED_FILES, FORBIDDEN_FILES, DEPENDENCIES, PRECONDITIONS, ACCEPTANCE and STOP_CONDITIONS.

## I0 — Documentation & Baseline Closure

Current phase. Deliverables:

- Master Specification v1.0;
- authority/boundary contract;
- conceptual data model;
- lifecycle/state machines;
- security/privacy;
- storage/upload/verification;
- governance/retention/jurisdiction;
- integration/events;
- UX;
- acceptance/test architecture;
- taxonomy/schema governance;
- traceability/reconciliation;
- factual repository/schema baseline audit.

No production code.

## I1 — Core Authority & Persistence

Candidate scope only after reconciliation and new DoR:

- institution-scoped Document identity;
- DocumentVersion identity/immutability;
- minimum provenance;
- opaque storage-reference metadata only;
- minimum idempotency/audit evidence;
- services/repositories;
- PostgreSQL constraints/tests including A->B negatives.

No binary upload, HTTP/UI, Finance/Enrollment mutation, malware, preview, deletion or provider integration.

The previous PR #92 mission pack is historical preparation evidence and is not current implementation authorization.

## I2 — Associations & Domain Contracts

- DocumentAssociation;
- version pinning;
- purpose;
- factual BusinessDecisionReference;
- initial explicit consumer contracts;
- idempotency/audit.

No automatic migration of Enrollment/Finance/Attendance/Academic authority.

## I3 — Storage & Upload Foundation

- object-storage abstraction;
- UploadSession;
- temporary upload authorization;
- direct upload architecture;
- server-side hash/integrity;
- governed size/type limits;
- resumable upload;
- orphan reconciliation;
- ingestion provenance.

Provider choice is mission-level infrastructure decision, not domain lock-in.

## I4 — Technical Verification & Quarantine

- real-type detection;
- integrity assessments;
- antimalware provider integration;
- verification pipeline;
- retry/inconclusive behavior;
- quarantine/release governance;
- escalation/observability.

No provider available means no false CLEAN assertion.

## I5 — Secure Content Access

- metadata/content action permissions;
- temporary open/download capability (target 5 minutes);
- revocation behavior;
- sensitive audit;
- enumeration protection;
- permission matrix applicable to exposed categories/actions.

## I6 — Retention, Holds & Deletion

- retention assignment/policy version;
- explicit retention clocks;
- holds;
- eligibility/authorization;
- definitive deletion;
- minimal deletion evidence;
- derived-copy cleanup;
- backup/restore interaction.

Requires approved applicable jurisdiction profiles; code must not invent legal periods.

## I7 — Events & Operational Integration

- canonical factual events;
- at-least-once delivery;
- idempotent consumers;
- retry/dead-letter/escalation;
- reliable commit/publication mechanism such as outbox or equivalent;
- observability;
- notification integration through canonical infrastructure.

## I8 — Product UX

- dossier/contextual views;
- upload progress;
- technical vs business state;
- versions/replacement;
- safe errors;
- queues;
- accessibility;
- localization/responsive behavior.

Only after backing contracts are stable; no fake capabilities.

## I9 — Domain Integrations

Separate missions, e.g.:

- DOCUMENTS-ENROLLMENT
- DOCUMENTS-ATTENDANCE
- DOCUMENTS-ACADEMIC
- DOCUMENTS-FINANCE

Each requires its own authority contract, migration/fence plan where needed and tests. Finance boundary is especially strict.

## I10 — Advanced Capabilities — DEFERRED

Examples:

- preview/rendering;
- Office/M365/SharePoint integration;
- OCR;
- redaction;
- digital signatures;
- external sharing;
- external imports;
- semantic indexing/embeddings;
- AI document processing.

These are not Core requirements and must not be smuggled into earlier missions.

## External dependencies

- canonical IAM / InstitutionalContext;
- PostgreSQL;
- object storage when I3 starts;
- antimalware capability when I4 starts;
- canonical event infrastructure when I7 starts;
- canonical notification infrastructure;
- approved governance/jurisdiction/privacy policy sources.

## STOP conditions

Stop and request formal decision if:

- implementation requires changing another domain's authority;
- Finance change appears outside an authorized Finance/Documents integration mission;
- approved data/security contract conflicts with actual schema;
- P0/P1 ambiguity remains;
- tenant isolation cannot be guaranteed;
- canonical IAM dependency is unavailable/inadequate;
- destructive migration is required but unplanned;
- material repository/spec mismatch appears;
- unapproved shared/global infrastructure must change;
- legal/policy interpretation is missing;
- a critical acceptance test cannot be performed without violating a boundary.

No incidental cleanup/refactor is authorization.
