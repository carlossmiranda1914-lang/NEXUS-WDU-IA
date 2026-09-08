# Documents Foundation — Storage, Upload & Verification v1.0

**Status:** APPROVED architectural contract

## Storage

Canonical metadata belongs in PostgreSQL. Binary content belongs outside PostgreSQL in object storage through a provider-neutral adapter. Provider locators are opaque internal references and never authorization capabilities.

The system must explicitly reconcile database facts and storage facts, including safe handling of orphan objects and missing objects. Metadata saying AVAILABLE while the object is missing is a controlled integrity incident, not success.

## Upload authorization

Future direct upload uses temporary authorization; target validity is 15 minutes. Resumable upload may remain valid up to 24 hours within global policy. These are policy targets, not permanent provider-specific assumptions.

Upload completion does not imply trust or business acceptance.

Explicit user cancel terminates the session. Network interruption/pause may resume only while the session remains valid.

## Size policy

`GLOBAL_HARD_LIMIT -> INSTITUTION_LIMIT -> CATEGORY_LIMIT`

Institution/category may be stricter; neither may exceed global bounds. Concrete values are operational configuration to be approved before I3 production use.

## Format policy

Default safe candidates: PDF, JPG/JPEG, PNG and modern Office formats without macros when category policy permits. Macro-bearing files are forbidden by default. A future administrative storage/download-only exception requires explicit policy and must never execute macros server-side.

Never trust filename extension, client Content-Type or display name. Detect real type. Significant mismatch moves the content to quarantine/safe review.

## Integrity

Hash is calculated/confirmed server-side after content receipt. Client hash may assist but is not canonical trust. Hash supports integrity/deduplication; it is never authorization.

Deduplication must not leak cross-tenant existence or timing information.

## Verification pipeline

```text
RECEIVING -> RECEIVED -> VERIFYING -> AVAILABLE
                              \-> QUARANTINED
                              \-> TECHNICALLY_FAILED / SAFE REVIEW
```

Required checks may include:

- integrity/hash;
- size limits;
- real media type;
- extension/type compatibility;
- category policy;
- malware scan;
- future signature/PDF/DLP validators.

Scanner unavailable or inconclusive is never CLEAN. Retry is idempotent and does not create a new DocumentVersion. Target maximum verification window is 24 hours; overdue work alerts/escalates but never auto-approves.

## Technical assessments

Every factual assessment records mechanism/type, mechanism version where relevant, result, timestamp and bounded evidence/correlation. Reprocessing after security-policy/mechanism changes creates new assessment evidence, not a new content version when bytes are unchanged.

## Quarantine

Quarantine isolates content while preserving retention, audit and security obligations. Normal preview/download/operational consumption is blocked. User-facing messages are generic and actionable without exposing detection internals.

## Availability invariant

When technical verification is required but incomplete, content is not available for normal consumption. Metadata/state may remain visible to authorized actors so they can track progress.
