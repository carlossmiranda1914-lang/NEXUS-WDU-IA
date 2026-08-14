# NEXUS Project State

Updated: 2026-08-14

This file records the current factual engineering state only. It is not a historical diary and must not contain planned work presented as implemented.

## 1. Repository and working model

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Canonical local checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- Main development lineage for the enrollment/Secretariat vertical has been `feature/enrollment-vertical-vnext-rebuild` and subsequent S02 branches.
- The current knowledge-control branch was created from `feature/secretariat-s02-final-complete` to avoid mixing governance documentation with functional code changes.
- Existing repository documentation already contains architecture, mission, product and Definition-of-Done material. This control layer references those documents instead of replacing them.

## 2. Secretariat vertical status

### S01

S01 established the operational Secretariat workspace and its visual/interaction foundation. The relevant regression gates were previously validated and later included in Secretariat CI coverage.

### S02 implemented foundations

The repository contains the following implemented S02 capabilities:

- explicit new-student versus existing-student enrollment intent;
- protected server-side Person resolution;
- idempotent enrollment intake;
- enrollment lifecycle actions;
- enrollment document domain/API;
- versioned document requirements and enrollment snapshots;
- validation gates for missing document policy / unverified required documents;
- document checklist UI integration;
- full-registration profile work for student/guardian/enrollment administrative data;
- PostgreSQL-backed registration tests and S02 registration CI.

### S02 current release status

S02 must NOT yet be treated as fully closed for real-user release.

The latest manual visual validation exposed a blocking defect in the `Existing student` path:

- UI action: confirm an existing student during enrollment intake;
- observed result: generic `Nao foi possivel concluir a operacao de matricula.` error;
- backend classification: the generic controller fallback is used for an unexpected/unhandled error, therefore this is effectively an HTTP 500 path rather than a valid `NO_MATCH`, `LOCAL_MATCH` or review outcome;
- release classification: BLOCKER.

The code path depends on the vNext schema, including `people`, `student_profiles`, `enrollment_applications`, `people.birth_date`, `student_profiles.student_number` and `student_profiles.legacy_student_id`.

A structural risk was identified during diagnosis: server startup `DB-INIT` provisions/self-heals legacy operational tables, but it does not itself prove that the complete vNext enrollment migration chain is applied to the operational database. Therefore a server startup success message is not sufficient evidence that enrollment schema parity exists.

The last known local S02 final registration migration runner applied and verified the S02-final columns successfully, but that verification alone does not prove the entire historical migration chain was present in the operational database.

## 3. Current active priority

### Priority: close S02 as a real operational workflow

Do not start S03 while the existing-student enrollment path can fail with an unexpected server error.

Required closure sequence:

1. Reproduce the existing-student failure with PostgreSQL-backed evidence.
2. Prove operational schema compatibility for every table/column used by Person resolution and intake.
3. Identify the exact root cause of the unexpected error.
4. Fix the smallest correct layer; do not patch the UI to hide a backend failure.
5. Add a permanent regression test for existing-student resolution/intake.
6. Verify at least these outcomes:
   - new student / no match;
   - safe local existing-student match;
   - ambiguous/review-required match;
   - duplicate prevention;
   - idempotent retry;
   - institutional isolation;
   - persistence of full registration;
   - document and registration validation gates.
7. Run relevant S01/S02 regressions, migrations, TypeScript/static checks and production build.
8. Repeat the real browser flow in desktop and mobile widths.
9. Only then mark S02 closed and choose S03 or another product priority.

## 4. Academic-year work

Academic-year governance work exists in the repository lineage and introduced the lifecycle concept:

`draft -> active -> closed`

with a single active academic year per institution and authority reserved for appropriate institutional roles.

Earlier planning material identified operational academic-year management as an important structural requirement. Before resuming or extending that work, agents must inspect current code and tests rather than rely on older handoff text, because S02 development continued after that handoff.

## 5. Known operational risks

- Operational DB schema parity is not yet governed strongly enough by server startup evidence.
- A generic 500 remains observable in a normal existing-student enrollment user path until root cause is fixed.
- Local working trees have previously contained unrelated modified/untracked files; destructive Git operations are prohibited without explicit verified recovery intent.
- Historical conversation handoffs may be stale relative to the repository. Use them as context, never as the final source of truth.

## 6. Existing canonical documentation

Do not duplicate these subjects in new files without a clear reason:

- Architecture: `docs/ARCHITECTURE_V4.md` and `docs/architecture/`
- Definition of Ready/Done/Evidence: `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- Codex workflow: `docs/WORKFLOW_CODEX.md`
- Mission template: `docs/MISSION_CODEX_TEMPLATE.md`
- Product decisions: `docs/product/`
- Mission records: `docs/missions/`
- Existing S02.3.2 operational evidence: `docs/operations/S02_3_2_DOCUMENT_REQUIREMENTS_GATE.md`

## 7. Update rule

Update this file only when one of these changes materially:

- active priority;
- release-blocking defect status;
- branch/release state;
- major implemented capability;
- major verified architectural risk.

Do not append day-by-day logs here. Use commits, PRs, issues and mission evidence for history.
