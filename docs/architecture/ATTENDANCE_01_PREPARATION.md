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
| Retention and erasure | Global jurisdictional profile; institution configures only within it |
| Historical migration acceptance | Reconciled totals, validated sample and audited institutional approval |
| Pending correction proposal | Institutional deadline, alert and escalation |
| Confirmed-session learner history | Immutable reference plus learner name and class visible at confirmation |
| Policy traceability | Immutable reference to the version applied to every decision |
| Later placement correction | Preserve confirmed historical context; change only through audited Attendance revision |
| Policy for session confirmation | Version effective at session initiation |
| More restrictive global/jurisdictional rule | May re-evaluate pending work when required; preserve history |
| Attendance policy publication | Institution-authorised role with audited approval |
| First-cut required experiences | Teacher register/confirm; coordination justification/conflict decisions and alert queue; guardian consultation/justification; learner own consultation |
| First-cut reports | File export |
| Learner attendance access | Own attendance information only |
| Report export requester | Coordination or institutionally authorised role only |
| Report export scope | Learner, assigned class/activity and defined period; institutional summaries when policy permits |
| Report delivery | E-mail attachment |
| Export recipient | Any address indicated by the authorised requester, validated before each delivery |
| Export formats | PDF and CSV |
| E-mail attachment protection | No password; protection is pre-send address validation plus audited authorisation |
| Readiness evidence | Automated, integration, security and manual validation tests |
| Open defects at acceptance | No P0/P1; P2 only with recorded decision |
| Readiness approver | Product Owner only |
| Validation data | Synthetic or anonymised only |
| Required manual-validation profiles | Teacher, coordination, guardian, learner and security/audit |
| Institution isolation evidence | Mandatory negative attempts across at least two institutions |
| Required session states | Open, pending decision, confirmed, cancelled and expired |
| Human-decision late session | Pending decision and locked for editing |
| Withdrawal of justification/correction proposal | Not allowed; proposal must be decided or rejected |
| Required justification states | Submitted, teacher-proposed, pending decision, approved and rejected |
| Approved correction | Effective immediately; earlier revision retained |
| Offline-conflict states | Detected, pending decision, resolved and rejected |

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

## 16. Retention, migration acceptance and correction-deadline decisions

1. Retention and eventual erasure of attendance records and audit evidence are governed by the applicable global jurisdictional profile. Institution-level configuration is permitted only within that profile.
2. Historical migration is accepted only after reconciled totals, a validated sample and audited institutional approval. The migration must preserve source provenance, execution identity, time and reconciliation evidence.
3. A correction proposal has an institutional-policy deadline. When pending beyond that deadline, Attendance alerts and escalates according to policy; it must never become effective merely by expiry.

## 17. Attendance data-authority decisions

1. At confirmation, Attendance preserves the historically visible learner context: immutable learner and placement references plus the learner name and class visible at that moment. This historical context is not silently refreshed from current Academic Core data.
2. Attendance retains only the historical snapshot needed to interpret its own confirmed record; Academic Core remains authoritative for current learner, class and placement data.
3. Every session, alert, justification and correction decision retains an immutable reference to the specific institutional-policy version applied.
4. If Academic Core later corrects a placement, the confirmed Attendance context remains historically intact. Any attendance effect requires an auditable Attendance revision under the correction rules; automatic rewriting is prohibited.

## 18. Institutional-policy lifecycle decisions

1. A session is governed at confirmation by the institutional-policy version effective when the session was initiated. Its reference is immutable on the session record.
2. A new global or jurisdictional rule that is more restrictive may re-evaluate already-pending sessions, justifications or corrections when legally or globally required. The original policy reference and all resulting actions remain historical evidence.
3. Attendance policy may be published or changed only by an institutionally authorised role through an auditable approval process, and only within global/jurisdictional limits.

## 19. First-cut experience and reporting decisions

