# Documents Foundation — Canonical Data Model v1.0

**Status:** APPROVED conceptual model  
**Physical PostgreSQL names:** NOT YET AUTHORIZED

## Core graph

```text
Institution
  -> Document
      -> DocumentVersion
          -> DocumentProvenance
          -> StorageObjectReference
          -> TechnicalAssessment
      -> DocumentAssociation
          -> BusinessDecisionReference

Cross-cutting:
InstitutionalContext / Authorization / Idempotency / Audit / Retention / Jurisdiction
```

## Document

Permanent logical documentary identity. Minimum semantics: institution, category, subtype/classification as applicable, lifecycle and creation facts.

Forbidden semantics: binary payload, global accepted flag, financial truth or business-domain decision.

Institution ownership is immutable; transfer is a separate operation.

## DocumentVersion

Immutable material representation of a Document. Version sequence is unique per document and must be concurrency-safe through database constraints/transactions, never an unprotected `MAX+1` convention.

A new material representation creates a new version. Historical versions remain immutable while retained.

## DocumentProvenance

Append-only provenance facts including origin type, actor/service, domain/source, method, time and correlation. Supported conceptual origins include USER_UPLOAD, SYSTEM_GENERATED, DOMAIN_GENERATED, IMPORT, EXTERNAL_INTEGRATION and formally classified LEGACY_MIGRATION.

Unknown provenance is permitted only for formally classified legacy migration where the historical fact is genuinely unavailable.

## StorageObjectReference

Opaque provider-neutral reference associated with a version/technical representation. May include size/hash and technical metadata. It is never a public URL and never an authorization decision.

A version may have multiple technical representations (for example future derived preview) without those derived bytes automatically becoming a new canonical document version.

## TechnicalAssessment

Append-only technical evidence for a version/representation. Assessment types may include integrity, real file type, malware, signature and future validators. Stores mechanism/version, factual result, time and bounded evidence. Reassessment does not rewrite prior assessment and does not create a new DocumentVersion when source bytes are unchanged.

## DocumentAssociation

Explicit link between institution, document, optional pinned version, target domain/resource, purpose, lifecycle, creator and time. Domain-specific foreign columns must not proliferate in Documents Core.

An association may initially target the logical Document; any business decision evidence that depends on content must prove the exact version used.

## BusinessDecisionReference

Factual reference to a decision owned by another bounded context. It must not copy that domain's decision engine or become a global Documents approval state.

## IdempotencyRecord

Conceptual key: `(institution, command_scope, idempotency_key)` with canonical fingerprint, result/state and timestamps. Same key + same fingerprint replays the canonical result. Same key + different fingerprint fails closed.

## DocumentAuditEvent

Append-only minimal factual evidence for sensitive operations. No document binary, credentials, signed URLs or unnecessary PII.

## RetentionAssignment

Captures scope, policy reference/version, jurisdiction basis, trigger, calculated dates and state. A naked unexplained `delete_at` is insufficient as the complete retention model.

## RetentionHold

Captures scope, authority, reason, effective/release facts and audit correlation. An active valid hold blocks deletion.

## DeletionRecord

Minimal pseudonymized technical evidence of completed deletion. It must not preserve recoverable document content.

## DocumentTransfer

Explicit controlled transfer/copy operation preserving provenance. Transfer never changes the source Document institution to simulate ownership movement.

## UploadSession

Temporary operational object for authorized/resumable upload. An abandoned or failed upload session does not have to create a canonical Document/Version.

## DocumentTypeSchema

Governed/versioned schema for category/subtype metadata and validation rules. Conceptual status: DRAFT, ACTIVE, DEPRECATED, RETIRED. Historical documents preserve the applicable schema version.

## DocumentRequirement

Process requirement describing what evidence a requesting domain accepts/requires. It is separate from the document delivered and does not make Documents the business authority.

## Structural invariants

- Institution-scoped relationships must be structurally enforced where feasible.
- Cross-tenant relationships must be impossible or fail closed.
- Opaque IDs contain no sensitive semantics.
- No generic destructive CRUD for historical entities.
- Important concurrency uses constraints/transactions.
- Critical timestamps are server-derived/validated.
- External references never prove existence or authorization.
- Physical cross-domain FKs are used only where ownership/lifecycle justify them; bounded contexts may use stable references/contracts instead.
- Governed extension metadata is allowed only through versioned schemas/namespaces; arbitrary JSON must not become an escape hatch around canonical fields, associations, provenance or audit.
