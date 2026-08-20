# NEXUS Agent Operating Contract

This is the mandatory operating contract for any coding agent working in this repository, including Codex. It is an execution contract, not a substitute for product, architecture, audit or Mission Pack documentation.

## 1. Non-negotiable rule

**No agent may implement from chat context alone.**

Implementation authority comes from the repository's current canonical documentation + the explicitly active Mission Pack + repository evidence. If the Mission Pack is not `READY`, implementation is not authorized.

Never treat planned work as implemented. Verify code, migrations, tests and CI.

## 2. Canonical reading order before any code change

Read in this order:

1. `AGENTS.md`
2. `docs/README.md` — documentation authority hierarchy
3. `docs/operations/PROJECT_STATE.md` — current factual phase/baseline
4. `docs/product/NEXUS_MASTER_PLAN_V2.md` — product/market decisions
5. `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` — target architecture and domain authority
6. `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` — factual AS-IS risks
7. `docs/audit/LEGACY_REPLACEMENT_MAP.md` — preserve/refactor/replace/remove decisions
8. `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` — implementation order/dependencies
9. the **single active Mission Pack** under `docs/roadmap/missions/`
10. any evidence/ADR/domain contract explicitly referenced by that Mission Pack
11. `docs/DEFINITION_READY_DONE_EVIDENCE.md`
12. `docs/operations/ENGINEERING_PLAYBOOK.md`

Supporting/historical documents may clarify context but may not override this chain.

## 3. Source precedence

When sources conflict:

1. approved current product decision / Master Plan;
2. current TO-BE Architecture and accepted ADRs;
3. current roadmap and active Mission Pack;
4. security/tenancy/data-authority contracts;
5. current AUDIT/project-state evidence;
6. issue/PR evidence;
7. current code as AS-IS evidence;
8. supporting/historical/archive material.

Code proves what exists. It does not automatically prove what should exist.

If precedence does not resolve a contradiction, **STOP** and report the conflict. Do not pick the easiest implementation.

## 4. Mission state gate

Only these states are allowed for implementation control:

- `PREPARATION` — investigation/documentation only;
- `BLOCKED` — no implementation;
- `READY` — implementation may begin only if explicitly authorized;
- `IMPLEMENTING` — code changes are limited to Mission Pack scope;
- `VALIDATING` — no scope expansion; prove gates/evidence;
- `DONE` — all DoD/evidence satisfied;
- `CANCELLED/SUPERSEDED` — no implementation.

`READY WITH CONDITIONS` is allowed only when every condition is objective, documented, locally controllable and does not hide a security/data/deployment unknown. External unknowns remain `BLOCKED`.

## 5. Mandatory preflight

Before any production-code edit:

- inspect branch/ref and working state;
- verify the active Mission Pack and its state;
- run `npm run nexus:preflight`;
- for identity, enrollment, schema, migrations, documents, finance or other persistence-critical work, run the applicable DB preflight required by the Mission Pack;
- inspect relevant existing tests and migration history;
- identify unrelated changes and preserve them.

Preflight is diagnostic/read-only unless the Mission Pack explicitly authorizes a migration/test setup action.

A `BLOCKED` result blocks implementation.

## 6. Mission execution algorithm

For every authorized mission execute exactly this sequence:

`read canonical sources → restate objective/invariants → inspect AS-IS → prove DoR → create failing/contract test where applicable → minimal implementation → focused tests → negative/security/tenant tests → regression → migration verification → static checks → build → UX validation when applicable → evidence pack → DoD review → project-state update`

Do not jump directly from requirement to editing.

## 7. Scope control

Before editing, write a compact scope statement containing:

- mission ID;
- objective;
- invariants being changed/protected;
- expected files/domains;
- explicitly OUT-of-scope areas;
- required tests/evidence;
- stop rules.

Rules:

- one mission at a time;
- no opportunistic UX cleanup;
- no unrelated refactor;
- no new module because it is convenient;
- no architecture rewrite unless explicitly required by the Mission Pack;
- discovered adjacent defects are recorded, not silently fixed, unless they block the mission and are within approved scope.

If the smallest correct change requires expanding scope, STOP and report why.

## 8. Root-cause discipline

Do not patch symptoms when the mission identifies an authority/invariant problem.

For every critical defect, answer:

- what state/path allows the defect?
- which authority should own the decision?
- can the same defect occur through another route/tool/UI path?
- what test proves recurrence is blocked?

A green UI is not evidence that the domain invariant is fixed.

## 9. Data and schema rules

