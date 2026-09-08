# ATTENDANCE-01 — UX and Accessibility Specification

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.

## 1. Experience boundary

The first cut includes:

- teacher: start, register and confirm a session;
- coordination: decide justifications and offline conflicts; manage alerts/action queue;
- guardian: see own learner's confirmed attendance and submit permitted justifications;
- learner: see only their own confirmed attendance;
- authorised institutional roles: request permitted report exports.

Attendance UI does not expose Finance, current Academic Core administration, document-file storage or staff-only decision rationale.

## 2. Teacher flow

1. Start session only from a current valid TeacherAssignment.
2. Show eligible roster and separate primary outcome from occurrences (tardiness/missing material).
3. While open, present placement-driven roster changes clearly.
4. On confirmation, any remaining unset primary outcome is recorded as absence.
5. Show an unambiguous result: confirmed, pending decision, cancelled, expired or offline pending.
6. After confirmation, allow teacher only to propose correction; never overwrite historical values.
7. Offline mode visibly indicates cached authority/expiry, pending records and later conflict status.

## 3. Coordination flow

- Justification decisions require the teacher proposal path.
- Conflict queue shows that the record is awaiting the policy-authorised decision actor.
- Alert queue shows learner/scope, reason, state, deadline and required human action.
- A queue item cannot silently disappear on recalculation; historical alerts remain accessible under authorisation.
- Cancellation/correction/decision controls must surface their required reason and policy context.

## 4. Guardian and learner flow

- Guardian sees only their own learner.
- Learner sees only their own attendance.
- Both see confirmed attendance immediately after confirmation.
- A justified absence must remain visibly factual absence with a justified state; it must not appear as erased.
- When a correction changes a visible outcome or justification state, guardian receives an immediate notification.
- Guardian permitted submissions clearly show business state separately from technical attachment state.
- Rejections and decision reasons are communicated by the authorised business process without internal-only notes.

## 5. Notifications and reports

- In-system notification is canonical; extra channels follow policy.
- Messages use the user's interface language.
- A delivery failure is not presented as a successful notification.
- Export request/delivery screens must show approved scope and recipient-validation outcome without displaying the OTP itself.
- E-mail export is PDF/CSV attachment only after one-time-code validation for the specified address.

## 6. Accessibility

The first cut requires:

- complete keyboard navigation;
- screen-reader support with meaningful names/status announcements; and
- adequate visual contrast.

Critical state distinctions must not rely on colour alone. Offline, pending decision, failure, confirmation and justified state require textual equivalents.

## 7. Validation scenarios

Manual validation must cover teacher, coordination, guardian, learner and security/audit profiles using synthetic or anonymised data. It must include an incomplete confirmation, automatic absence, guardian visibility, correction notice, offline conflict, alert action, report recipient validation and negative cross-institution access.

No UI implementation is authorised by this document.
