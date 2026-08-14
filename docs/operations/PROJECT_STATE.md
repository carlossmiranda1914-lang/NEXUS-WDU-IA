# NEXUS Project State

Updated: 2026-08-14

This file records the current factual engineering state only. It is not a historical diary and must not contain planned work presented as implemented.

## 1. Repository and working model

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Canonical local checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- `main` contains the audited S01 and S02 Secretariat foundations after merge of PR #61.
- Existing repository documentation already contains architecture, mission, product and Definition-of-Done material. This control layer references those documents instead of replacing them.

## 2. Secretariat vertical status

### S01 — DONE

S01 established the operational Secretariat workspace and its visual/interaction foundation. Its regression gates remain part of the Secretariat quality gate.

### S02 — DONE

S02 provides the real enrollment intake foundation:

- explicit new-student versus existing-student intent;
- protected server-side Person resolution;
- idempotent enrollment intake;
- enrollment lifecycle actions;
- enrollment document domain/API;
- versioned document requirements and enrollment snapshots;
- validation gates for missing document policy / unverified required documents;
- document checklist UI integration;
- full-registration profile work for student/guardian/enrollment administrative data;
- PostgreSQL-backed registration and schema-drift regressions;
- Academic Year temporal closure with institution-scoped historical filtering.

The former existing-student HTTP 500 caused by persistent-schema drift on `people.birth_date` is closed by forward-only migration `0015_s02_existing_student_schema_reconciliation.sql` and permanent PostgreSQL regression. The audited S02 head passed the remote Secretariat Quality Gate before integration into `main`.

## 3. Current active priority

### S03 — Professional enrollment process and persisted stages

Issue #38 is the active functional priority and owns the implementation contract.

S03 must turn an enrollment into a resumable institutional process whose progress, blockers, responsibility and next action are derived from real persisted domain state. It must not become a second source of truth for identity, registration, documents, Academic Year, offers or lifecycle.

The S03 contract is constrained by the canonical Enrollment + Student 360 blueprint: `Entrada -> Resolver identidade -> Resolver relações -> Elegibilidade/oferta -> Checklist -> Recolha/verificação -> Ready for decision`. S03 ends at a technically and operationally valid `validated` enrollment ready for the later activation/handoff phase.

S03 explicitly does not implement later roadmap scope:

- S04 owns institutional requirement configuration;
- S05 owns `validated -> active` activation and downstream Student 360 handoff;
- S07 owns real Finance integration.

Until those domains exist, S03 must not display synthetic completion, financial state or downstream activation. Future-domain steps are omitted from the S03 progress model rather than faked.

The implementation contract preserves the existing enrollment lifecycle statuses in `enrollment-policy.ts`; process/stage persistence may orchestrate those states but may not introduce a competing enrollment state machine.

The first implementation slice must prioritize backend/domain persistence and API contracts before frontend orchestration. UI becomes READY only after the persisted process projection and transition gates are proven with PostgreSQL.

## 4. Academic-year work

Academic-year governance implements:

`draft -> active -> closed`

with a single active academic year per institution and authority reserved for appropriate institutional roles.

`GET /api/enrollments` accepts an optional institution-scoped `academicYearId` for historical reads. Historical queries do not change the active institutional year. Enrollment context exposes only active offers belonging to an active year.

## 5. Known operational risks / non-blocking debt

- Server startup `DB-INIT` is not a substitute for migration/preflight gates; deployment operations must continue to run explicit schema verification.
- Build retains pre-existing bundle-size and direct-eval warnings that are not S03 blockers but remain technical debt.
- Historical conversation handoffs may be stale relative to the repository. Use them as context, never as final source of truth.
- The historical local stash must not be destroyed by unrelated work.

## 6. Existing canonical documentation

Do not duplicate these subjects in new files without a clear reason:

- Architecture: `docs/ARCHITECTURE_V4.md` and `docs/architecture/`
- Definition of Ready/Done/Evidence: `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- Codex workflow: `docs/WORKFLOW_CODEX.md`
- Mission template: `docs/MISSION_CODEX_TEMPLATE.md`
- Canonical source hierarchy: `docs/product/NEXUS_CANONICAL_SOURCES.md`
- Enrollment + Student 360 blueprint: `docs/product/MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md`
- Product decisions: `docs/product/`
- Mission records: `docs/missions/`

## 7. Update rule

Update this file only when one of these changes materially:

- active priority;
- release-blocking defect status;
- branch/release state;
- major implemented capability;
- major verified architectural risk.

Do not append day-by-day logs here. Use commits, PRs, issues and mission evidence for history.
