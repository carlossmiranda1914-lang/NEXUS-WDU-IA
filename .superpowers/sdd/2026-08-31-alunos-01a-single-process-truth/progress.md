# SDD ledger — plan: docs/superpowers/plans/2026-08-31-alunos-01a-single-process-truth.md

## Pre-flight

- Branch/base: `codex/alunos-01a-design` at `545b1fff664f279da9bf8084da1ecac79fa34fd7`; worktree clean before Task 1.
- Mission authority: `ALUNOS-01A` is `IMPLEMENTING`; the `ALUNOS-01A.2` addendum explicitly authorises SDD execution.
- Preflight: `npm run nexus:preflight` executed before implementation.

## Plan interface scan

| Tasks | Shared interface/file | Producer → consumer | Finding / ruling |
| --- | --- | --- | --- |
| T1 → T2 | `enrollment-lifecycle-presentation.ts` | Canonical-process adapter → approved human terminology | Compatible. T2 may map only the T1 model; server projection remains authority. |
| T2 → T3 | `EnrollmentOperationsWorkspace.tsx` | Unified labels → Journey Rail | Compatible. T3 consumes factual membership only; it cannot reintroduce status-count authority. |
| T3 → T4 | `EnrollmentOperationsWorkspace.tsx` | Selected Journey stage → Process Drawer detail | Compatible. Drawer remains a selected-process detail, preserving existing functions. |
| T4 → T5 | `EnrollmentOperationsWorkspace.tsx` | Drawer continuity → semantic motion/visual hierarchy | Compatible. T5 may represent only interaction or server-confirmed state and must preserve reduced motion. |
| T5 → T6 | workspace + mission/state docs | final UI behavior → UAT evidence | Compatible. T6 records observed validation only; it does not add product behavior. |

Ruling: No internal task contradiction was found. `Preparação` groups P02/P03 only through the canonical process projection; no task permits a client lifecycle/state authority.

## Task 1 fix-round ruling

Ruling: The existing lifecycle-presentation regression must be updated to assert the approved canonical-projection adapter rather than the superseded status-count behavior. Task 1 must not modify the Workspace or introduce a process-list HTTP route merely to satisfy that old test: the plan assigns factual selection/filtering to Task 3, and its Task 1 file scope limits production changes to the lifecycle adapter unless `enrollment-process-api.ts` is required by evidence. Cost if wrong: Task 3 may need an explicit server-read contract; that is preferable to silently expanding Task 1 without tenant/authorization proof.

Task 1: complete — final checkpoint `f0184dee23d5c18f461602e657facc01828ca065`; RED/GREEN canonical projection adapter, lifecycle/process contracts and lint/diff green; independent review approved after two scoped fix rounds.

Task 2: IMPLEMENTED — unified human terminology maps the frozen Task 1 process projection to Entrada, Preparação, Documentos, Verificação, Decisão and Ativação; Aluno ativo remains the distinct Active Students result. The Process Drawer uses the same mapper while retaining its server-provided substage label and evidence. No backend key, process authority, filter route or Task 3 rail behavior changed. Focused terminology, drawer and lifecycle contracts are GREEN.

Task 2: complete — checkpoint `5682a9b4f46ad884d6470fea114643bd9c8048f0`; focused terminology/drawer/lifecycle contracts and lint/diff green; independent review approved with no findings.

Task 3: complete — final checkpoint `5cf66124875ce8e1d7d4c802febb0d212bb2e900`; one factual Journey Rail replaces the metric-card process surface; focused workspace/Active Students/lifecycle contracts and lint/diff green; independent review approved after the legacy contract correction.

Task 3: IMPLEMENTED — the Overview retains one responsive Journey Rail and removes the four large operational metric cards. The rail loads the existing, tenant-authorized per-enrollment process projection, retains exact canonical `enrollmentIds`, and filters list rows only by that membership. If any process projection cannot be confirmed, the rail fails closed with a refreshable message rather than a status-derived substitute. Active Students remains the existing distinct server projection.

## Task 1 — Single Process Truth Adapter

- Status: IMPLEMENTED; fix round 2 complete; pending independent review.
- RED: `tests/alunos-01a-single-process-truth-contract.test.ts` failed against the prior status-count adapter because it did not consume `EnrollmentProcessProjection`.
- GREEN: the adapter groups only exact server projection membership (`P02`/`P03` → `Preparação`) and retains exact `enrollmentIds` for factual Journey filtering. It does not alter schema or server authority.
- Fix round 1 scope expansion was reverted under the controller ruling: Task 1 introduces no Workspace change, process-list HTTP route, or bulk API. `tests/alunos-01a-lifecycle-presentation.test.ts` is now a projection-only characterization with canonical P01–P06 and active-result fixtures; the focused contract covers the complete mapping and membership.

## Task 4 — Drawer Continuity

- Status: IMPLEMENTED; pending independent review.
- RED: `tests/alunos-01a-drawer-continuity-contract.test.ts` identified the prior `Etapas do processo` grid as a competing drawer lifecycle.
- GREEN: the drawer labels the server-derived human stage, presents factual backend substages as detail, and groups `P02`/`P03` only under `Preparação`. Existing blockers, next action, evidence, version/concurrency detail, lifecycle actions and document checklist remain in place.
- No API, schema, authority or motion behavior changed. The activation HTTP regression is not executable in this isolated worktree because dependencies are absent; it fails module resolution before any test setup.
