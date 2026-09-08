# Documents Foundation — Governance, Retention & Jurisdiction v1.0

**Status:** APPROVED

## Policy hierarchy

`Global Platform Policy -> Jurisdiction Profile -> Institutional Policy -> Category/Process Rule`

A lower layer may be stricter where legally/policy permitted but must not silently weaken a superior obligation.

## Jurisdiction

Every institution must have a valid operational jurisdiction context where required. Nexus must not silently default to Portugal, Angola or another country. Profiles are versioned, have effective dates/history and are governed configuration rather than legal rules hard-coded into application logic.

For multiple jurisdictions:

- compatible obligations accumulate;
- material conflict fails closed and requires compliance review;
- missing required profile blocks the affected operation.

Changing institutional jurisdiction does not silently rewrite the historical corpus. Policy changes identify affected documents/work and preserve the applicable historical policy version.

## Retention

Retention is determined by category, purpose, jurisdiction and institutional/process policy within platform limits. The clock trigger is explicit per rule and is not universally `uploaded_at`.

Lifecycle:

`RETENTION_ACTIVE -> RETENTION_EXPIRED -> ELIGIBLE_FOR_DELETION -> DELETION_AUTHORIZED -> DELETED`

Expiration alone does not destroy content.

## Holds

Legal/administrative hold is explicit and records scope, basis/authority, reason, effective time, release and audit. Informal indefinite blocking is forbidden. A valid active hold blocks deletion.

## Deletion

Definitive deletion removes content and recoverable references/copies under Documents authority, including applicable derived previews/OCR/index/cache. Minimal pseudonymized evidence may remain: time, policy/basis, operation and appropriate non-content identifier.

Audit/log/cache/backup mechanisms must not become a hidden recoverable copy of legally deleted content.

## Backup and restore

Backups obey approved retention and security requirements. Backup retention is not a permanent exception to deletion obligations.

Restore may be requested by an authorized institutional administrator; sensitive restore follows security/governance authorization and audit. Restored content re-enters technical verification. Legally final deletion is never resurrected.

Restore testing objective is initially monthly, subject to final infrastructure/DR policy. Concrete RPO/RTO must be approved before production.

## International/interinstitutional transfer

Transfer evaluates source, destination, purpose, category/sensitivity, jurisdiction compatibility and authorized legal/policy basis. Insufficient conditions deny or require review.

Transfer preserves provenance and creates a controlled copy/association. It never silently updates source institution ownership or creates a second untraceable truth.

## Deferred operational inputs

Before automated retention/deletion enters production, the applicable jurisdiction profiles and concrete retention periods must be formally approved. Developers must not invent legal periods.
