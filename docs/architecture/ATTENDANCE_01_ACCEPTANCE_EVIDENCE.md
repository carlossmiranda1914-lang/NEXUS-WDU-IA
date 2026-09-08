# ATTENDANCE-01 — Acceptance Evidence Specification

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.  
**Readiness approver:** Product Owner only.

## 1. Acceptance rule

A unit cannot be accepted without automated, integration, security and manual-validation evidence. No P0 or P1 can remain open. A P2 requires an explicit recorded decision.

All test and manual-validation data must be synthetic or anonymised.

## 2. Mandatory evidence matrix

| Area | Minimum evidence |
|---|---|
| Session authority | Online initiation/confirmation succeeds only for active TeacherAssignment; invalid/inactive/cross-institution assignments fail closed |
| Roster integrity | Signed placement change affects OPEN roster; authoritative reconciliation occurs before confirmation; confirmed roster remains historical |
| Outcome completeness | Explicit outcome remains unchanged; unset eligible outcome becomes absence at teacher confirmation |
| Late session | Both institutional-policy branches: automatic confirmed absence with notices, and locked PENDING_DECISION with authorised resolution |
| Justification | Guardian submission, required teacher proposal, authorised decision, multi-absence scope, late permitted submission and retained factual absence |
| Correction | Teacher proposal only; immutable revision; approval immediately effective; rejection/expiry/escalation preserved |
| Offline | Valid cache prerequisite; encrypted/OS-protected minimal cache; device-protection block; sign-out removal; sync validation; human conflict resolution |
| Thresholds | Configured input/limit; teacher/coordination/guardian notice; action queue; recalculation preserves prior alerts |
| Access | Teacher/coordination/guardian/learner own-scope boundaries; revoked/invalid relationship denied |
| Documents | Provisional evidence association; technical state separate from business validity; no local file storage |
| Reports | Requester/scope authorisation; PDF/CSV; recipient OTP each send; e-mail send/failure audit; no public link |
| Retention/migration | Jurisdictional policy application; controlled migration with totals, sample and institutional approval |
| Audit | Append-only evidence for lifecycle, actor, policy version, notification, export and migration actions |
| Accessibility | Keyboard, screen reader and contrast; critical states do not rely on colour |
| Institution isolation | Negative attempts across at least two institutions for session, history, evidence and export |

## 3. Manual-validation profiles

Manual validation must include:

1. teacher;
2. coordination;
3. guardian;
4. learner; and
5. security/audit.

Each profile validates both permitted actions and prohibited cross-role/cross-learner/cross-institution actions.

## 4. Required evidence location

Evidence must be versioned or referenced in the repository without personal data. It must identify the specification rule, test scenario, result, execution date/environment, responsible role and any accepted P2 decision.

## 5. Readiness gate

The Product Owner may approve **implementation readiness** only after the evidence matrix is complete and reviewable. Implementation itself remains prohibited until a separate explicit Product Owner implementation authorisation.

## 6. Not an implementation plan

This document does not authorise source-code changes, migrations, storage, UI delivery, jobs, external e-mail configuration or deployment.
