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

## Task 1 — Single Process Truth Adapter

- Status: IMPLEMENTED; fix round 1 complete; pending independent review.
- RED: `tests/alunos-01a-single-process-truth-contract.test.ts` failed against the prior status-count adapter because it did not consume `EnrollmentProcessProjection`.
- GREEN: the adapter groups only exact server projection membership (`P02`/`P03` → `Preparação`) and retains exact `enrollmentIds` for factual Journey filtering. It does not alter schema or server authority.
- Fix round 1: the review-established P1 was resolved with the authorized read-only `/api/enrollments/processes` bulk projection. The workspace feeds those server projections to the Journey and filters exact `enrollmentIds`, not broad status counts. `tests/alunos-01a-lifecycle-presentation.test.ts` is GREEN with canonical P01–P06 and active-result fixtures; the focused contract covers the complete mapping and membership.
