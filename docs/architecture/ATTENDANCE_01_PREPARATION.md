# ATTENDANCE-01 — Preparation Record

**Status:** DRAFT — planning only.  
**Implementation authorisation:** No.  
**Dependency status:** Future implementation is blocked until Documents Foundation is authorised, implemented and exposes its approved attachment contract.

## 1. Scope

Attendance is the authoritative domain for attendance sessions, presence/absence records, attendance occurrences, justifications, thresholds and attendance alerts. It does not own academic assignment, student identity, enrolment, document bytes, business-wide workflow or financial data.

## 2. Audit baseline

- No canonical Attendance domain currently exists.
- Existing user-interface/legacy references to attendance are not authority and must not be reused as an implementation shortcut.
- Academic Core provides active TeacherAssignment, AcademicYear, Class, Subject and StudentAcademicPlacement.
- Institutional Context and role policy remain mandatory for every action.

## 3. Confirmed decisions

| Topic | Decision |
|---|---|
| Standard unit | Configurable by institution |
| First-cut units | Lesson/session, school day and school activity |
| Session source without timetable domain | Teacher starts a session bound to active TeacherAssignment |
| First-cut core outcomes | Presence and absence |
| First-cut occurrences | Tardiness and missing material |
| Occurrence relationship | Tardiness/missing material are separate; do not replace presence/absence |
| Justification flow | Teacher proposes; coordination decides |
| Correction after teacher close | Institutional policy |
| Guardian justification submission | Institutional policy |
| Unjustified absence | Automatically unjustified after configurable deadline |
| Late register | Notify teacher and coordination |
| Threshold alert action | Institution configures required human action |
| Guardian visibility | Immediately after attendance confirmation |
| Academic consequence | Only by institutional policy |
| Offline register | Allowed with later synchronisation |
| Additional record actors | Institutional policy |
| Justification delegation | Coordination may delegate by institutional policy |
| Justification evidence | File attachments allowed |
| Attachment dependency | Documents Foundation; no local/browser upload substitute |
| Eligible roster | Updates while session is open; fixed historical roster after confirmation |
| Confirmation completeness | Presence or absence required for every eligible learner |
| Late session rule | Institutional policy chooses automatic confirmed absence or human decision |
| Automatic confirmed absence | Audit and immediately notify teacher and coordination |
| Correction history | New immutable revision; preserve original, reason, author and timestamp |
| Teacher after confirmation | May only propose a correction; approval follows institutional policy |
| Guardian correction notice | Notify immediately when a visible outcome or justification state changes |
| Session initiation and confirmation | Only the teacher who holds the active assignment |
| Detailed history access | Active assigned teacher, coordination and the learner's own guardian |
| Recording for another teacher | Prohibited; every record requires the actor's own active assignment |
| Pre-confirmation cancellation | Institutional policy determines authorised actor and conditions |
| Cancellation history | Preserve session, mandatory reason, author and timestamp; no attendance effects |
| Guardian notice for automatic absence | Immediate, as for any confirmed absence |
| Time zone | Institution configures within global rules |
| Historical data | Controlled, audited migration only |
| Default notifications | In-system notification; additional channels by institutional policy |

## 4. Authority boundary

| Information / decision | Authority |
|---|---|
| Academic assignment, class, subject, year and active placement | Academic Core |
| Institutional actor, membership and policy context | IAM / Institutional Context |
| Attendance session, record, occurrence, justification and alert | Attendance |
| File bytes/version/access/audit | Documents Foundation |
| Justification evidence validity | Attendance under institutional policy |
| Academic consequence | Authorised academic policy/domain, never automatic Attendance decision |

## 5. Initial model direction

Attendance will require an explicit, immutable attendance session bound to:

- institution;
- configured unit type;
- active academic context/TeacherAssignment where applicable;
- date/time and initiating actor;
- eligible student placement set;
- lifecycle and audit.

A session is not a timetable. It records that an authorised attendance occasion was initiated. The design must later define concurrency, offline reconciliation, closure, correction and threshold calculations.

## 6. Hard constraints

- No inferred class/student/teacher authority from browser input.
- No session without active and institution-scoped academic context where a TeacherAssignment applies.
- No attachment outside Documents Foundation.
- No automatic academic sanction merely because an attendance threshold is reached.
- No implementation, migration, storage setup or UI change under this record.

## 7. Next planning questions

1. Session lifecycle: open, draft, confirmed, closed, corrected and cancellation rules.
2. Eligible students and placement change during an open session.
3. Attendance record status and correction/audit model.
4. Justification lifecycle, evidence reference and decision delegation.
5. Offline capture, conflict resolution and synchronisation authority.
6. Threshold policy, alerts and required human action.
7. Permissions, notifications, UX, acceptance evidence and Mission Pack.


## 8. Session lifecycle decisions

