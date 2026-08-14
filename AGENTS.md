# NEXUS Agent Operating Contract

This file is the persistent operating contract for any coding agent working in this repository.
It is intentionally short. Detailed architecture, product decisions, evidence and mission history live in the existing docs tree and must not be duplicated here.

## 1. Source of truth

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Local canonical checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- Git and committed repository documentation are the source of truth for code and engineering state.
- Chat history, local agent memory and temporary prompts are not authoritative.
- Never infer that planned work is implemented. Verify code, migrations, tests and CI.

## 2. Required reading before code changes

Read, in this order:

1. `AGENTS.md`
2. `docs/operations/PROJECT_STATE.md`
3. `docs/operations/ENGINEERING_PLAYBOOK.md`
4. `docs/operations/AGENT_TRAINING_AUTOMATION.md` when the task involves APIs, debugging, critical domains, CI, automation or autonomous execution.
5. The relevant existing architecture/product documents for the task.

Useful existing references include:

- `docs/ARCHITECTURE_V4.md`
- `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- `docs/WORKFLOW_CODEX.md`
- `docs/MISSION_CODEX_TEMPLATE.md`
- `docs/product/`
- `docs/architecture/`
- `docs/missions/`

Do not replace or duplicate these documents without a concrete reason.

## 3. Mandatory preflight

Before production changes, run:

`npm run nexus:preflight`

Before enrollment, identity, migrations or other database-critical work, run:

`npm run nexus:preflight:db`

The preflight is read-only. It may inspect Git, documentation, package scripts, migration ordering and PostgreSQL schema compatibility, but it must not pull, stash, migrate, create data or mutate the working tree.

If the result is `BLOCKED`, diagnose and resolve the blocker before implementation. Warnings require review but do not automatically authorize destructive cleanup.

## 4. Work discipline

For every production change:

`diagnose -> define invariant -> minimal change -> focused test -> regression -> static checks -> build -> visual validation when applicable -> evidence -> commit`

Rules:

- Work by functional priority, not by a stream of disconnected microtasks.
- Diagnose before editing.
- Prefer the smallest reversible change that solves the root cause.
- Preserve unrelated working-tree changes.
- Do not use `git reset --hard`, `git clean`, destructive checkout, force push or history rewriting unless explicitly authorized for a verified recovery case.
- Do not weaken tests or CI merely to obtain a green result.
- Do not mask backend failures with generic frontend messages or mocks.
- Do not introduce fake operational data into production paths.
- Never trust a browser-supplied global identity/person authority value.
- Institutional isolation is mandatory for every read and write path.

## 5. Critical-domain rules

Enrollment, identity, academic-year governance, documents and financial/student lifecycle boundaries are critical paths.

For critical paths:

- PostgreSQL-backed tests are required where persistence or concurrency matters.
- Idempotency must be explicit for retryable creation operations.
- Partial creation must not be silently accepted.
- Duplicate Person/Student creation must be prevented by server-side rules.
- Database schema compatibility must be verified before operational writes.
- Migrations must be deterministic, reviewable and tested in isolation.
- Error handling must distinguish domain rejection from unexpected server failure.
- A generic HTTP 500 in a normal user workflow is a release blocker until root cause is identified.

## 6. Frontend and UX

- The interface must remain simple, minimal, functional and progressive.
- Do not expose several complex panels at once when a progressive flow is clearer.
- Mobile is a real requirement, not a secondary enhancement.
- Frontend changes require visual validation in desktop and mobile widths.
- A compiled UI is not proof of a usable workflow.
- Backend authorization and business rules remain authoritative even when the UI blocks an action.

## 7. Definition of done

A task is not DONE because code exists or compiles.

DONE requires, as applicable:

- requirement/invariant implemented;
- focused automated test passed;
- relevant regression tests passed;
- PostgreSQL test passed for persistence-critical changes;
- migrations verified;
- TypeScript/lint/static checks passed;
- production build passed;
- visual flow validated for user-facing changes;
- no known blocking defect left in the target workflow;
- current state documentation updated when the project status materially changes.

Use `docs/DEFINITION_READY_DONE_EVIDENCE.md` as an additional existing reference rather than duplicating its full content here.

## 8. Session recovery

At the start of a new agent session:

1. Read the required files listed above.
2. Run the applicable Nexus preflight.
3. Compare the documented current state with repository reality.
4. If they conflict, repository reality wins and `PROJECT_STATE.md` must be corrected.
5. Resume only the stated active priority unless the user explicitly changes priorities.

## 9. Documentation hygiene

- Keep filenames ASCII and without spaces for operational control documents.
- Keep `PROJECT_STATE.md` factual and current; do not turn it into a historical diary.
- Keep durable rules in `ENGINEERING_PLAYBOOK.md`.
- Keep detailed architecture/product/history in the existing docs that already own those subjects.
- Avoid creating new documentation files when an existing canonical document can be updated instead.
