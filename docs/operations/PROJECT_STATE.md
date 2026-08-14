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

S02 provides the real enrollment intake foundation, including protected Person resolution, idempotent intake, lifecycle, registration data, document requirements, schema-drift protection and Academic Year temporal closure. The audited S02 head passed the remote Secretariat Quality Gate before integration into `main`.

## 3. Current active priority

### S03 — Professional enrollment process and persisted stages

Issue #38 is the active functional priority and the authoritative implementation contract.

S03 turns an enrollment into a resumable institutional process whose progress, blockers, responsibility and next action come from real persisted domain state. It does not create a second source of truth for identity, registration, documents, Academic Year, offers or enrollment lifecycle.

Canonical process scope for S03:

`Entrada -> Identidade resolvida -> Dados/relacoes -> Oferta/contexto -> Requisitos/documentos -> Revisao -> Ready for decision`

S03 ends at an enrollment that legitimately reaches existing lifecycle state `validated`.

Roadmap boundaries:

- S04 owns institutional requirement configuration;
- S05 owns `validated -> active` and downstream Student 360 handoff;
- S07 owns Finance integration.

S03 must not fake future-domain states. It preserves the existing lifecycle in `enrollment-policy.ts`; persisted process stages orchestrate and explain that lifecycle but do not replace it.

Backend/domain persistence and API contracts are implemented and proven with PostgreSQL before frontend orchestration.

## 4. Academic-year work

Academic-year governance implements `draft -> active -> closed`, one active year per institution, explicit historical filtering and institution-scoped enrollment context.

## 5. Known operational risks / non-blocking debt

- Server startup `DB-INIT` is not a substitute for migration/preflight gates.
- Build retains pre-existing bundle-size and direct-eval warnings.
- Historical handoffs may be stale relative to repository truth.
- Historical local stash must not be destroyed by unrelated work.

## 6. Existing canonical documentation

- Architecture: `docs/ARCHITECTURE_V4.md` and `docs/architecture/`
- Definition of Ready/Done/Evidence: `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- Workflow: `docs/WORKFLOW_CODEX.md`
- Canonical source hierarchy: `docs/product/NEXUS_CANONICAL_SOURCES.md`
- Enrollment + Student 360 blueprint: `docs/product/MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md`
- Product decisions: `docs/product/`
- Mission records: `docs/missions/`

## 7. Update rule

Update only when active priority, blocker status, branch/release state, major capability or architectural risk changes materially.
