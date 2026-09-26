# NEXUS Agent Operating Contract

This is the mandatory operating contract for any coding agent working in this repository, including Codex and Antigravity. It is an execution contract, not a substitute for product, architecture, audit or Mission Pack documentation.

## 1. Non-negotiable rule

**No agent may implement from chat context alone.**

Implementation authority comes from the repository's current canonical documentation + the explicitly active Mission Pack + repository evidence. Never treat planned work as implemented. Verify code, migrations, tests and CI.

A unit of code/domain authority has **one implementation owner at a time**. Codex and Antigravity are complementary engineers; neither may silently create a parallel implementation or authority for work owned by the other.

## 2. Canonical reading order before any code change

Read in this order:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md`
4. `docs/operations/PROJECT_STATE.md`
5. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`
6. `docs/product/NEXUS_MASTER_PLAN_V2.md`
7. `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`
8. current audit/legacy evidence required by the active work
9. `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`
10. the **single active Mission Pack** under `docs/roadmap/missions/`
11. Mission-referenced spec/plan/ADR/domain contracts
12. `docs/DEFINITION_READY_DONE_EVIDENCE.md`
13. `docs/operations/NEXUS_ENGINEERING_OPERATING_SYSTEM.md`
14. `docs/operations/ENGINEERING_PLAYBOOK.md`
15. the applicable execution adapter:
   - Codex → `docs/operations/CODEX_EXECUTION_ADAPTER.md`
   - Antigravity → `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md`

Supporting/historical documents may clarify context but may not override this chain.

## 3. Source precedence

When sources conflict:

1. approved current product decision / Master Plan;
2. current TO-BE Architecture and accepted ADRs;
3. current roadmap and active Mission Pack;
4. security/tenancy/data-authority contracts, including the transversal Product Realism + PAP contract;
5. current project-state/audit evidence;
6. issue/PR evidence;
7. current code as AS-IS evidence;
8. supporting Drive/reference/archive material.

Code proves what exists. It does not automatically prove what should exist. If precedence does not resolve a material contradiction, **STOP** and report the conflict.

## 4. Mission state gate

The canonical state model is defined by `docs/DEFINITION_READY_DONE_EVIDENCE.md`. Use only official mission states. Invented states may appear as task/checkpoint descriptors, but must not replace official mission state.

`READY` means DoR is satisfied; production-code editing still requires explicit implementation authorization. Commit, push, PR, merge and deploy are separate gates unless the active mission/config explicitly authorizes them.

## 5. Engineering Configurator

`docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` is the operational selector for current work. It declares the active mission/task, owner, reviewer, baseline, branch/worktree, risk, authorized/forbidden scope, evidence gates and resource policy.

The configurator **cannot override** product/architecture/Mission/spec authority. If it conflicts with those sources, stop and reconcile the config.

Before editing, verify that the agent is the declared owner for the code/authority being changed. A reviewer begins read-only unless correction ownership is explicitly transferred.

## 6. Mandatory preflight

Before any production-code edit:

- inspect branch/ref, HEAD and working state;
- verify active Mission Pack, task ownership and authorization;
- run `npm run nexus:preflight` when required by the repo/mission;
- for identity, enrollment, schema, migrations, documents, finance or persistence-critical work, run the applicable DB preflight;
- inspect relevant existing tests and migration history;
- identify unrelated changes and preserve them.

A factual `BLOCKED` preflight blocks implementation. Do not work around it by changing authority, disabling safeguards or moving work to an unapproved path.

## 7. Professional delivery pipeline

Relevant Nexus work follows:

`Discovery → Product Decision → Design/Authority → Mission Pack → Implementation Plan → Execution → Independent Review → Adversarial Product Review → Human UAT → Integration → Project State Update`

Do not jump directly from requirement to editing when the work is architectural or authority-changing.

For implementation use TDD/contract-first evidence where applicable:

`RED → minimal correct implementation → GREEN → affected regressions → checkpoint`.

## 8. Scope control

Before editing, know:

- mission/task ID;
- objective;
- invariants being changed/protected;
- expected files/domains;
- OUT-of-scope areas;
- required tests/evidence;
- stop rules.

Rules:

- one implementation owner per same authority/code unit;
- no opportunistic refactor/UX cleanup;
- no new module because it is convenient;
- no architecture rewrite unless explicitly required;
- discovered adjacent defects are classified, not silently absorbed.

