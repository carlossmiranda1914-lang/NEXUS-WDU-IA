# Nexus Edu IA — Implementation Workflow

**Status:** CANONICAL engineering workflow  
**Tool policy:** tool-neutral. Codex, ChatGPT, local IDEs or other agents may assist, but no tool is an authority.

## 1. Core rule

`diagnose → canonical sources → scope → invariants → Mission Pack → readiness gate → minimal implementation → focused tests → regression → static/build → user validation → evidence → review → integration`.

Implementation does not begin when diagnosis, authority, scope or evidence plan is unclear.

## 2. One active implementation mission

Only one implementation mission may be active for the same critical dependency chain unless parallel work has explicit non-overlapping ownership and integration contracts.

Side suggestions do not become tasks automatically.

## 3. Before editing

The implementer/agent must:

1. read `docs/README.md`;
2. read `docs/operations/PROJECT_STATE.md`;
3. read the active Mission Pack;
4. inspect repository/branch/working state;
5. verify the relevant canonical product, architecture, audit and ADR sources;
6. state IN/OUT scope, invariants and stop rules;
7. identify the evidence that will prove DONE.

If repository reality conflicts with documentation, stop and reconcile the conflict before broad implementation.

## 4. Change standard

Prefer one functional objective per change set, small reviewable diffs, explicit migrations, deterministic tests and separation of domain/application policy from HTTP/UI glue.

Avoid broad rewrites, unrelated cleanup, opportunistic redesign and new abstractions without a current use case.

## 5. Critical-path gates

For identity, tenancy, enrollment, academic authority, documents, finance, audit and AI, applicable gates include:

- explicit domain states/invariants;
- backend authorization and tenant isolation;
- PostgreSQL-backed persistence tests;
- transaction/idempotency behavior;
- migration-chain proof;
- explicit API failure semantics;
- focused and regression tests;
- static/type/build checks;
- user-visible loading/error/success states;
- desktop/tablet/mobile validation where exposed;
- audit/evidence for critical writes.

## 6. Database rule

Versioned migrations are the schema-evolution authority. Runtime startup validates prerequisites and fails closed; it does not silently repair business schema and continue as healthy.

## 7. Git safety

Before writing, inspect branch/status and unrelated work. Destructive reset/clean/force operations require explicit authorization and verified recovery intent. Preserve unrelated local/remote state.

## 8. AI/agent safety

An agent must not:

- expand scope because it discovered adjacent problems;
- infer product authority from legacy code;
- weaken tests to obtain green CI;
- convert real failures into visual success;
- bypass backend policies through direct database/tool writes;
- merge/deploy without the mission's explicit release authority.

## 9. Evidence

Completion evidence records: changed areas, invariant, focused tests, regressions, migration/database proof, static/build result, visual/user validation, tenant/security evidence when applicable and remaining risks.

If a known acceptance blocker remains, the mission is not DONE.

## 10. Recovery/handoff

A new implementer should be able to recover from repository documentation rather than chat history:

1. `docs/README.md`;
2. `docs/operations/PROJECT_STATE.md`;
3. this workflow;
4. active Mission Pack;
5. relevant canonical sources;
6. Git/PR evidence.

Historical conversations and archived mission logs are supporting evidence, not current authority.
