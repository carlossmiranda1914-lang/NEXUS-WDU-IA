# Nexus Engineering Execution Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute this plan task-by-task with one implementation owner and independent review. Do not dispatch parallel writers over the same governance authority.

**Goal:** Harden the existing Nexus engineering governance so prompts, tests, Codex, Antigravity, reviews and merge gates consistently produce solid forward progress instead of late patch loops.

**Architecture:** Extend the existing canonical operating system rather than creating a competing framework. Encode risk-to-proof selection, single-writer ownership, SHA-bound Codex/Antigravity handoffs, stateful behavioral evidence and review-thread adjudication in the existing governance documents, then protect those rules with a deterministic textual governance contract test.

**Tech Stack:** Markdown, YAML operational configuration, Node/TypeScript test conventions already present in the repository, GitHub/CI.

**Spec:** `docs/superpowers/specs/2026-09-02-nexus-engineering-execution-hardening-design.md`

## Global Constraints

- No product/runtime behavior changes in this governance tranche.
- No migration changes.
- No new branch, worktree or PR.
- One writer owns the governance delta; reviewer remains read-only until explicit transfer.
- Preserve the existing canonical authority hierarchy.
- CI green alone must never be sufficient for critical-path merge eligibility.
- Static source contracts may not be the sole proof for stateful product behavior.
- Resource savings may not weaken security, tenancy, data integrity, independent review or required final gates.

---

### Task 1: Encode the execution law in the canonical Operating System

**Files:**
- Modify: `docs/operations/NEXUS_ENGINEERING_OPERATING_SYSTEM.md`
- Test: `tests/nexus-engineering-execution-governance.test.ts`

**Interfaces:**
- Consumes: existing authority hierarchy and evidence classes.
- Produces: canonical `Risk -> Proof -> Tool -> DONE`, single-writer/write-lock, handoff and critical merge rules used by both adapters.

- [ ] **Step 1: Write a failing governance contract test**

Create `tests/nexus-engineering-execution-governance.test.ts` that reads the Operating System and asserts the presence of exact canonical concepts: `Risk -> Proof -> Tool -> DONE`, `WRITE_OWNER`, `REVIEWER_MODE`, `REVIEWED_HEAD`, `MERGE_SAFE`, stateful behavioral proof rule, and review-thread adjudication rule.

- [ ] **Step 2: Run the targeted test and prove RED**

Run the repository's TypeScript test runner against only `tests/nexus-engineering-execution-governance.test.ts`. Expected: FAIL because the current Operating System does not yet contain all hardened contracts.

- [ ] **Step 3: Update the Operating System minimally**

Add focused sections implementing the design without duplicating product/architecture authority. Preserve current content; extend ownership/evidence/integration sections with the new canonical contracts.

- [ ] **Step 4: Run the targeted governance test and prove GREEN**

Expected: PASS.

- [ ] **Step 5: Check the diff for accidental product changes**

Run `git diff --check` and inspect changed paths. Expected paths at this checkpoint: governance docs/test only.

---

### Task 2: Make Codex and Antigravity communicate through SHA-bound handoffs

**Files:**
- Modify: `docs/operations/CODEX_EXECUTION_ADAPTER.md`
- Modify: `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md`
- Modify: `tests/nexus-engineering-execution-governance.test.ts`

**Interfaces:**
- Consumes: canonical ownership/handoff rules from Task 1.
- Produces: identical handoff semantics across both agents.

- [ ] **Step 1: Extend the failing contract**

Require both adapters to contain `HANDOFF_TYPE=IMPLEMENTATION`, `HANDOFF_TYPE=REVIEW`, `REVIEWED_HEAD`, `WRITE_TRANSFER_REQUIRED`, and a rule that reviewer mode begins read-only.

- [ ] **Step 2: Run targeted test and prove RED**

Expected: FAIL on missing adapter contracts.

- [ ] **Step 3: Update Codex adapter**

Specify Codex default implementer behavior when configured owner, explicit reviewer read-only behavior, SHA-bound implementation handoff, and prohibition on self-approving integration.

- [ ] **Step 4: Update Antigravity adapter**

Specify independent review as the default pairing when Codex owns a critical unit, exact review handoff fields, and `WRITE_TRANSFER_REQUIRED=YES` before editing owner code.

- [ ] **Step 5: Run targeted test and prove GREEN**

Expected: PASS with symmetric handoff semantics.

---

### Task 3: Harden prompt, test and closeout standards

