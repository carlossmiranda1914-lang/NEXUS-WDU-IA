# ATTENDANCE-01 — Lifecycle and Policy-State Specification

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.

## 1. Rules for all lifecycles

- Each record is institution-scoped and policy-evaluated.
- All decisions retain the exact policy-version reference applied.
- A state change requires an authorised actor or an explicit automated rule already approved by policy.
- State history is append-only and auditable.
- A technical file-verification state in Documents Foundation is not an Attendance business state.

## 2. Session lifecycle

| State | Meaning | Permitted exit |
|---|---|---|
| OPEN | Session is in the teacher's permitted editing window. | CONFIRMED, CANCELLED, PENDING_DECISION, EXPIRED |
| PENDING_DECISION | A required human decision exists after deadline; ordinary editing is locked. | Policy-authorised resolution to CONFIRMED with complete outcomes or CANCELLED without effects |
| CONFIRMED | Historical roster and primary outcomes are fixed. | No direct edit; correction revision only |
| CANCELLED | Pre-confirmation cancellation with reason/audit; no attendance effect. | Terminal |
| EXPIRED | Terminal expiry where the policy does not create automatic absence or human-decision handling. | Terminal |

When the teacher confirms an OPEN session, every eligible learner must have a primary outcome; any unset outcome is automatically set to absence as part of that confirmation. This is distinct from late-session automation. A policy-selected automatic confirmed absence after a missed deadline transitions the session to CONFIRMED and triggers immediate notification to teacher, coordination and guardian. A human route transitions it to PENDING_DECISION.

## 3. Justification lifecycle

| State | Meaning |
|---|---|
| SUBMITTED | Permitted guardian submission received |
| TEACHER_PROPOSED | Teacher proposal recorded |
| PENDING_DECISION | Awaiting policy-authorised coordination decision |
| APPROVED | Absence remains factual and is marked justified |
| REJECTED | Justification refused; history retained |

A guardian submission always requires a teacher proposal before coordination decision; it cannot directly enter coordination decision. A proposal cannot be withdrawn. It must be expressly decided or rejected by the policy-authorised decision actor. A late permitted guardian submission creates a new decision path; it never silently changes a prior state.

## 4. Correction lifecycle

A correction is a proposal over a confirmed historical record. It cannot overwrite its source revision.

| State | Meaning |
|---|---|
| PROPOSED | Teacher has submitted correction with reason |
| PENDING_DECISION | Awaiting policy-authorised approval |
| EFFECTIVE | Approved immutable revision, effective immediately |
| REJECTED | Refused proposal; source revision remains effective |

The exact actor/deadline is institutional-policy controlled. Only the policy-authorised decision actor may reject a correction or justification proposal. Deadline expiry alerts/escalates; it does not approve the correction.

## 5. Offline-conflict lifecycle

| State | Meaning |
|---|---|
| DETECTED | Server identifies a conflicting offline change |
| PENDING_DECISION | Policy-authorised human resolution is required |
| RESOLVED | Authorised resolution applied and audited |
| REJECTED | Offline change rejected and retained in audit evidence |

No automatic client-wins, server-wins or timestamp-only resolution is allowed.

## 6. Alert, notification and export lifecycles

### Threshold alert

GENERATED → NOTIFIED → ACTION_PENDING → RESOLVED

A subsequent business change can create RECALCULATED, but prior alert history remains intact.

### Mandatory notification

A delivery failure becomes FAILED; retry is automatic and escalation follows the policy-defined deadline. The mandatory in-system trail remains the canonical evidence.

### Report export

REQUESTED → AUTHORISED → GENERATED → SENT

A failure at generation or delivery becomes FAILED. Authorisation, approved scope and recipient address validation precede generation/sending. Delivery is by e-mail attachment in PDF or CSV; no public link and no later revocation claim.

## 7. Policy parameters that must be represented before implementation

| Policy area | Confirmed rule/boundary |
|---|---|
| Registration unit | Institution chooses lesson/session, school day and/or activity |
| Time | Institution chooses timezone within global rules |
| Late session | Automatic confirmed absence or human route |
| Correction | Approval actor/conditions/deadline defined institutionally; teacher only proposes |
| Guardian justification | Submission/late submission/multi-absence scope controlled institutionally |
| Threshold | Counted occurrences, limits and required human action configured institutionally |
| Cancellation | Authorised actor and conditions controlled institutionally |
| Offline | Cache validity by registration unit; conflict decision authority institutional |
| Notifications | In-system mandatory; extra channels by policy |
| Access | Limits only to confirmed permitted role/relationship; current rules recorded in preparation document |
| Reports | Scope and institutional-summary permission controlled by policy |
| Retention | Institution configures only within global jurisdictional profile |
| Policy governance | Authorised institutional role with audited approval; global/jurisdictional rules constrain it |

## 8. Remaining P3 work

Before P3 can close, the specification must assign exact permitted transition actors, required transition payloads, timestamp semantics, idempotency behaviour and error results for every row. This document authorises none of those implementation activities.
