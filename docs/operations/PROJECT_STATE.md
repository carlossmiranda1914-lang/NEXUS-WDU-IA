# NEXUS Project State

Updated: 2026-08-16

This file records the current factual engineering state only. It is not a historical diary and must not contain planned work presented as implemented.

## 1. Repository and working model

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Canonical local checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- `main` contains the audited S01/S02 line, including Academic Year temporal closure and existing-student schema reconciliation.
- Active S03 branch: `feature/secretariat-s03-process-persistence`.
- Active S03 PR: `#62`, still draft and not approved for merge while user-acceptance findings remain open.

## 2. Secretariat vertical status

### S01
DONE and integrated in `main`.

### S02
DONE and integrated in `main`, including New/Existing student intent, Person Resolution, idempotent intake, registration profile, document requirements/snapshots, lifecycle gates, Academic Year temporal closure and the PostgreSQL schema-drift regression for `people.birth_date` / SQLSTATE 42703.

### S03 engineering implementation
Implemented on `feature/secretariat-s03-process-persistence` and exposed through PR #62:
- persisted enrollment-process orchestration;
- deterministic P01-P06 projection;
- institution-scoped process API;
- optimistic assignment/versioning;
- atomic process creation during intake;
- operational drawer integration;
- focused S03 policy/contract/PostgreSQL tests;
- migration 0016.

The branch quality gate is green for the existing CI matrix, but external audit found that the remote workflow run did not execute the new `test:secretariat-s03` command explicitly. CI coverage must be strengthened before merge.

## 3. Current active priority

### S03 user-acceptance and release closure

User validation on 2026-08-16 found concrete release blockers/improvements that must be resolved before PR #62 can merge:

1. **Document/readiness consistency**
   - A process can visually report `0/0` documents and state that the system does not assume a policy is configured, while P04 is shown as completed and P06 offers `Validar matrícula`.
   - This is inconsistent with the S03 contract. `Ready for decision` must not be reachable when the document policy/readiness evidence shown to the user says the document configuration is absent or unresolved.
   - Policy truth, document checklist messaging, process projection and transition gate must agree.

2. **Real document evidence is not implemented yet**
   - Current document submission stores an `evidence_reference` string; it is not binary/file storage.
   - Do not present this as physical document upload.
   - Requirement configuration remains S04 and advanced/real storage remains S06 unless roadmap is explicitly reprioritized.

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