If the smallest correct change requires material scope expansion, classify it and stop for the applicable authority decision.

### Engineering Foundation execution contract

Use `LOCATE → NARROW → READ → CHANGE → VERIFY`. Work is `SINGLE_AGENT_BY_DEFAULT`; do not perform speculative refactors or implementation by assumption. Before a cross-layer change, record `CROSS_LAYER_CHANGE_REQUIRED=YES` and `AFFECTED_LAYERS=`. Before a new authority, record `NEW_AUTHORITY_REQUIRED=YES` and `WHY_EXISTING_AUTHORITY_INSUFFICIENT=`. Preserve proven authority, introduce no new legacy consumers, and report out-of-scope findings rather than fixing them.

## 9. Discovery classification

Classify implementation discoveries as:

- `NORMAL_DEFECT` — in-scope implementation bug; fix and continue.
- `IMPLEMENTATION_DETAIL` — resolve without changing product/architecture intent.
- `ENVIRONMENT_BLOCKER` — preserve state and report exact recovery action.
- `GENUINE_PREREQUISITE` — dependent work stops; define the smallest missing authority/dependency.
- `SCOPE_EXPANSION` — requires explicit authorization.
- `PRODUCT_DECISION` — Product Owner decision required.
- `ARCHITECTURE_CHANGE` — governance/ADR decision required.

Missing backend authority must never be disguised as UI behavior. Missing UI must never be solved by duplicating server authority in the browser.

## 10. Root-cause discipline

For every critical defect, answer:

- what state/path allows the defect?
- which authority should own the decision?
- can the same defect recur through another route/tool/UI path?
- what test/evidence proves recurrence is blocked?

A green UI is not evidence that the domain invariant is fixed.

## 11. Data and schema rules

- PostgreSQL migrations are canonical schema evolution for vNext domains.
- Never mutate an applied historical migration to make current work pass.
- Migration order must be deterministic and tested.
- Shared-environment migration requires the mission/preflight contract.
- Ambiguous tenant ownership or destructive data conversion = STOP.
- Test-only DDL is not migration coverage.
- Additive schema expansion must still define compatibility/fail-closed behavior for legacy records where required.

## 12. Identity, authorization and tenancy

- Authentication identity and institutional Membership are distinct concerns.
- Institutional context is resolved server-side.
- Client-supplied institution/person/role/decision/case identifiers are never authority by themselves.
- Every institutional read/write must be tenant-safe.
- New cross-tenant behavior requires explicit negative tests.
- AI/tool selection never grants permission.

## 13. Transactions, concurrency and idempotency

For retryable or multi-write critical operations:

- define transaction boundary;
- define duplicate/idempotency behavior;
- define concurrency behavior;
- prove rollback/fail-closed behavior on partial failure;
- do not convert partial success into full success.

Reuse proven vNext patterns rather than inventing weaker local variants.

## 14. Product truth

Never present operational success without real evidence for persistence, payment, synchronization, signature/certificate issuance, message delivery, backup/restore, authorization/security state, AI execution or data import.

Mocks, demos and prototypes remain explicitly isolated from operational truth.

## 15. Product Realism + PAP governance

All modules, agents and analysts must follow `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md`.

The PAP is an explanation, knowledge-capture and presentation obligation over the real Nexus product. It does not authorize weaker architecture, demo-only product behavior, fake operational data, disposable persistence, browser-owned authority, weakened security/tenancy, or visual success without real persistence.

Track product completion and PAP readiness separately. A successful demo does not close product engineering. For significant PAP-relevant capabilities, capture enough repository-grounded explanation for the student author to understand and present the real flow without replacing product authority.

Documents remains outside the Finance execution pilot where that pilot says so, but Documents is fully covered by this transversal Product Realism + PAP governance.

Where scale can materially affect correctness or usability, use a realistic-scale profile instead of assuming that behavior proven with a handful of records is institution-ready.

## 16. Frontend/UX implementation

When a Mission includes user-facing work:

- preserve entity/context continuity;
- prefer task-first flows;
- explicit loading/empty/error/conflict/forbidden/confirmed states;
- mobile/tablet/desktop behavior validated where applicable;
- backend authorization remains authoritative;
- no client-owned domain state advancement masquerading as server truth.

