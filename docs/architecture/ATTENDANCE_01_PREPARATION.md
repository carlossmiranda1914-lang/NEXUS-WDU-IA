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