**Files:**
- Modify: `docs/operations/ENGINEERING_PLAYBOOK.md`
- Modify: `docs/DEFINITION_READY_DONE_EVIDENCE.md`
- Modify: `tests/nexus-engineering-execution-governance.test.ts`

**Interfaces:**
- Consumes: risk/proof taxonomy.
- Produces: enforceable prompt schema and evidence sufficiency rules.

- [ ] **Step 1: Extend contract with prompt/evidence requirements**

Assert that canonical docs distinguish static proof from stateful behavioral proof, require risk-specific evidence, and require prompt fields for SHA, owner, invariants, scope, proof and stop conditions.

- [ ] **Step 2: Run targeted test and prove RED**

Expected: FAIL until canonical docs are hardened.

- [ ] **Step 3: Update Playbook**

Add a concise prompt-contract section and a proof-selection table. Explicitly state that a static/source contract is complementary only for stateful critical flows.

- [ ] **Step 4: Update Definition of Done**

Add current-HEAD review, unresolved review-finding adjudication, and stateful proof requirements to critical user-flow completion. Preserve existing P0/P1 and evidence-state semantics.

- [ ] **Step 5: Run targeted test and prove GREEN**

Expected: PASS.

---

### Task 4: Reconcile the active Engineering Config for ALUNOS closeout

**Files:**
- Modify: `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`
- Modify: `tests/nexus-engineering-execution-governance.test.ts`

**Interfaces:**
- Consumes: current PR #87 state and accepted governance design.
- Produces: one truthful active selector for the bounded ALUNOS final-hardening/validation pass.

- [ ] **Step 1: Add a contract that rejects stale active-work semantics**

The test must require the config to declare the current mission, one writer, one reviewer, current gate, and a closeout objective rather than pointing agents back to a completed historical Task 5 implementation.

- [ ] **Step 2: Run targeted test and prove RED**

Expected: FAIL against the stale current selector.

- [ ] **Step 3: Update only the operational selector**

Set ALUNOS-01A.3 to the truthful closeout/validation activity, declare Codex as writer and Antigravity as read-only independent reviewer for the correction unit, preserve branch `codex/alunos-01a-design`, and encode forbidden scope: no new module, no unrelated refactor, no historical migration mutation.

- [ ] **Step 4: Run targeted test and prove GREEN**

Expected: PASS.

---

### Task 5: Verify governance hardening without consuming product assurance unnecessarily

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: independently reviewable governance checkpoint ready to govern ALUNOS hardening.

- [ ] **Step 1: Run governance contract**

Expected: PASS.

- [ ] **Step 2: Run `git diff --check`**

Expected: PASS.

- [ ] **Step 3: Run lint/type/static checks affected by the new test**

Expected: PASS.

- [ ] **Step 4: Run production build if the repository gate requires it for changed test/config inputs**

Expected: PASS or documented N/A only if the canonical gate explicitly makes it reusable.

- [ ] **Step 5: Run secret scan**

Expected: PASS.

- [ ] **Step 6: Inspect changed paths**

Expected: only governance/spec/plan/test/config files. `PRODUCT_CHANGED=NO`, `MIGRATIONS_CHANGED=NO`.

- [ ] **Step 7: Commit/push only if separately authorized by the active config/user authorization**

The final handoff must include exact `HEAD_SHA`, changed paths, evidence results and `READY_FOR_ALUNOS_FINAL_HARDENING=YES|NO`.

---

## Next Plan Boundary: ALUNOS-01A.3 Final Hardening

Do not fold product corrections into this governance plan. After this plan is implemented and independently reviewed, create/execute one bounded ALUNOS final-hardening plan against the then-current HEAD.

That plan must begin with a read-only invariant audit covering the entire affected ALUNOS-01A critical path and must close the known risk classes, not merely the five known comments. Minimum behavioral proofs:

1. registration save -> refreshed lifecycle/registration versions -> same-drawer activation;
2. activation -> active -> reachable Student Record handoff;
3. pre-existing ad-hoc document -> canonical policy capture/materialization -> validation gate;
4. national-ID conflict -> identity review creation/queue without invalid reason-code failure;
5. governance selector remains truthful after completion;
6. tenant/auth/idempotency/migration evidence invalidated by corrections is rerun;
7. all current-head review findings are adjudicated;
8. local and remote required gates pass;
9. Human UAT is rerun only for flows invalidated by the final correction delta.

Only after those proofs may PR #87 be classified `MERGE_SAFE=YES`.
