# ATTENDANCE-01 — Integration Boundaries and Contracts

**Status:** DRAFT — preparation only.  
**Implementation authorisation:** No.  
**Finance:** excluded entirely.

## 1. Contract principles

- Attendance is the authority for attendance business decisions only.
- Every request/event is institution-scoped, authenticated, auditable and idempotency-aware.
- No browser input proves academic authority.
- A dependency outage cannot be silently treated as authorisation; online initiation or confirmation is denied until Academic Core/IAM confirmation succeeds.
- Contract implementation remains out of scope.

## 2. Academic Core

### 2.1 Synchronous assignment validation

Attendance makes a synchronous authoritative Academic Core validation:

- when a teacher initiates an online attendance session; and
- when that teacher confirms an online attendance session.

The response must prove, at minimum:

- institution;
- acting teacher;
- TeacherAssignment reference;
- activity status;
- applicable academic year/class/subject context; and
- validity at the decision time.

Missing, inactive, expired or institutionally incompatible assignment causes a fail-closed rejection.

### 2.2 Placement change event

While a session is OPEN, Academic Core supplies placement changes as signed events. Attendance must:

1. verify the event identity, signature, institution and reference compatibility;
2. apply only valid, ordered/idempotent changes to the open roster; and
3. reconcile the eligible roster with authoritative Academic Core data before confirmation.

After confirmation, the roster is historical. Later placement changes cannot silently rewrite it.

## 3. IAM / Institutional Context

Before every Attendance action, the contract must establish:

- acting identity;
- institution membership/relationship;
- relevant role or relationship (teacher, coordination, guardian or learner);
- policy evaluation result; and
- immutable policy-version reference.

If these cannot be confirmed at action time, access/action is denied. Offline capture is the defined exception only for a previously verified, valid cached TeacherAssignment and remains subject to server validation on synchronisation.

## 4. Documents Foundation

Attendance never stores or verifies document bytes.

For justification evidence:

1. Attendance requests or receives a Documents Foundation **provisional association** to the permitted justification process.
2. Documents Foundation controls the file’s technical verification/access state.
3. Attendance records the business decision that determines whether the evidence is accepted for the justification.
4. A technically available document does not make a justification approved; an attachment failure/quarantine cannot be bypassed.

The later contract must identify document reference, institution, justification process, learner context, submitting actor, category, association state, event identifier and idempotency behaviour.

## 5. Notifications and report delivery

- In-system notification is the mandatory canonical channel.
- Additional channels follow institutional policy.
- Mandatory delivery failure retries automatically and escalates after the policy deadline.
- Report exports are e-mail attachments (PDF/CSV).
- Before generating/sending an export, Attendance validates requester authority, approved scope and the address specified by the authorised requester for that delivery.
- The request, recipient-validation outcome, content scope, send outcome and policy version are auditable.
- No public URL, no unvalidated recipient, no future revocation claim.

## 6. Required event/control semantics before implementation

Each integration contract must specify:

- producer/consumer identity and signature/authentication;
- institution, actor and business-reference fields;
- event/request identifier and idempotency strategy;
- creation/expiry times;
- ordering and replay behaviour;
- retry, timeout and failure-queue rules: repeated delivery failure is recorded, retried and escalated to a failure queue;
- audit fields; and
- invalid-reference response.

Asynchronous events are delivered at least once; Attendance must implement idempotent recipient processing. Duplicate delivery cannot create duplicate roster changes, evidence links, alerts, decisions or audit outcomes.

## 7. Explicit exclusions

- Finance has no contract, event or dependency in Attendance-01.
- Attendance does not receive or retain file bytes.
- Attendance does not become the authority for placement, TeacherAssignment, identity or policy membership.
- No implementation work follows from this document.
