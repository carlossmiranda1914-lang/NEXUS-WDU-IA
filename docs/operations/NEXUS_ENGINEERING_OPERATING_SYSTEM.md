# NEXUS Engineering Operating System

**Status:** CANONICAL ENGINEERING GOVERNANCE  
**Purpose:** define how Nexus work is decided, stored, executed, reviewed, integrated and recovered across humans, Codex and Antigravity.  
**Does not replace:** product direction, architecture, ADRs, Mission Packs, specs, plans or domain contracts.

## 1. Authority and roles

- Product Owner owns product direction and Human UAT acceptance.
- ChatGPT coordinates architecture, planning, adjudication and quality gates with the Product Owner.
- GitHub + canonical repository docs are durable technical/executable authority.
- Codex and Antigravity are complementary engineering agents with equivalent implementation/review capability.
- One code/authority unit has one implementation owner at a time.
- Reviewer begins read-only; editing another owner’s work requires explicit ownership transfer.
- No agent may approve its own implementation as the sole integration reviewer.

## 2. Information authority

- **GitHub/repository:** code, schema, migrations, tests, APIs, architecture, ADRs, roadmap, Mission Packs, specs, plans, ledgers, technical evidence, project state.
- **Drive:** original business/external evidence, legislation, research, institutional material, Office documents, brand/source assets.
- **ChatGPT:** direction/reasoning/coordination, never durable authority alone.
- **Codex/Antigravity sessions:** engineering workspaces, never durable authority alone.

Promote important discoveries into the correct canonical source. Reference rather than duplicate.

Hierarchy:

`Product -> Architecture/ADR -> Roadmap -> Mission -> Spec -> Plan -> Task/Ledger -> Code/Tests -> Verification -> UAT -> Project State`

## 3. Ownership, branches and handoffs

Every executable unit declares:

`MISSION, TASK, OWNER, REVIEWER, BASE_SHA, BRANCH/WORKTREE, AUTHORIZED_SCOPE, FORBIDDEN_SCOPE, REQUIRED_EVIDENCE, CURRENT_GATE`.

Parallel work is allowed only when tasks are independent or the shared contract is already frozen.

A handoff records:

`MISSION, TASK, OWNER, REVIEWER, BASE_SHA, HEAD_SHA, BRANCH, IMPLEMENTED, AUTHORITY_CHANGED, SCHEMA_CHANGED, TESTS, KNOWN_LIMITATIONS, REVIEW_TARGET, CANONICAL_DOCS, WORKTREE_CLEAN, REMOTE_SYNC, NEXT_ACTION`.

Git preserves recoverable checkpoints; a commit alone does not mean GREEN.

## 4. Delivery pipeline and completion gates

Canonical pipeline:

`Discovery -> Product Decision -> Design/Authority -> Mission -> Plan -> Execution -> Independent Review -> Adversarial Product Review -> Human UAT -> Integration -> Project State Update`

Execution uses TDD where applicable:

`RED -> minimal correct implementation -> GREEN -> affected regressions -> checkpoint`.

Mission/product status is separated into:

- `ENGINEERING_GREEN` — code/tests/build/security/tenant/regression evidence.
- `INTEGRITY_GREEN` — coherent state, authority and data semantics.
- `PRODUCT_GREEN` — supported workflow works end-to-end without hidden manual dependencies.
- `HUMAN_UAT_GREEN` — observed and accepted product behavior.

`DONE` requires all applicable gates, integration evidence and current-state update.

Discoveries are classified as:

`NORMAL_DEFECT, IMPLEMENTATION_DETAIL, ENVIRONMENT_BLOCKER, GENUINE_PREREQUISITE, SCOPE_EXPANSION, PRODUCT_DECISION, ARCHITECTURE_CHANGE`.

Missing backend authority may not be disguised as UI behavior. Missing UI may not be solved by duplicating server authority in the client.

## 5. Resource, context and evidence discipline

Start with the smallest sufficient context:

- L0 — Project State + Engineering Config.
- L1 — active Mission/Task.
- L2 — directly affected files.
- L3 — required contracts/dependencies.
- L4 — historical evidence.
- L5 — broad repository investigation.

Expand context only when evidence requires it.

Evidence is classified:

- `FRESH` — must run now.
- `REUSABLE` — remains valid because current delta does not affect it.
- `INVALIDATED` — must be rerun.

Test-cost ladder:

`targeted RED/GREEN -> affected tests -> affected regressions -> checkpoint gate -> aggregate/final gate`.

Use the minimum number of subagents needed for independent uncertainty/review. SIU/resource skills are optional accelerators, never dependencies. Resource savings must never remove TDD, security, tenant isolation, integrity, required reviews or final gates.

When credits/session end, preserve mission/state/SHA/evidence/blocker/next-action in Git + ledger rather than replaying historical chat.

## 6. Configurator and integration

`docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` is the operational selector for current mission/task/owner/reviewer/baseline/risk/scope/gates/resource mode. It does not override canonical Mission/spec/plan authority.

Integration has two levels:

1. **Technical task integration** — task checkpoint may enter the mission branch after applicable implementation evidence + independent review.
2. **Product integration to main** — requires applicable aggregate gates, adversarial product review, Human UAT and PR review.

Risk guidance:

- LOW — targeted implementation/evidence.
- MEDIUM — implementation + independent review + affected regressions.
- HIGH — schema/authority/tenancy/security/persistence-critical work adds operational persistence/API proof and stronger mission-level adversarial/aggregate gates.

Dirty or unidentified worktrees are never valid integration inputs.

## Recovery rule

A new human/agent must be able to resume Nexus without prior chat history by reading:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/operations/PROJECT_STATE.md`
4. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`
5. active Mission/spec/plan/contracts
6. applicable execution adapter

Then verify actual Git state before editing.