Do not redesign unrelated surfaces in backend/foundation work.

## 17. Testing and evidence budget

Use the smallest evidence that proves the current invariant, then widen:

1. targeted policy/domain/UI contract;
2. persistence/PostgreSQL when relevant;
3. API/integration;
4. negative tenant/security/concurrency;
5. affected historical regressions;
6. migration/schema verification;
7. TypeScript/static checks;
8. production build;
9. visual/user-flow validation;
10. aggregate/final gate at the mission checkpoint.

Evidence classes:

- `FRESH` — must run for the current delta.
- `REUSABLE` — remains valid because the current delta does not affect it.
- `INVALIDATED` — current delta may affect it; rerun required.

Never rerun expensive unrelated proof only for ceremony, and never reuse evidence after its authority has been invalidated.

## 18. Four GREEN gates and DONE

Where applicable, track separately:

- `ENGINEERING_GREEN` — code/tests/build/security/tenant/regression evidence.
- `INTEGRITY_GREEN` — coherent states, authority and data semantics.
- `PRODUCT_GREEN` — supported workflow works end-to-end without scripts/devtools/hidden prerequisites.
- `HUMAN_UAT_GREEN` — observed and accepted product behavior.

A task may be GREEN in its own scope while the mission remains not PRODUCT_GREEN. `DONE` requires every applicable gate, integration evidence and truthful `PROJECT_STATE` update.

PAP readiness is not an additional Product GREEN gate. It is a separate knowledge/presentation status governed by the Product Realism + PAP contract.

## 19. Multi-agent ownership and review

Codex and Antigravity may both implement and review, but:

- the same code/authority has one owner at a time;
- parallelism is allowed only for independent work or a frozen shared contract;
- reviewer begins read-only;
- findings are classified before correction;
- correction ownership stays with the implementer unless explicitly transferred;
- the implementer cannot be the sole approver of its own integration.

Reviewer findings use `P0`, `P1`, `P2`, `OBSERVATION`, `FALSE_POSITIVE` (or an equivalent mission-defined taxonomy).

## 20. Resource/context discipline

Use progressive context from the engineering config:

- L0 Project State + Config;
- L1 active Mission/Task;
- L2 directly affected files;
- L3 required contracts/dependencies;
- L4 historical evidence;
- L5 broad repository investigation.

Expand only with evidence. Avoid duplicate investigations and broad rereads. Use the minimum subagents necessary for independent uncertainty/review. SIU/resource skills are optional accelerators, never dependencies.

Resource savings may never remove TDD, security, tenant isolation, integrity, independent/adversarial review or mandatory final gates.

## 21. Git and integration safety

- Preserve unrelated changes.
- Never `git reset --hard`, `git clean`, force push or rewrite shared history without explicit authorization and recovery justification.
- Use dedicated branches/worktrees for implementation and governance work.
- Do not mix governance cleanup with product implementation unless explicitly authorized.
- Dirty or unidentified worktrees are not valid integration inputs.

Integration has two levels:

1. **Technical task checkpoint** — applicable implementation evidence + independent review before entering a mission branch.
2. **Mission/product integration to `main`** — applicable aggregate gates + adversarial product review + Human UAT + PR review.

A commit/push does not itself mean integration or DONE.

## 22. Handoff and session recovery

A recoverable handoff records:

```text
MISSION=
TASK=
OWNER=
REVIEWER=
BASE_SHA=
HEAD_SHA=
BRANCH=
IMPLEMENTED=
AUTHORITY_CHANGED=
SCHEMA_CHANGED=
TESTS=
KNOWN_LIMITATIONS=
REVIEW_TARGET=
CANONICAL_DOCS=
WORKTREE_CLEAN=
REMOTE_SYNC=
NEXT_ACTION=
```

When credits/context/session end, preserve this factual state in Git/ledger. Do not replay a full historical conversation to resume.

A new agent recovers by reading the canonical chain in §2, verifying Git reality, then continuing only the selected task.

## 23. Agent adapters

- Codex must read `docs/operations/CODEX_EXECUTION_ADAPTER.md`.
- Antigravity must read `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md`.

Adapters translate this contract into tool-specific execution behavior but **cannot override** product, architecture, Mission Pack, DoR/DoD, engineering configurator constraints or this contract.
