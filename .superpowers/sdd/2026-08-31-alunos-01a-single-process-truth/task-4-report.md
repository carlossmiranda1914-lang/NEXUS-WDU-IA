# Task 4 — Drawer Continuity report

## Scope

Implemented only Task 4 on `codex/alunos-01a-task4-sdd` from `5cf66124875ce8e1d7d4c802febb0d212bb2e900`.

## Implemented

- The selected process drawer explicitly identifies its current human Journey stage from `getEnrollmentJourneyLabel(process)`.
- Its previous full backend-stage grid is now a factual-substeps detail. When the server projection is at `P02` or `P03`, the drawer displays both as the details of `Preparação`; otherwise it displays the current factual backend stage only.
- Preserved server-owned blockers, next action, stage evidence, confirmed version, lifecycle actions, and the existing document checklist.

## Evidence

- PASS: `node --experimental-strip-types tests/alunos-01a-drawer-continuity-contract.test.ts`
- PASS: `node --experimental-strip-types tests/alunos-01a-document-requirements-drawer-contract.test.ts`
- PASS: `node --experimental-strip-types tests/alunos-01a-human-terminology-contract.test.ts`
- PASS: `node --experimental-strip-types tests/alunos-01a-one-journey-ui-contract.test.ts`
- PASS: `git diff --check`
- BLOCKED: `npm run nexus:preflight` and the activation HTTP regression cannot resolve dependencies in this isolated worktree (`tsx` and `express` are absent). The activation test did not start its HTTP or PostgreSQL setup.
- PRE-EXISTING/NOT TASK-4-CAUSED: `tests/alunos-01a-process-drawer-interaction.test.ts` has stale workspace-local type-string assertions; it fails against the unchanged baseline process type shape before exercising the Task 4 behavior.

## Safety

No schema, persistence, API, authority, tenancy, activation, document, or motion behavior was changed.
