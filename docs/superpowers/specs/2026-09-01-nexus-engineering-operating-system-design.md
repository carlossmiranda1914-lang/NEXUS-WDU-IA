# Nexus Engineering Operating System — Design

**Status:** APPROVED GOVERNANCE DESIGN  
**Scope:** repository-wide engineering coordination, evidence, agent collaboration and integration.  
**Product code impact:** none.

## Purpose

Nexus has reached a complexity level where durable engineering authority cannot live in chat sessions or in the private context of Codex, Antigravity or any other agent. This design defines one operating system for product decisions, technical authority, execution, review, resource discipline, handoff and integration.

## Decision 1 — Authority and roles

- Carlos / Product Owner owns final product direction and acceptance.
- ChatGPT coordinates architecture, planning, adjudication and quality gates with the Product Owner.
- GitHub plus canonical repository documentation are the durable technical/executable authority.
- Codex and Antigravity are complementary engineering agents with equivalent ability to investigate, implement and review.
- A unit of code has one implementation owner at a time. The other agent may review or work on a genuinely independent unit.
- No agent may create a parallel domain authority or silently change another agent's owned scope.
- Important technical changes must be translated into product-operational language so the Product Owner can understand what changed, why, what it enables and what risk remains.

## Decision 2 — Information authority

Each fact has one canonical home.

- GitHub/repository: code, schema, migrations, tests, APIs, architecture, ADRs, Mission Packs, specs, plans, SDD ledgers, technical evidence and current technical state.
- Drive: original business/institutional material, research, legislation, external documents, presentations, contracts, brand assets and source evidence.
- ChatGPT: direction, reasoning and coordination; never durable project memory by itself.
- Codex/Antigravity sessions: engineering workspaces; never durable authority by themselves.

Knowledge promotion rule:

`discovery -> classify -> promote to the single canonical authority -> reference, do not duplicate`

Repository document hierarchy:

`Product Vision/Decisions -> Architecture/ADRs -> Roadmap -> Mission -> Spec -> Plan -> Task/SDD ledger -> Code/Tests -> Verification Evidence -> UAT -> Project State`

A lower-level document may not silently contradict a higher-level source.

## Decision 3 — Ownership, branches, worktrees and handoff

Every executable task declares:

- mission/task;
- owner;
- reviewer;
- base SHA;
- branch/worktree;
- authorized scope;
- forbidden scope;
- required evidence;
- current gate.

Rules:

- one owner for the same code/authority at a time;
- parallel execution only for independent work or against a frozen contract;
- reviews begin read-only;
- a reviewer reports findings before editing another owner's code;
- correction ownership stays with the implementer unless explicitly transferred;
- checkpoints that must survive a session are protected in Git;
- a commit is not automatically GREEN.

Canonical handoff fields:

`MISSION, TASK, OWNER, BASE_SHA, HEAD_SHA, BRANCH, IMPLEMENTED, AUTHORITY_CHANGED, SCHEMA_CHANGED, TESTS, KNOWN_LIMITATIONS, REVIEW_TARGET, CANONICAL_DOCS`

## Decision 4 — Professional delivery pipeline

Relevant Nexus work follows:

`Discovery -> Product Decision -> Design/Authority -> Mission Pack -> Implementation Plan -> Execution -> Independent Review -> Adversarial Product Review -> Human UAT -> Integration -> Project State Update`

Execution uses TDD where applicable:

`RED -> minimal correct implementation -> GREEN -> affected regressions -> checkpoint`

Four distinct gates are required where applicable:

- `ENGINEERING_GREEN`: code/tests/build/security/tenant/regression evidence.
- `INTEGRITY_GREEN`: coherent state, authority and data semantics.
- `PRODUCT_GREEN`: supported user workflow works end-to-end without scripts/devtools/hidden prerequisites.
- `HUMAN_UAT_GREEN`: observed and accepted product behavior.

`DONE` is evidence-based and may be declared only after every applicable gate, integration and state update.

Discovery during execution must be classified as one of:

`NORMAL_DEFECT, IMPLEMENTATION_DETAIL, ENVIRONMENT_BLOCKER, GENUINE_PREREQUISITE, SCOPE_EXPANSION, PRODUCT_DECISION, ARCHITECTURE_CHANGE`.

Absence of backend authority may not be disguised as a UI fix; absence of UI may not be solved by duplicating authority in the browser.

## Decision 5 — Resource and context discipline

Efficiency reduces repetition, not rigor.

Progressive context levels:

- L0: `PROJECT_STATE` and engineering config.
- L1: active Mission/Task.
- L2: directly affected files.
- L3: required contracts/dependencies.
- L4: historical evidence.
- L5: broad repository investigation.

Agents start at the lowest sufficient level and expand only with evidence.

Evidence classification:

- `FRESH`: must run for this change.
- `REUSABLE`: remains valid because current delta does not touch its authority.
- `INVALIDATED`: must be rerun.

Test-cost ladder:

`targeted RED/GREEN -> affected tests -> affected regressions -> checkpoint gate -> aggregate/final gate`

Subagents have a budget: use the minimum number needed for independent uncertainty/review. Codex and Antigravity must not duplicate the same investigation without explicit reason.

SIU/resource-management skills are optional accelerators, never dependencies. If unavailable, the same discipline is applied manually.

Session/credit exhaustion must end with a recoverable factual checkpoint: mission, state, SHA, completed evidence, current blocker and exact next safe action.

## Decision 6 — Engineering Configurator and integration

The repository contains a canonical `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` that selects the current mission/task and records owner/reviewer/baseline/scope/risk/gates/resource policy. It does not replace Mission Packs/specs/plans; it is the operational selector.

Task integration and product integration are distinct:

- Technical task integration: independently reviewed task checkpoint may enter its mission branch.
- Product integration: mission may enter `main` only after applicable aggregate gates, adversarial product review, Human UAT and PR review.

The agent that implemented a change cannot be the sole approver of its integration.

Risk levels:

- LOW: focused implementation + targeted evidence.
- MEDIUM: implementation + independent review + affected regressions.
- HIGH: schema/authority/tenancy/security/persistence-critical changes require independent review, operational persistence/API proof and adversarial/aggregate gates at the appropriate mission checkpoint.

Dirty/unidentified worktrees are never integration inputs. Every handoff identifies branch, base SHA, head SHA and evidence.

## Current transition rule

The governance rollout must not rewrite or discard ALUNOS-01A.3 work. The active product branch remains `codex/alunos-01a-design`; its current durable remote checkpoint is `1a5392ba04e8a0db317ff2791478839726c11026`. T5B resumes after this governance change is integrated/reconciled, using the new configurator and without restarting proven Tasks 1–4 or T5A.

## Success criteria

The operating system is successfully materialized when:

1. humans and agents have one canonical entrypoint and precedence chain;
2. Codex and Antigravity have explicit adapter behavior and cannot silently overlap ownership;
3. the active mission/task/owner/reviewer/gates are visible in one config file;
4. `PROJECT_STATE` describes current factual state rather than historical assumptions;
5. resource efficiency is encoded without weakening evidence;
6. integration differentiates task checkpoints from product acceptance/merge;
7. a new agent can recover the active work without previous chat history.
