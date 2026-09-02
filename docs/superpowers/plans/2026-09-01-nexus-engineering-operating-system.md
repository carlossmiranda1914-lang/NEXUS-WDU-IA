# Nexus Engineering Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize the approved Nexus engineering governance so humans, Codex and Antigravity share one durable authority, resource discipline and integration protocol.

**Architecture:** Extend existing repository governance rather than creating a parallel system. `AGENTS.md` remains the mandatory agent contract, `ENGINEERING_PLAYBOOK.md` remains the durable workflow, adapters specialize behavior for Codex/Antigravity, `NEXUS_ENGINEERING_CONFIG.yaml` selects the active execution context, and `PROJECT_STATE.md` remains the concise factual recovery point.

**Tech Stack:** Markdown/YAML governance documentation, Git/GitHub branch discipline.

**Spec:** `docs/superpowers/specs/2026-09-01-nexus-engineering-operating-system-design.md`

## Global Constraints

- No product code/schema/data change.
- Do not alter or discard ALUNOS-01A.3 product work.
- Do not create a second documentation authority hierarchy.
- Preserve existing security/tenant/mission stop rules.
- Resource optimization must never weaken evidence or review.
- Governance rollout occurs on `codex/nexus-engineering-governance`, separate from `codex/alunos-01a-design`.

---

### Task 1: Canonical Agent and Documentation Entry Points

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: approved governance spec and existing authority hierarchy.
- Produces: explicit multi-agent contract, configurator/adapters in reading order, and single-source information rules.

- [ ] Add Codex + Antigravity complementary ownership/reviewer rules to `AGENTS.md` without weakening current mission/security/stop rules.
- [ ] Add the engineering configurator and both adapters to the canonical reading/recovery order.
- [ ] Update `docs/README.md` canonical-set table and remove stale historical “first mission” language that contradicts current project state.
- [ ] Verify the source-precedence chain still has one authority per information class.
- [ ] Review diff for accidental product authorization.

### Task 2: Engineering Configurator and Agent Adapters

**Files:**
- Create: `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`
- Create: `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md`
- Modify: `docs/operations/CODEX_EXECUTION_ADAPTER.md`

**Interfaces:**
- Consumes: Mission Pack/spec/plan and Project State.
- Produces: operational selector and symmetric owner/reviewer behavior for both engineering agents.

- [ ] Create a human-readable YAML configurator with project, mission, task, owner, reviewer, baseline, branch/worktree, risk, scope, gates and resource policy.
- [ ] Seed it with the current ALUNOS-01A.3/T5B transition state while marking governance reconciliation explicitly.
- [ ] Create Antigravity adapter subordinate to `AGENTS.md` with the same authority, TDD, reviewer-read-only, resource and handoff discipline.
- [ ] Extend Codex adapter with configurator, cross-agent ownership, read-only review and integration-hand-off rules.
- [ ] Verify neither adapter can override Mission Pack/product/architecture authority.

### Task 3: Durable Workflow, Evidence and Integration Gates

**Files:**
- Modify: `docs/operations/ENGINEERING_PLAYBOOK.md`

**Interfaces:**
- Consumes: approved six governance decisions.
- Produces: one pipeline from discovery to DONE, four GREEN gates, evidence invalidation policy, risk-based test depth and technical-vs-product integration.

- [ ] Add the canonical Discovery → State Update pipeline.
- [ ] Define `ENGINEERING_GREEN`, `INTEGRITY_GREEN`, `PRODUCT_GREEN`, `HUMAN_UAT_GREEN` and evidence-based `DONE`.
- [ ] Add discovery classification and no-authority-in-UI rules.
- [ ] Add progressive context L0–L5, FRESH/REUSABLE/INVALIDATED evidence and test-cost ladder.
- [ ] Add risk levels and task/product integration distinction.
- [ ] Add standard engineering handoff fields and session-credit recovery requirements.
- [ ] Verify new rules complement rather than duplicate existing detailed domain gates.

### Task 4: Current State Recovery Point

**Files:**
- Modify: `docs/operations/PROJECT_STATE.md`

**Interfaces:**
- Consumes: current remote Git state and approved governance transition.
- Produces: concise factual entrypoint for humans and agents.

- [ ] Record integrated `main @ f945fe43...` baseline and active ALUNOS branch checkpoint `1a5392ba...` separately.
- [ ] Record ALUNOS-01A.3 Tasks 1–4 and T5A as proven on the active branch, T5B as paused for governance/reconciliation, Task 5 dependent on T5B, Task 6 not started.
- [ ] State clearly that non-merged branch capability is not integrated `main` capability.
- [ ] Record the governance branch and the exact resume rule for T5B.
- [ ] Keep the file concise; history remains in mission/SDD ledgers and Git.

### Task 5: Governance Verification and Handoff

**Files:**
- Review all files changed by Tasks 1–4.

**Interfaces:**
- Consumes: completed governance delta.
- Produces: reviewed checkpoint ready for PR/integration without touching product work.

- [ ] Verify no product code, migration, schema or application runtime file changed.
- [ ] Check all new references resolve to real files.
- [ ] Check configurator values agree with `PROJECT_STATE` and current remote branch checkpoints.
- [ ] Check Codex/Antigravity owner/reviewer rules are symmetric and do not allow self-approval of integration.
- [ ] Check resource rules explicitly retain security, TDD, tenant isolation, independent/adversarial review and required gates.
- [ ] Perform a fresh document self-review for contradictions/placeholders/stale mission claims.
- [ ] Open a focused governance PR to `main`; do not merge without review.
