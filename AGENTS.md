# NEXUS Agent Operating Contract

This file is the persistent operating contract for any coding agent working in this repository.
It is intentionally short. Detailed architecture, product decisions, evidence and mission history live in the existing docs tree and canonical Drive sources and must not be duplicated here.

## 1. Source of truth

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Local canonical checkout: `C:\Users\Administrador\NEXUS-WDU-IA-main`.
- Git and committed repository documentation are the source of truth for code and engineering state.
- Canonical Google Drive documents are authoritative for approved product planning, operational reality, architecture detail and visual identity when listed by `docs/product/NEXUS_CANONICAL_SOURCES.md`.
- Chat history, local agent memory and temporary prompts are not authoritative.
- Never infer that planned work is implemented. Verify code, migrations, tests and CI.
- Never invent a product, UX, visual or architecture rule when an applicable canonical source exists. Consult it.

## 2. Required reading before code changes

Read, in this order:

1. `AGENTS.md`
2. `docs/operations/PROJECT_STATE.md`
3. `docs/operations/ENGINEERING_PLAYBOOK.md`
4. `docs/product/NEXUS_CANONICAL_SOURCES.md`
5. `docs/operations/AGENT_TRAINING_AUTOMATION.md` when the task involves APIs, debugging, critical domains, CI, automation or autonomous execution.
6. The relevant existing architecture/product documents for the task.
7. When the task concerns product behavior, planning, UX, visual design, palette or a domain rule not fully represented in the repository, consult the applicable canonical Google Drive source identified in `NEXUS_CANONICAL_SOURCES.md` before implementation.

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

## 4. Canonical-source discipline

Before a mission is considered READY, identify the applicable source level from `docs/product/NEXUS_CANONICAL_SOURCES.md`:

- Level A: constitution, architecture and invariants;
- Level B: product strategy and operational reality;
- Level B-V: visual identity and design authority;
- Level C: domain/vertical blueprint;
- Level D: issue, task, implementation and evidence.

If two sources conflict, do not silently choose the easier implementation. Apply the documented precedence, record the conflict and block the affected decision if precedence does not resolve it.

For visual work, the current normative authority is `Nexus_Edu_IA_Padrao_Visual_e_Paleta_Oficial_v1_0.docx` in Drive. Its Nexus Aurora green token system supersedes conflicting historical blue/cyan color tokens in older design-system material.

## 5. Work discipline

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

## 6. Critical-domain rules

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

## 7. Frontend and UX

- The interface must remain simple, minimal, functional and progressive.
- Do not expose several complex panels at once when a progressive flow is clearer.
- Mobile is a real requirement, not a secondary enhancement.
- Frontend changes require visual validation in desktop and mobile widths.
- A compiled UI is not proof of a usable workflow.
- Backend authorization and business rules remain authoritative even when the UI blocks an action.
- Visual implementation must use semantic tokens rather than arbitrary per-component hex values.
- The official visual direction is Nexus Aurora: clarity first, controlled vibrancy, visible trust and functional futurism.
- Official modes are Claro, Escuro, Tonal Nexus and Seguir dispositivo; Claro is the default unless a persisted/device preference applies.
- `action.primary` is the dominant action color; `ai.primary` must not compete with it.
- Lime/gradients are accents, not recurring backgrounds.
- No important state may depend on color alone.
- Before substantial UI work, consult the official visual source in Drive and the visual contract recorded in `NEXUS_CANONICAL_SOURCES.md`.

## 8. Definition of done

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
- canonical product/visual sources checked when applicable;
- no known blocking defect left in the target workflow;
- current state documentation updated when the project status materially changes.

Use `docs/DEFINITION_READY_DONE_EVIDENCE.md` as an additional existing reference rather than duplicating its full content here.

## 9. Session recovery

At the start of a new agent session:

1. Read the required files listed above.
2. Run the applicable Nexus preflight.
3. Compare the documented current state with repository reality.
4. If they conflict, repository reality wins for implementation state and `PROJECT_STATE.md` must be corrected.
5. For product intent, architecture or visual rules, resolve uncertainty against the applicable canonical source hierarchy rather than repository implementation accidents.
6. Resume only the stated active priority unless the user explicitly changes priorities.

## 10. Documentation hygiene

- Keep filenames ASCII and without spaces for operational control documents.
- Keep `PROJECT_STATE.md` factual and current; do not turn it into a historical diary.
- Keep durable rules in `ENGINEERING_PLAYBOOK.md`.
- Keep detailed architecture/product/history in the existing docs that already own those subjects.
- Avoid creating new documentation files when an existing canonical document can be updated instead.
- Do not copy entire Drive documents into the repository. Maintain a concise canonical index/implementation contract and consult the original source for normative detail.
