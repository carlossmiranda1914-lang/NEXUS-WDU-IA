# Documents Foundation — Lifecycles & State Machines v1.0

**Status:** APPROVED semantic contract  
**Note:** exact physical enum identifiers may be normalized during schema design, but semantic separation and forbidden transitions are frozen.

## General transition rule

```text
COMMAND
 -> AUTHENTICATE / RESOLVE INSTITUTION
 -> AUTHORIZE
 -> VALIDATE
 -> GUARD CONDITIONS
 -> CANONICAL TRANSITION
 -> PERSIST
 -> AUDIT
 -> DOMAIN EVENT WHEN APPLICABLE
```

Clients request actions; they never set canonical status directly.

## Document lifecycle

Document lifecycle is intentionally minimal and separate from version technical state, business decision and retention state.

Conceptual states may represent ACTIVE, security/governance suspension/restriction, deletion pending and DELETED. Physical modeling must avoid duplicating retention state into a second conflicting authority.

`DELETED` is terminal for recoverable content under Documents authority.

## DocumentVersion ingestion/technical lifecycle

```text
REGISTERED
 -> CONTENT_PENDING
 -> CONTENT_RECEIVED
 -> UNDER_VERIFICATION
 -> AVAILABLE
```

Safe branches include `QUARANTINED` and `TECHNICALLY_FAILED`; a historically superseded version may be represented as non-current/retired without destroying it.

Forbidden:

- required verification bypassed by `CONTENT_RECEIVED -> AVAILABLE`;
- `QUARANTINED -> AVAILABLE` without authorized re-evaluation/release path;
- `DELETED -> AVAILABLE`.

## UploadSession

```text
CREATED -> AUTHORIZED -> UPLOADING -> COMPLETED
                         -> PAUSED -> UPLOADING
```

Terminal/safe alternatives: EXPIRED, CANCELLED, FAILED.

`COMPLETED` means transfer completed, not technical trust or business acceptance. Explicit user cancellation terminates that session. Network interruption/pause may resume only while session authorization/policy remains valid.

## TechnicalAssessment

Assessment execution states conceptually include PENDING, RUNNING, PASSED, FAILED, INCONCLUSIVE and RETRY_SCHEDULED. Multiple assessments can coexist by mechanism/type. Current technical availability is derived/materialized consistently from required factual assessments and policy.

## Quarantine

Conceptual lifecycle:

`QUARANTINED -> UNDER_REVIEW -> RELEASED | REJECTED | DELETION_REQUIRED`

Release requires appropriate security authority, reason, audit and sufficient assessment evidence. Business roles cannot bypass technical security.

## DocumentAssociation

Association lifecycle is independent of business-domain decision. It may include proposed/active/review linkage, superseded, withdrawn/disassociated and closed semantics as needed by the final physical model.

Business acceptance/rejection is not owned by Documents. If projected, it must be explicitly identified as a factual external-domain decision reference, including exact version where the decision depends on content.

New versions never inherit acceptance automatically.

## Retention

Frozen semantic lifecycle:

`RETENTION_ACTIVE -> RETENTION_EXPIRED -> ELIGIBLE_FOR_DELETION -> DELETION_AUTHORIZED -> DELETED`

A valid hold is orthogonal and blocks authorization/execution of deletion.

## RetentionHold

Conceptual states: ACTIVE, RELEASED, EXPIRED, CANCELLED. Authority/reason/effective/release facts are preserved.

## Deletion workflow

```text
REQUESTED -> POLICY_EVALUATION -> APPROVED -> EXECUTING -> EXECUTED
                            \-> BLOCKED
```

FAILED is a controlled operational outcome. A request is not proof of a right to deletion. EXECUTED requires applicable content/derived-copy/reference cleanup and cannot be undone by restore.

## Transfer workflow

```text
REQUESTED -> POLICY_EVALUATION -> APPROVED -> EXECUTING/COPYING -> COMPLETED
                            \-> DENIED / REVIEW_REQUIRED
```

FAILED is controlled. Transfer preserves source provenance and never changes source institution ownership in place.

## Restore workflow

```text
REQUESTED -> AUTHORIZED -> RESTORING -> RESTORED_PENDING_VERIFICATION
                                      -> TECHNICAL_VERIFICATION
                                      -> AVAILABLE | QUARANTINED
```

DENIED/FAILED are safe outcomes. Legally final deletion cannot be restored.

## Concurrency

No silent last-write-wins for important state. Incompatible concurrent transitions must serialize or produce an explicit conflict. Critical ordering must use canonical sequence/version/transaction evidence rather than clocks alone.

## Idempotency

Replaying the same logical command must not duplicate canonical effects. Execution attempts may be multiple; the logical operation remains one.

## Transition evidence

Critical transitions preserve previous state, resulting state, actor/service, institution, authority, reason where required, timestamp, operation/correlation and result.
