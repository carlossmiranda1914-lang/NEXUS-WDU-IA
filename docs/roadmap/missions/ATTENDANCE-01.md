# Mission Pack — ATTENDANCE-01

**Mission status:** PREPARATION ONLY  
**Implementation status:** NOT AUTHORISED  
**Finance:** explicitly out of scope. Do not inspect, plan, modify or depend on Finance work.

## Objective

Produce the complete, reviewed Attendance-01 implementation specification from the confirmed preparation decisions. No production implementation activity is included in this mission pack.

## Product boundary

Attendance owns attendance sessions, outcomes, occurrences, justifications, thresholds, alerts, corrections and historical attendance evidence. It does not own student identity/current placement, TeacherAssignment, policy membership, document files, timetable, academic sanctions or Finance.

## Required preparation work packages

### WP1 — State-machine specification

Specify exact states, allowed transitions, actors, timestamps, idempotency keys and rejection paths for:

- session;
- attendance outcome;
- occurrence;
- justification proposal/decision;
- correction proposal/revision;
- offline capture/synchronisation conflict;
- threshold alert/action; and
- report export request/delivery.

**Acceptance:** no state is implicit; every terminal/cancellation/error path preserves required audit.

### WP2 — Policy catalogue

List every institutional policy setting, data type, allowed range, default/prohibited value, policy owner, approval route and policy-version effect.

Must cover registration unit, time zone, deadlines, late-session mode, correction authority/deadline, justification scope, threshold calculation/action, cancellation, offline cache validity/conflict authority, notification channels, access, export and migration.

**Acceptance:** each confirmed “institutional policy” decision is representable without exceeding global/jurisdictional limits.

### WP3 — Integration contracts

Define request/response or event contracts with Academic Core, IAM / Institutional Context, Documents Foundation, notification and report e-mail delivery.

**Acceptance:** contracts prove institution, actor, assignment, placement/process/evidence reference, policy version, expiry/idempotency and failure behaviour. No contract makes Finance a dependency.

### WP4 — Security and privacy specification

Define authorisation revalidation, offline encrypted cache, sign-out deletion, conflict handling, cross-institution negative checks, audit integrity, report-recipient validation and jurisdictional retention controls.

**Acceptance:** threat scenarios and mitigations have testable controls; no open P0/P1 risk.

### WP5 — UX and accessibility specification

Define accessible flows for teacher, coordination, guardian and learner, including session completion, automatic absence, justifications, correction notification, offline status/conflict, alerts/action queue and reporting.

**Acceptance:** keyboard, screen-reader and contrast requirements; clear distinction between factual absence, justification state, pending state and correction.

### WP6 — Acceptance evidence pack

Create test matrix and manual validation scripts using synthetic/anonymous data only. Include teacher, coordination, guardian, learner and security/audit profiles, plus mandatory negative attempts across at least two institutions.

**Acceptance:** automated, integration, security and manual-validation evidence requirements trace to every critical rule.

## Gate to request readiness review

All work packages complete; no P0/P1 open; P2 only with a recorded decision; dependencies/contracts reviewed; Product Owner is the sole readiness approver.

## Explicitly excluded

- Code, database migrations, APIs, UI delivery, jobs, storage, environments and deployment.
- Any Finance planning or changes.
- A timetable module.
- Reuse of legacy/mock Attendance data as authority.
