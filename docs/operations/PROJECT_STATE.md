# NEXUS Project State

Updated: 2026-08-14

This file records the current factual engineering state only. It is not a historical diary and must not contain planned work presented as implemented.

## 1. Repository and working model

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Canonical local checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- Main development lineage for the enrollment/Secretariat vertical has been `feature/enrollment-vertical-vnext-rebuild` and subsequent S02 branches.
- Current S02 final-closure branch: `feature/secretariat-s02-final-complete`.
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

The S02 engineering blocker is corrected and its technical closure gates pass. Issue `#37` remains open for external audit/release decision; this repository state does not activate S03.

The `Existing student` HTTP 500 was reproduced against a legacy PostgreSQL schema and traced to schema drift: Person resolution selected `people.birth_date`, while the persistent schema did not contain that column, causing PostgreSQL error `42703` and the controller's unexpected-error fallback.

The smallest owning-layer correction is forward-only migration `0015_s02_existing_student_schema_reconciliation.sql`, which adds the nullable `people.birth_date DATE` column idempotently. Historical migration `0007` remains immutable. A PostgreSQL regression now proves the same registered HTTP handler returns the generic HTTP 500 before reconciliation and `LOCAL_MATCH` after migration `0015` is applied twice.

Schema safety is now supported by a read-only DB preflight and an explicitly targeted, confirmation-gated reconciliation runner. Clean-schema migration isolation, S01/S02 regression matrices, lint, TypeScript/build gates and real browser validation are part of the S02 final-closure evidence.

Real browser validation passed in desktop and mobile widths against the dedicated test database: the safe local match was shown, the desktop flow continued to full registration, mobile had no horizontal overflow, and a repeated process start was rejected by the anti-duplication invariant.

## 3. Current active priority

### Priority: external S02 audit and release decision

Preserve the completed S02 evidence, keep issue `#37` open for independent audit/release decision, and do not start S03 until that decision explicitly selects the next priority.

## 4. Academic-year work

Academic-year governance work exists in the repository lineage and introduced the lifecycle concept:

`draft -> active -> closed`

with a single active academic year per institution and authority reserved for appropriate institutional roles.

Earlier planning material identified operational academic-year management as an important structural requirement. Before resuming or extending that work, agents must inspect current code and tests rather than rely on older handoff text, because S02 development continued after that handoff.

## 5. Known operational risks

- Server startup `DB-INIT` is not a substitute for the migration/preflight gates; deployment operations must continue to run the explicit schema contract.
- The operational migration runner is intentionally confirmation-gated; deployment evidence must identify the exact target without exposing credentials.
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