1. Attendance-01 must provide, in its first implementation cut:
   - teacher initiation, registration and confirmation of attendance;
   - coordination decision flows for justifications and offline synchronization conflicts;
   - a coordination queue for alerts and required pending actions;
   - guardian consultation of their own learner and permitted justification submission; and
   - learner consultation limited strictly to their own attendance information.
2. The first cut includes report export to file. The export authorisation, scope, content, format, expiry and audit remain to be specified before implementation; no uncontrolled export is implied by this decision.
3. Learner access can never reveal another learner's attendance, a guardian's private submission, staff-only notes, internal decision rationale or unapproved evidence.

## 20. Report-export decisions

1. Only coordination and institutionally authorised roles may request an Attendance report export.
2. An authorised export may cover an individual learner, an assigned class/activity and a defined period. Institutional summaries are permitted only where institutional policy allows.
3. The first-cut delivery channel is an e-mail attachment.
4. Before creating or sending an export, Attendance must validate the requester, institutional scope, policy version and authorised recipient; the request, generated content scope, recipient, send result and policy reference are auditable.
5. An e-mail attachment cannot be revoked after delivery. Before every delivery, Attendance validates the address indicated by the authorised requester. The attachment is sent without a password; its protection relies on pre-send address validation and audited authorisation.
6. The first-cut export formats are PDF and CSV. Format-specific data minimisation, generation controls and recipient-validation mechanics remain mandatory design work before implementation.
7. This decision does not permit public links, unvalidated delivery, later claims of withdrawal, or disclosure beyond the approved export scope.

## 21. Acceptance and implementation-readiness decisions

1. Attendance-01 is not ready to request implementation authorisation without evidence from automated tests, integration tests, security tests and manual validation.
2. No P0 or P1 issue may remain open for an accepted unit. A P2 issue requires an explicit recorded decision.
3. Only the Product Owner approves readiness before an implementation-authorisation request.
4. This readiness approval remains distinct from implementation authorisation. No code, migration, UI, storage setup or deployment is authorised by this preparation record.
5. Testing and manual validation use synthetic or anonymised data only.
6. Manual validation must include a teacher, coordination, guardian, learner and security/audit profile.
7. Acceptance requires mandatory negative cross-institution attempts involving at least two institutions.

## 22. Initial state-machine decisions

### 22.1 Attendance session

The required first-cut session states are:

- **OPEN** — editable only by the authorised teacher while the session is within its permitted window;
- **PENDING_DECISION** — deadline reached where policy requires human decision; locked for ordinary editing;
- **CONFIRMED** — roster and primary outcomes historical; changes only by the correction workflow;
- **CANCELLED** — pre-confirmation cancellation with preserved evidence and no attendance effect; and
- **EXPIRED** — terminal expiry where policy does not create an automatic absence or a human-decision route.

When a late session requires human decision, it transitions to **PENDING_DECISION**, not OPEN or EXPIRED, and is blocked for editing.

### 22.2 Proposals

A justification proposal and a correction proposal cannot be withdrawn by the proponent. Each must reach an explicit authorised decision or rejection; the full history remains auditable.

### 22.3 Justification

The required first-cut justification states are:

- **SUBMITTED** — a permitted guardian submission exists;
- **TEACHER_PROPOSED** — the teacher has made the required proposal;
- **PENDING_DECISION** — awaiting policy-authorised coordination decision;
- **APPROVED** — factual absence remains and has the justified state; and
- **REJECTED** — the decision refuses the justification without deleting its history.

The technical state of a Documents Foundation attachment is separate from these business states. An attachment never changes a justification decision automatically.

### 22.4 Correction revision

Once a correction is approved by the policy-authorised actor, its new immutable revision becomes **EFFECTIVE** immediately. The earlier revision remains historical evidence.

### 22.5 Offline synchronisation conflict

The required conflict states are **DETECTED**, **PENDING_DECISION**, **RESOLVED** and **REJECTED**. No automatic-resolution state or implicit client/server winner is allowed.

