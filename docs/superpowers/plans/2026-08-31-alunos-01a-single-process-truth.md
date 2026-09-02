# ALUNOS-01A Single Process Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Alunos & Matrículas present one server-derived operational journey from Enrollment intake to Student Record, without changing domain authority.

**Architecture:** Reuse the canonical Enrollment process projection as the single truth source for both Overview Journey Rail and selected-process detail. Keep the existing drawer and document authority; remove the separate metric-card process surface, unify human terminology, then add semantic server-confirmed motion and finish with real UAT.

**Tech Stack:** React/TypeScript, Express, PostgreSQL, existing Enrollment/Student Context APIs, Tailwind utility classes, repository test/quality scripts.

**Spec:** `docs/superpowers/specs/2026-08-31-alunos-01a-single-process-truth-design.md`

## Global Constraints

- Enrollment lifecycle authority remains server-side.
- No second client state machine.
- No schema change.
- Preserve Process Drawer, document requirements P0, activation authority, opaque `studentRef`, Active Students and Student Record.
- Motion may represent only interaction or server-confirmed state.
- Physical upload/storage, Finance and post-activation Student writes remain out of scope.

---

### Task 1: Single Process Truth Adapter

**Files:**
- Modify: `src/modules/enrollments/enrollment-lifecycle-presentation.ts`
- Modify only if required by evidence: `src/modules/enrollments/enrollment-process-api.ts`
- Test: `tests/alunos-01a-single-process-truth-contract.test.ts`

**Interfaces:**
- Consumes: canonical process projection (`currentStage`, `stages`, `progress`, `blockers`, `nextAction`).
- Produces: human Journey steps derived from server process truth; no synthetic preparation count.

- [ ] Write a failing contract proving the Journey cannot use status-count heuristics as process authority and `Preparação` cannot be hardcoded to zero.
- [ ] Run `npx tsx tests/alunos-01a-single-process-truth-contract.test.ts` and confirm RED.
- [ ] Implement the smallest adapter from canonical process projection to the approved human stages.
- [ ] Prove no new client state machine and no backend authority/schema change.
- [ ] Run the focused contract plus existing lifecycle/process tests to GREEN.
- [ ] Commit only Task 1 files and record the checkpoint in the SDD ledger.

### Task 2: Unified Human Terminology

**Files:**
- Modify: `src/modules/enrollments/enrollment-lifecycle-presentation.ts`
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Test: `tests/alunos-01a-human-terminology-contract.test.ts`

**Interfaces:**
- Consumes: Task 1 human Journey model.
- Produces: one top-level vocabulary across Overview, list filtering and drawer headings.

- [ ] Write RED assertions for the approved labels: `Entrada`, `Preparação`, `Documentos`, `Verificação`, `Decisão`, `Ativação`, `Aluno ativo`.
- [ ] Assert legacy top-level `Identificação` and `Financeiro` are not presented as competing Journey stages.
- [ ] Implement mapping only; preserve backend keys and substage evidence.
- [ ] Run terminology, process-drawer and lifecycle contracts to GREEN.
- [ ] Commit Task 2 and update the ledger.

### Task 3: One Journey Rail

**Files:**
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Test: `tests/alunos-01a-one-journey-ui-contract.test.ts`

**Interfaces:**
- Consumes: Task 1/2 Journey model.
- Produces: single primary lifecycle UI and factual stage selection/filtering.

- [ ] Write RED proving the four large operational metric cards are not a second process surface.
- [ ] Preserve useful counts only as compact contextual indicators inside/adjacent to the Journey Rail.
- [ ] Make Journey selection filter/navigate using factual server-derived stage membership.
- [ ] Ensure desktop and mobile have one mental model, not separate pipelines.
- [ ] Run Journey, Active Students and workspace UI contracts to GREEN.
- [ ] Commit Task 3 and update the ledger.

### Task 4: Drawer Continuity

**Files:**
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Preserve: `src/components/EnrollmentDocumentChecklist.tsx`
- Test: `tests/alunos-01a-drawer-continuity-contract.test.ts`

**Interfaces:**
- Consumes: selected process projection and Task 2 terminology.
- Produces: drawer as detail/substeps of the selected Journey stage.

- [ ] Write RED proving the drawer identifies the selected human stage and presents backend substages as detail, not a competing top-level lifecycle.
- [ ] Preserve blockers, nextAction, evidence, version/concurrency, checklist and authorized actions.
- [ ] Make `Preparação` reconcile P02/P03 details without inventing state.
- [ ] Run drawer, document-requirements and activation interaction regressions to GREEN.
- [ ] Commit Task 4 and update the ledger.

### Task 5: Nexus Motion and Visual Hierarchy

**Files:**
- Modify: `src/components/EnrollmentOperationsWorkspace.tsx`
- Test: `tests/alunos-01a-journey-motion-contract.test.ts`

**Interfaces:**
- Consumes: final Journey/Drawer behavior from Tasks 1–4.
- Produces: premium Nexus interaction language with reduced-motion fallback.

- [ ] Write RED for semantic motion hooks/classes and `prefers-reduced-motion` fallback.
- [ ] Add restrained stage-selection, drawer and server-confirmed transition feedback only.
- [ ] Refine dark/light hierarchy using existing Nexus green and controlled graphite/blue depth; do not add a new dashboard/card wall.
- [ ] Verify focus-visible remains distinct from selection.
- [ ] Run visual/motion, responsive, lint and build proofs to GREEN.
- [ ] Commit Task 5 and update the ledger.

### Task 6: Real Enrollment-to-Student UAT Gate

**Files:**
- Update evidence only: `docs/roadmap/missions/ALUNOS-01A.md`
- Update state only after factual validation: `docs/operations/ACTIVE_MISSION.md`, `docs/operations/PROJECT_STATE.md`
- Reuse existing UAT/bootstrap and regression tests.

**Interfaces:**
- Consumes: Tasks 1–5 plus existing document-requirements P0, activation→`studentRef`, Active Students and Student Record.
- Produces: engineering evidence and a portal ready for human acceptance.

- [ ] Run affected PostgreSQL/HTTP regressions: Enrollment process/documents/activation, Active Students, Student Context, tenant/privacy/read-only.
- [ ] Run lint, build, secret scan, `git diff --check`, and canonical quality gate with authorized local DB configuration.
- [ ] Validate the real portal journey: `Entrada → Preparação → Documentos → Verificação → Decisão → Ativação → Aluno ativo → Registo do Aluno`.
- [ ] Verify pending/submitted documents block, verified requirements release the gate, activation returns the correct opaque `studentRef`, and the active student appears once.
- [ ] Inspect desktop, 768px, 390px, dark, light, keyboard and reduced motion; do not claim unobserved states.
- [ ] Stop at `READY FOR HUMAN UAT`; do not mark mission DONE or merge.

## SDD Execution Rule

Use a fresh implementer subagent for each task, then an independent task review. Record every completed task checkpoint and ruling in the plan-specific SDD ledger. Do not re-dispatch tasks marked complete. Do not stop for ordinary implementation/test defects; fix and continue. Stop only for destructive/security-sensitive external action, shared-branch side effect, or a genuine spec contradiction where every path is guesswork.
