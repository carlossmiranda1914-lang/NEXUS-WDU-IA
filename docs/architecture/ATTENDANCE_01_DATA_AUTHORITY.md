# ATTENDANCE-01 — Data Authority and Historical Integrity

**Status:** DRAFT — planning only.  
**Implementation authorisation:** No.  
**Scope boundary:** Attendance preparation only. This document does not plan or change Finance.

## 1. Purpose

This document defines which attendance information Attendance-01 owns, the minimum historical context it preserves, and the boundaries with Academic Core, IAM / Institutional Context and Documents Foundation.

It is a design record, not a schema, API contract, migration or implementation instruction.

## 2. Authoritative ownership

| Information | Authoritative domain | Attendance responsibility |
|---|---|---|
| Learner identity, current class and placement | Academic Core | Resolve authorised current context before opening; retain approved historical session context |
| TeacherAssignment and assignment activity | Academic Core | Require active assignment before online/offline session action |
| Institutional membership, role and policy evaluation | IAM / Institutional Context | Enforce policy at every action and retain policy-version reference |
| File bytes, technical verification, version, storage access and retention of evidence | Documents Foundation | Store only a controlled evidence reference and business validity decision |
| Attendance sessions, records, occurrences, justifications, thresholds, alerts, corrections and their audit | Attendance | Own lifecycle and immutable history |
| Academic consequence | Authorised academic policy/domain | Never create automatically from Attendance |

## 3. Attendance-owned records

Attendance requires conceptually distinct, institution-scoped records:

1. **Attendance session** — initiated authorised occasion, configured unit, time context, assignment where applicable, status and historical roster context.
2. **Attendance outcome** — primary presence or absence for each eligible learner in a confirmed session.
3. **Attendance occurrence** — tardiness or missing material, independent from the primary outcome.
4. **Justification case and decision** — proposal, scope, decision, delegation where permitted, state and optional controlled Documents Foundation evidence reference.
5. **Threshold evaluation and alert** — calculation input/result, recipients, required human action and historical notification trail.
6. **Correction proposal and revision** — a proposed change and, only after approval, a new effective immutable revision.
7. **Cancellation record** — a pre-confirmation cancellation with reason, actor and timestamp, with no attendance effect.
8. **Migration record** — controlled historical-load provenance, reconciliation and approval evidence.

These conceptual records must not be collapsed into a mutable “attendance status” field.

## 4. Historical learner context

At session confirmation, Attendance preserves:

- immutable learner reference;
- immutable placement reference;
- learner name visible at confirmation; and
- class visible at confirmation.

The snapshot exists to explain the historical attendance decision. Academic Core remains authoritative for current learner, class and placement data. Later changes there do not silently rewrite Attendance history.

A subsequent attendance change requires a revision under the correction workflow.

## 5. Immutability and revision

- A confirmed session and its primary outcomes are historical evidence.
- An effective change creates an immutable revision; it does not overwrite the original.
- The original value, reason, proposing actor, approving actor and relevant timestamps remain recoverable.
- A proposed correction is not effective until an institutionally authorised approval decision.
- Correction proposals follow the policy-defined deadline, alert and escalation path; expiry never makes a proposal effective.
- Every decision has an immutable reference to the exact institutional-policy version applied.

## 6. Temporal and institutional context

- Every record is scoped to one institution.
- A session keeps the institutional-policy version effective when it was initiated; that policy governs its confirmation.
- Only an institutionally authorised role may publish/change Attendance policy, through auditable approval and within global/jurisdictional limits.
- A more restrictive global or jurisdictional rule may re-evaluate pending work when required. The prior version, new rule and re-evaluation remain historical evidence.
- Institutional policy selects the operational timezone within platform global rules.
- Canonical timestamps must remain unambiguous; user-facing rendering follows the applicable institutional timezone.
- Attendance uses a global jurisdictional retention profile. An institution may configure only within that profile.
- Erasure and retention never destroy required audit evidence outside the applicable jurisdictional rule.

## 7. Evidence and documents boundary

Attendance can request and evaluate justification evidence only through Documents Foundation. It never stores file bytes, browser blobs, data URLs or independent file metadata as a workaround.

An evidence reference is not itself a valid justification. Attendance records the business decision under institutional policy; Documents Foundation owns the file’s technical availability and access controls.

## 8. Migration integrity

Historical attendance migration is permitted only as a controlled, auditable operation. Acceptance requires:

- reconciled totals;
- a validated sample;
- audited institutional approval; and
- retained source provenance, execution identity, time and reconciliation evidence.

Untraceable bulk imports, silent backfills and overwrite of existing confirmed attendance history are prohibited.

## 9. Mandatory audit trail

At minimum, audit evidence must cover:

- session initiation, confirmation, cancellation and expiry;
- roster resolution/freeze;
- outcome and occurrence entry;
- offline capture, synchronisation, conflict and resolution;
- justification proposal, evidence link, delegation, decision and late submission;
- threshold evaluation, alert, recalculation and required action;
- correction proposal, approval, rejection, withdrawal and effective revision;
- policy-version use;
- access and notification attempts; and
- migration execution, reconciliation and approval.

The audit design must be append-only and integrity-verifiable before implementation can be authorised.

## 10. Open implementation-design work

Before implementation, a separate contract/specification must define identifiers, exact state names, payloads, concurrency/version checks, actor authorisation proofs, policy evaluation interface, error taxonomy, retention executor and audit-integrity mechanism. These are not yet authorised for implementation.