- PostgreSQL migrations are the target single persistent schema-evolution authority.
- Runtime startup must not silently act as a migration engine.
- Never mutate an applied historical migration to make the current branch pass.
- Migration order must be deterministic and tested.
- Shared-environment migration requires the Mission Pack's preflight/recovery contract.
- Ambiguous tenant ownership or destructive data conversion = STOP.
- A schema model declaration is not proof that a migration creates it.
- Test-only DDL is not allowed to masquerade as migration coverage.

## 10. Identity, authorization and tenancy

- Authentication identity and institutional Membership are distinct concerns.
- Institutional context is resolved server-side.
- Client-supplied institution/person/role values are never authority by themselves.
- Every institutional read/write must be tenant-safe.
- New cross-tenant behavior requires explicit negative tests.
- AI/tool selection never grants permission; every use case/tool requires its own authorization and tenant checks.

## 11. Transactions, concurrency and idempotency

For retryable or multi-write critical operations:

- define transaction boundary;
- define duplicate/idempotency behavior;
- define concurrency behavior (lock/version/constraint as appropriate);
- prove rollback on partial failure;
- do not convert partial success into full success.

Reuse proven vNext patterns rather than inventing weaker local variants.

## 12. Product truth

Never present these as operational success without real evidence:

- persistence;
- payment;
- synchronization;
- signature/certificate issuance;
- message delivery;
- backup/restore;
- authorization/security state;
- AI execution;
- data import.

Mocks, demos and prototypes must remain clearly isolated from operational truth.

## 13. Audit truth

Audit must state what actually happened, by whom/system, with the correct tenant/context/outcome. Presentation may translate technical labels but must not invent receipts, approvals, signatures or actions absent from the underlying event.

## 14. Frontend/UX implementation

When a Mission Pack includes user-facing work:

- preserve entity/context continuity;
- prefer task-first flows;
- do not create unnecessary menu → button-panel → operation chains;
- long workflows do not belong in large modals;
- tables are acceptable for dense administration when justified;
- loading, empty, error, conflict, forbidden and confirmed states are explicit;
- mobile/tablet/desktop behavior is validated;
- backend authorization remains authoritative.

Do not redesign unrelated surfaces in a backend/foundation mission.

## 15. Testing hierarchy

Use the smallest test that proves the invariant, then widen:

1. policy/domain/unit contract;
2. persistence/PostgreSQL test when relevant;
3. API/integration contract;
4. negative tenant/security/concurrency tests;
5. relevant historical regressions;
6. migration isolation/schema verification;
7. TypeScript/static checks;
8. production build;
9. visual/user-flow validation when applicable.

Never weaken/remove a failing critical test merely to obtain green CI.

## 16. Evidence required before DONE

The final mission evidence must state:

- mission ID and final state;
- baseline/head refs;
- files/areas changed;
- invariants implemented;
- schema/data changes and recovery behavior;
- focused tests and results;
- negative/security/tenant tests and results;
- regression results;
- migration/static/build results;
- UI validation where applicable;
- known residual risks;
- explicit DoD checklist;
- `PROJECT_STATE.md` update when factual project state changed.

If a blocker remains, state is not DONE.

## 17. Stop conditions

Stop implementation and report evidence when any of these occurs:

- canonical sources conflict materially;
- Mission Pack is not READY/authorized;
- production/staging dependency is unknown and required by the mission;
- destructive migration/data conversion is not explicitly approved;
- tenant ownership cannot be proven;
- a required domain authority does not yet exist;
- solving the issue requires unrelated redesign;
- tests reveal a broader invariant break outside mission scope;
- required secret/credential/environment is unavailable.

Do not silently work around a stop condition.

## 18. Git safety

- Preserve unrelated changes.
- Never `git reset --hard`, `git clean`, force push or rewrite shared history without explicit authorization and recovery justification.
- Use a dedicated branch/PR for implementation missions.
- Do not mix documentation-governance cleanup with product implementation unless the active mission explicitly requires the documentation update.

## 19. Session recovery

A new agent must be able to resume without prior chat history:

1. read the canonical chain in §2;
2. verify active branch/PR and `PROJECT_STATE.md`;
3. run preflight;
4. verify Mission Pack state;
5. compare documented AS-IS assumptions against code;
6. continue only the active mission.

If repository reality contradicts `PROJECT_STATE.md`, correct/report the factual state; do not rewrite product/architecture intent based on implementation accidents.

## 20. Codex adapter

When Codex is the implementation agent, it must also read `docs/operations/CODEX_EXECUTION_ADAPTER.md`. That file may translate this contract into Codex execution behavior but **cannot override** canonical product, architecture, audit, roadmap, Mission Pack, DoR/DoD or this contract.