1. An authorised teacher initiates an attendance session from an active TeacherAssignment.
2. While open, the eligible roster follows valid placement changes.
3. Before confirmation, every eligible learner needs a primary outcome: presence or absence.
4. Confirmation freezes the eligible roster and creates historical session context.
5. Tardiness and missing material are separate occurrences attached to the primary outcome.
6. If the deadline passes without confirmation, the institutional policy selects either:
   - automatic confirmed absence, with immediate audit/teacher/coordination/guardian notification; or
   - a human decision by the policy-authorised actor.
7. Corrections after confirmation remain governed by institutional policy and must preserve history.

## 9. Justification decisions

1. An approved justification does not erase or replace the factual absence; it records the absence as `justified`.
2. The standard decision route remains teacher proposal and coordination decision, with delegation where institutional policy permits.
3. A guardian may submit after the configured deadline only where policy permits; the late submission triggers a new decision and cannot silently change the record.
4. A justification may cover multiple absences of the same learner only within policy-defined interval and scope.
5. File evidence is attached through Documents Foundation only. Documents Foundation verifies file technical state; Attendance owns justification decision.
6. Every proposal, decision, delegation, late submission, coverage change and evidence link is auditable.

## 10. Threshold and alert decisions

1. Institutional policy determines whether thresholds count absences, tardiness or configured combinations.
2. When a threshold is reached, teacher, coordination and guardian are always alerted.
3. The institution configures the required human action after an alert.
4. A later justification recalculates threshold state while preserving the complete historical alert trail; an alert is never silently erased.
5. Attendance does not impose an academic consequence. Any consequence remains an explicit institutional academic-policy decision.

## 11. Offline registration decisions

1. Offline attendance starts only with a previously verified, still-valid cached active TeacherAssignment.
2. A server/offline edit conflict is created for human decision; no timestamp-only or client-wins merge is allowed.
3. After successful synchronization, local attendance data may remain only until the actor signs out; sign-out removes it from the device.
4. Offline records remain pending until server-side authorization, assignment, roster and policy validation succeeds.
5. Offline capability does not bypass later notifications, audit, thresholds or correction policy.

6. The maximum offline cache validity is configured by registration unit and must be explicit in institutional policy; no indefinite cache is permitted.
7. Local data is stored only in encrypted operating-system-protected storage.
8. Institutional policy identifies the human actor for each offline synchronization conflict.


## 12. Correction and notification decisions

1. A confirmed attendance record is never overwritten. Each accepted correction creates a new immutable revision linked to the original record and preserves the original value, mandatory reason, proposing actor, approving actor and timestamps.
2. After a teacher confirms a session, the teacher may only propose a correction. The institutional policy determines the approving authority, eligibility and deadline.
3. A correction is not effective merely because it is proposed; it remains pending until the policy-authorised approval decision is recorded.
4. If an effective correction changes a presence/absence outcome or a justification state already visible to the guardian, Attendance notifies the guardian immediately in the guardian's interface language.
5. The notification identifies that the record changed and directs the guardian to the updated record; it must not disclose internal notes, security details or unauthorised information.
6. Every proposal, approval, rejection, withdrawal, effective revision and notification attempt is auditable.

## 13. Operational permissions decisions

1. Only the teacher who holds the active TeacherAssignment may initiate or confirm a session bound to that assignment.
2. No actor may record attendance in another teacher's name. Each attendance action requires the acting teacher's own active assignment; no implicit proxy or shared credential is permitted.
3. Detailed attendance history for a class or activity is available only to:
   - the teacher with the active relevant assignment;
   - coordination, within institution and policy scope; and
   - the guardian, limited strictly to their own learner.
4. Every access decision is institution-scoped, policy-evaluated and auditable. Access must be denied if the assignment, relationship or role cannot be confirmed at the time of the request.

## 14. Cancellation and automatic-absence decisions

1. Before confirmation, the policy institutionally defines which authorised actor may cancel a session and the applicable conditions.
2. Cancellation requires a reason and preserves the cancelled session, reason, actor and timestamp in immutable audit history.
3. A cancelled session produces no presence, absence, occurrence, threshold or academic effect.
4. When institutional policy selects automatic confirmed absence after a missed deadline, the guardian is notified immediately, exactly as for another confirmed absence. Teacher and coordination are also immediately notified.

## 15. Time, migration and notification decisions

1. Institutional policy configures the timezone used for deadlines, school-day boundaries and confirmation within platform global rules. Every recorded timestamp remains stored in an unambiguous canonical form and rendered in the applicable institutional timezone.
2. Attendance-01 may receive historical records only through a controlled, auditable migration. Manual bulk import, untraceable backfill and silent overwrite are out of scope.
3. Every operational alert and attendance-change notification is delivered in the system. Institutional policy may enable additional channels, which must not replace the in-system audit trail.

