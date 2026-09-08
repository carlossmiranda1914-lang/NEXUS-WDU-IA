# ATTENDANCE-01 — Preparation Flow

**Status:** PREPARATION IN PROGRESS — no implementation authorisation.  
**Scope:** Attendance only. Finance is explicitly out of scope and must not be analysed, planned, changed or used as a dependency shortcut.

## 1. Purpose

This flow turns confirmed product decisions into a reviewable implementation specification. It does **not** authorise code, database migration, UI delivery, background jobs, storage configuration, notifications or deployment.

## 2. Completed preparation decisions

- Attendance has no existing canonical domain; legacy/UI references are non-authoritative.
- Sessions originate from the teacher's active TeacherAssignment while no canonical timetable exists.
- First-cut units: lesson/session, school day and school activity, configurable by institution.
- Core outcome: presence or absence for every eligible learner; tardiness and missing material are separate occurrences.
- Confirmed history, policy references and corrections are immutable/revisioned.
- Justification, threshold, offline, permissions, cancellation, retention, migration, reporting and acceptance decisions are recorded in:
  - `docs/architecture/ATTENDANCE_01_PREPARATION.md`
  - `docs/architecture/ATTENDANCE_01_DATA_AUTHORITY.md`

## 3. Preparation work sequence

| Priority | Deliverable | Required result | Status |
|---|---|---|---|
| P0 | Domain audit and boundaries | No reuse of legacy Attendance; authority split with Academic Core, IAM and Documents Foundation | Complete |
| P1 | Product decisions | Session, outcome, justification, threshold, offline, permissions, reporting and retention rules recorded | Complete |
| P2 | Data authority | Entities, historical snapshot, revisions, policy traceability, retention and migration boundary | Complete |
| P3 | State and policy specification | Exact state machine, policy parameter catalogue and policy transition rules | Pending |
| P4 | Integration contracts | Academic Core/IAM/Documents Foundation proofs, events, idempotency and failure contracts | Pending |
| P5 | Security, privacy and reporting review | Offline threat model, export/e-mail controls, jurisdictional retention validation | Pending |
| P6 | UX and accessibility specification | Teacher, coordination, guardian and learner flows; offline/conflict/error states | Pending |
| P7 | Acceptance pack and Mission Pack | Test matrix, manual validation scripts, evidence locations and implementation work packages | Pending |
| Gate A | Design closure review | All P0–P7 decisions/artefacts reviewed; open decisions explicitly resolved | Not reached |
| Gate B | Implementation readiness review | Automated, integration, security and manual evidence planned and reviewable | Not reached |
| Gate C | Implementation authorisation | Explicit Product Owner authorisation only | Not granted |

## 4. Non-negotiable dependencies

1. **Academic Core:** active TeacherAssignment, academic placement and institution scope.
2. **IAM / Institutional Context:** active actor relationship, role and versioned policy evaluation.
3. **Documents Foundation:** only approved attachment/evidence contract. Attendance never stores file bytes.
4. **Jurisdictional profile:** retention, erasure and any mandatory re-evaluation rules.
5. **Notification capability:** in-system delivery and policy-enabled additional channels.
6. **Export delivery capability:** address validation before each e-mail attachment delivery and complete audit.

## 5. Mandatory control points

- No Attendance action relies on browser-supplied authority.
- No silent overwrite of a confirmed record.
- No automatic client/server merge for offline conflict.
- No cross-institution access or report export.
- No public URL or unvalidated recipient for report delivery.
- No academic sanction created automatically by Attendance.
- No historical migration without reconciliation, sample validation and audited institutional approval.
- No implementation start before the Product Owner approves readiness and separately authorises implementation.

## 6. Current next priority

**P3 — State and policy specification.** Define exact lifecycle states and transitions for sessions, outcomes, justifications, correction proposals, offline conflicts, alerts and export requests. This is still documentation work only.
