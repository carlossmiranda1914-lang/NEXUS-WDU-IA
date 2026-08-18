# NEXUS Project State

Updated: 2026-08-18

This file records the current factual engineering state only. It is not a historical diary and must not contain planned work presented as implemented.

## 1. Repository and working model

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Canonical local checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- `main` contains the audited S01/S02 line, including Academic Year temporal closure and existing-student schema reconciliation.
- The local P0 foundation line is `codex/enrollment-p0-foundation`; it contains work not yet merged or released.

## 2. Secretariat vertical status

### S01
DONE and integrated in `main`.

### S02
DONE and integrated in `main`, including New/Existing student intent, Person Resolution, idempotent intake, registration profile, document requirements/snapshots, lifecycle gates, Academic Year temporal closure and the PostgreSQL schema-drift regression for `people.birth_date` / SQLSTATE 42703.

### S03 engineering implementation
Implemented in the audited S03 line and retained in the local P0 foundation:
- persisted enrollment-process orchestration;
- deterministic P01-P06 projection;
- institution-scoped process API;
- optimistic assignment/versioning;
- atomic process creation during intake;
- operational drawer integration;
- focused S03 policy/contract/PostgreSQL tests;
- migration 0016.

S03 governs the process through `validated`. The subsequent `validated -> active` transition is the explicit P0-A operation, not a generic S03 process transition.

## 3. Current active priority

### S04 Slice 3 — validated

S04 Slice 3 is validated locally. The document-policy-to-offer and enrollment-to-policy ownership are enforceable in PostgreSQL; snapshots are immutable per enrollment; publication is institution-scoped, serialized by offer, idempotent and audited; and the integrated runtime proof covers physical upload, document verification, S03 readiness, validated transition, missing required-document blocking, and rollback after snapshot failure.

The final gate passed S03 PostgreSQL, activation, legacy-creation fences, migration isolation, TypeScript, production build and diff validation. The runtime integration exercises registered Express handlers with PostgreSQL and physical temporary storage; it is not TCP/Firebase/browser UAT. S04 backend administrative API implemented and validated, including migrations 0018–0020; the exploratory configurator was removed from the operational workspace because its institutional configuration location and canonical document taxonomy remain pending. End-to-end authenticated browser UAT of the Secretariat foundation remains pending. Implementation is frozen for the Master Plan audit.

### P0 foundations implemented locally, pending normal integration/release

- P0-A: minimum atomic activation (`validated -> active`) updates enrollment and `student_profile` together, behind the explicit `/activate` operation.
- P0 documentary foundation: private physical-file storage metadata and backend-authorized upload/download are implemented; this is minimum S06 groundwork, not full S06 delivery.
- P0-B: local legacy-creation fences prevent the normal legacy paths from creating new `students`; this is not a full legacy data reconciliation.

### Historical S03 user-acceptance findings

User validation on 2026-08-16 found concrete release blockers/improvements that must be resolved before PR #62 can merge:

1. **Document/readiness consistency**
   - A process can visually report `0/0` documents and state that the system does not assume a policy is configured, while P04 is shown as completed and P06 offers `Validar matrícula`.
   - This is inconsistent with the S03 contract. `Ready for decision` must not be reachable when the document policy/readiness evidence shown to the user says the document configuration is absent or unresolved.
   - Policy truth, document checklist messaging, process projection and transition gate must agree.

2. **Real document evidence is not implemented yet**
   - Current document submission stores an `evidence_reference` string; it is not binary/file storage.
   - Do not present this as physical document upload.
   - Requirement configuration remains S04. Physical file storage is now available as a minimum P0/S06 foundation; full S06 scope remains uncompleted.

3. **Visual consistency / Nexus Aurora**
   - S03 drawer uses the new green/Aurora direction, but the parent `Alunos & Matrículas` workspace still contains blue/indigo accents and inconsistent visual language.
   - User validation also found typography/hierarchy and spacing inconsistencies in list rows, including text collisions/overflow in the enrollment list.
   - Correction must use canonical design tokens and the official visual system, not ad-hoc replacement colors.

4. **Enrollment list layout**
   - Rows must preserve stable vertical rhythm and separation of student name, status, next action, offer/year and updated date at desktop and responsive widths.
   - No text collision or content escaping its row/card is acceptable.

5. **Deletion semantics**
   - Production enrollment/process records must not receive casual hard-delete behavior because audit/history are required.
   - Existing lifecycle cancellation remains the production-safe operation.
   - If local test-data cleanup is needed, implement a separately guarded `TEST_DATABASE_URL`-only purge tool or equivalent non-production capability; it must never target production silently.

6. **CI**
   - `Secretariat Quality Gate` must execute the S03 focused suite explicitly on the PR head before release.

## 4. Release rule for PR #62

Do not merge PR #62 until all of the following are true:
- document policy/readiness inconsistency is corrected and regression-tested;
- S03 focused tests execute explicitly in remote CI;
- list/drawer visual defects raised in user acceptance are corrected and revalidated in desktop/tablet/mobile;
- Nexus Aurora tokens/style are applied consistently to the touched Secretariat surface;
- no unsafe production hard-delete is introduced;
- user acceptance is repeated successfully;
- external audit confirms PASS.

## 5. Academic-year work

Academic-year governance remains integrated and verified:
- lifecycle `draft -> active -> closed`;
- at most one active year per institution;
- institution-scoped historical enrollment filtering;
- historical reads do not change the active year;
- active offers attached to draft academic years are not exposed for new enrollment.

## 6. Known operational risks

- Server startup `DB-INIT` is not a substitute for migrations/preflight.
- Operational migration tools must remain explicit-target and confirmation-gated.
- Destructive Git operations are prohibited without verified recovery intent.
- Hard deletion of real enrollment history is not an acceptable default operation.
- Historical conversation handoffs may be stale relative to repository state.

## 7. Existing canonical documentation

Do not duplicate these subjects without a clear reason:
- Architecture: `docs/ARCHITECTURE_V4.md` and `docs/architecture/`
- Definition of Ready/Done/Evidence: `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- Codex workflow: `docs/WORKFLOW_CODEX.md`
- Product decisions and visual authority: `docs/product/`
- Mission records: `docs/missions/`

## 8. Update rule

Update this file only when one of these changes materially:
- active priority;
- release blocker status;
- branch/release state;
- major implemented capability;
- major verified architectural/product risk.

Do not append day-by-day logs here. Use commits, PRs, issues and mission evidence for history.
