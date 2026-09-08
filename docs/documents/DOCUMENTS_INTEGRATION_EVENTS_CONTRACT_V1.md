# Documents Foundation — Integration, Commands, Queries & Events v1.0

**Status:** APPROVED

## Boundary

```text
External adapter/domain
 -> Documents Application Contract
 -> Authorization + Domain Rules
 -> Documents persistence
 -> Audit / reliable event publication
```

HTTP is an adapter. Repositories and tables are not public cross-domain APIs.

## Commands vs queries

Commands request a semantic state change. Queries read an authorized projection. Clients never send arbitrary canonical statuses or generic destructive patches.

Representative commands include CreateDocument, RegisterDocumentVersion, CreateAssociation, PinAssociationToVersion, WithdrawAssociation, RequestDeletion, ApplyRetentionHold and ReleaseRetentionHold. Exact code/API names are not frozen here.

Representative queries include GetDocument, GetDocumentVersion, ListDocumentVersions, ListAssociations and authorized audit/technical-state views.

## Trusted context

Every command/query derives trusted `InstitutionalContext` and actor/service context server-side. A tenant identifier supplied by a client never overrides the server-resolved institution.

## Idempotency

Retryable command identity uses:

`institution + command scope + idempotency key + canonical fingerprint`

- same key + same fingerprint -> same canonical logical result;
- same key + different fingerprint -> `IDEMPOTENCY_CONFLICT`, no mutation.

Fingerprinting is deterministic over semantic intent, not raw JSON property order.

## Queries and projections

Queries are authorization-protected and return only fields allowed for that actor/purpose. Storage locators, sensitive assessment details and restricted policy metadata are not automatically exposed.

Large mutable collections should prefer stable cursor pagination. Ordering is explicit; arbitrary SQL-like client filters are forbidden.

Search is a separate future capability, not an unbounded `ListDocuments` escape hatch.

## Content access

Content open/download uses a protected Documents operation that can issue a short-lived provider-neutral `ContentAccessGrant`. Provider-specific URLs remain adapter details.

## Association and business decision

Associations are explicit. Business domains do not call a generic `ApproveDocument`/`RejectDocument` authority in Documents. The competent domain decides; Documents may preserve a factual `BusinessDecisionReference` and exact version used.

## Events

Canonical factual event families may include:

- DocumentCreated
- DocumentVersionCreated
- DocumentTechnicalStateChanged
- DocumentAvailable
- DocumentQuarantined
- DocumentAssociated
- DocumentAssociationChanged
- DocumentRetentionChanged
- DocumentDeleted

Names must describe facts and must not imply a business decision Documents does not own.

Delivery semantics are at-least-once with stable event identity and idempotent consumers. Critical ordering uses explicit sequence/version where needed. Failed delivery follows retry then dead-letter/escalation policy.

Events representing persisted facts are published only after/with reliable canonical commit semantics (for example an outbox-equivalent mechanism); technology is not frozen here.

## Error contract

Canonical taxonomy includes VALIDATION, AUTHENTICATION, AUTHORIZATION, NOT_FOUND_OR_UNAVAILABLE, CONFLICT, IDEMPOTENCY_CONFLICT, POLICY_DENIED, QUARANTINED, DEPENDENCY_UNAVAILABLE, RATE_LIMITED, INTEGRITY_FAILURE and INTERNAL.

External projection must be safe and may intentionally make cross-tenant-owned and nonexistent identifiers indistinguishable.

## Side effects and correlation

Commands declare expected side effects. Correlation propagates across originating domain, Documents operation, persistence, audit and events. Correlation is traceability, never authorization.

## Capability readiness

No public command/endpoint may return success for an unimplemented capability. No-op success and simulated security/storage verification are forbidden.
