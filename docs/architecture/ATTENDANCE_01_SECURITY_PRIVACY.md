# ATTENDANCE-01 — Security and Privacy Control Record

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.

## 1. Security objectives

Attendance must protect institution isolation, attendance integrity, actor accountability, historical evidence, offline device data, guardian/learner boundaries and report-export confidentiality.

## 2. Confirmed controls

| Risk | Required control |
|---|---|
| Unauthorised online teacher action | Synchronous Academic Core validation at session initiation and confirmation |
| Stale/offline authority | Previously verified, time-limited cached active assignment; revalidate server-side on synchronisation |
| Excess local data | Cache only valid assignment, necessary session/roster and unsynchronised records |
| Device protection loss | Block offline registration until OS protection requirements are restored |
| Local disclosure | Encrypted OS-protected storage; remove local Attendance data at sign-out |
| Conflicting offline changes | Human decision; no automatic client/server or timestamp winner |
| Cross-institution access | Deny and test negative attempts across at least two institutions |
| Historic record tampering | Immutable revisions and append-only integrity-verifiable audit |
| Evidence bypass | Documents Foundation provisional association only; no local file store |
| Unauthorised report export | Coordination/institution-authorised requester, policy scope and audit |
| E-mail recipient mistake | One-time code sent to specified address before every delivery; expires after 5 minutes; repeated failures temporarily block validation and alert security |
| Irreversible e-mail delivery | No public link/no revocation claim; approved scope and recipient must be verified before send |
| Mandatory notification failure | Automatic retry and escalation after policy deadline |
| Retention conflict | Global jurisdictional profile; institution configures only within it |

## 3. Report-output retention

After a report is sent by e-mail, Attendance retains only required metadata and audit evidence. It does not retain a copy of the generated file. The audit record identifies, at minimum, requester, scope, format, recipient-validation result, send outcome, policy version and time, subject to the applicable jurisdictional profile.

## 4. Privacy boundaries

- Confirmed session history holds learner/placement reference plus name and class visible at confirmation. Current identity/placement remains Academic Core authority.
- Guardian sees only their own learner. Learner sees only their own attendance.
- Attendance does not expose staff-only notes, internal decision rationale, another learner’s data or unapproved evidence.
- Test/manual validation uses synthetic or anonymised data only.

## 5. Required pre-implementation verification

1. Offline cache inspection: prove no information beyond approved minimum is retained and sign-out removes it.
2. Device-posture failure: prove offline operation blocks, not merely warns.
3. Synchronisation conflict: prove manual resolution and immutable evidence.
4. Institution isolation: prove negative access/export attempts across at least two institutions.
5. Report delivery: prove one-time-code validation per send, approved recipient/scope, audit and failure handling.
6. Role/relationship revocation: prove action/access is denied on revalidation.
7. Audit integrity: prove historic session/revision/decision evidence cannot be edited or silently overwritten.

## 6. Open security-design work

Threat modelling must define platform capability assumptions, OS posture signals, cache key management, offline tamper detection, OTP lifetime/rate limits, e-mail delivery provider controls, event signature/key rotation, audit-integrity verification and incident response.

This document provides no implementation authorisation.
