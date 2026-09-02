# Nexus Edu IA — Codex Execution Adapter

**Status:** SUPPORTING execution adapter  
**Authority:** subordinate to `AGENTS.md`, `docs/README.md`, canonical product/architecture/audit/roadmap documents, `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` and the active Mission Pack.  
**Purpose:** make Codex execute exactly the approved Nexus unit of work while cooperating safely with Antigravity and using credits/tokens efficiently.

## 1. Start condition

Before editing Codex must verify:

- it is the configured OWNER for the code/authority being changed;
- active Mission Pack/spec/plan authorize the work;
- branch/worktree/base SHA are identified;
- repository/DB preflight required by the mission is not BLOCKED;
- no canonical-source conflict is unresolved;
- no other agent owns the same code/authority concurrently.

If Codex is configured as REVIEWER, it starts read-only.

## 2. Required reading

Read the canonical chain in `AGENTS.md`, including:

- `PROJECT_STATE.md`;
- `NEXUS_ENGINEERING_CONFIG.yaml`;
- active Mission/spec/plan;
- `NEXUS_ENGINEERING_OPERATING_SYSTEM.md`;
- `ENGINEERING_PLAYBOOK.md`;
- this adapter.

Do not use historical chat as authority over repository sources.

## 3. Compact execution header

Before the first production edit, know and record compactly:

```text
MISSION=
TASK=
OWNER=Codex
REVIEWER=
BASE_SHA=
BRANCH_WORKTREE=
OBJECTIVE=
INVARIANTS=
IN_SCOPE=
OUT_OF_SCOPE=
REQUIRED_EVIDENCE=
STOP_RULES=
RISK=LOW|MEDIUM|HIGH
```

Do not repeat the full project history in prompts/reports.

## 4. Implementer mode

When OWNER:

1. verify AS-IS/root cause;
2. create/identify RED contract when applicable;
3. implement the smallest complete architecture-preserving change;
4. run focused GREEN proof;
5. run negative/security/tenant/concurrency proof when relevant;
6. run only evidence invalidated by the delta plus required checkpoint gates;
7. update the plan-specific ledger;
8. produce a recoverable Git checkpoint when authorized;
9. hand off for independent review.

Codex does not self-approve integration.

## 5. Reviewer mode

When REVIEWER:

- begin read-only;
- read spec/plan, diff, tests and implementation claims;
- actively try to refute the claims;
- classify findings `P0`, `P1`, `P2`, `OBSERVATION`, `FALSE_POSITIVE` (or mission-defined equivalent);
- distinguish normal defect from genuine prerequisite/product/architecture change;
- do not edit owner code until correction ownership is explicitly transferred.

Review PASS certifies the reviewed scope only, not the entire mission/product.

## 6. Root cause, authority and scope

Codex must never:

- patch only a symptom when the invariant/authority is wrong;
- move tenant/person/role/state/decision authority into the browser;
- fabricate a missing backend authority with UI behavior;
- expand into another module/mission to avoid a blocker;
- weaken/remove a critical test to obtain GREEN;
- invent staging/production facts.

Classify discoveries according to `AGENTS.md`: `NORMAL_DEFECT`, `IMPLEMENTATION_DETAIL`, `ENVIRONMENT_BLOCKER`, `GENUINE_PREREQUISITE`, `SCOPE_EXPANSION`, `PRODUCT_DECISION`, `ARCHITECTURE_CHANGE`.

Continue through normal in-scope defects. Stop only when the classification requires a new authority/decision/scope or an unsafe/destructive action.

## 7. Persistence, tenancy and identity

For schema/identity/enrollment/finance/other critical work:

- historical applied migrations are immutable;
- migration ordering/clean bootstrap are proved as required;
- tenant scope is server-derived and negatively tested;
- client identifiers do not become authorization;
- retryable multi-write operations define transaction/idempotency/concurrency semantics;
- cross-tenant behavior fails closed and non-disclosing;
- duplicate Person/Student/Enrollment/financial outcomes are release blockers where applicable.

## 8. Evidence and resource discipline

Use the configurator's progressive context and evidence classes.

### Context

Start with L0/L1, then open directly affected files/contracts. Expand to historical/broad repository investigation only with evidence.

### Evidence

- `FRESH`: run now.
- `REUSABLE`: keep only while current delta does not touch its authority.
- `INVALIDATED`: rerun.

### Test cost ladder

`targeted RED/GREEN -> affected tests -> affected regressions -> checkpoint gate -> aggregate/final gate`.

Do not rerun already-valid expensive proof merely for ceremony. Do not skip mandatory proof for savings.

Use the minimum subagents necessary. If SIU/resource-management is available, use it; if unavailable, apply the same discipline manually.

If the same approach fails twice without new evidence, stop repeating it and reclassify the root cause.

## 9. Complementarity with Antigravity

Codex and Antigravity may work in parallel only on independent tasks or against a frozen shared contract.

Allowed patterns:

- Codex implements → Antigravity reviews.
- Antigravity implements → Codex reviews.
- Separate independent backend/UI tasks with explicit ownership and contract.

Forbidden: both agents independently editing/redesigning the same authority and reconciling later by convenience.

## 10. Completion gates

Codex may report a task `GREEN` only for the exact proven scope. It may not infer mission completion from a task GREEN.

Mission/product gates remain separate:

- `ENGINEERING_GREEN`;
- `INTEGRITY_GREEN`;
- `PRODUCT_GREEN`;
- `HUMAN_UAT_GREEN`.

`DONE` requires every applicable gate, integration evidence and truthful Project State update.

## 11. Handoff and session/credit recovery

Return compact factual handoff:

```text
MISSION=
TASK=
OWNER=Codex
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

If credits/context/session end, preserve this state in Git/ledger where possible. A new session resumes from repository state rather than replaying full historical chat.

## 12. Integration

A task checkpoint enters its mission branch only after applicable evidence + independent review. A mission enters `main` only after applicable aggregate gates, adversarial product review, Human UAT and PR review.

Commit/push/PR/merge/deploy remain separate side effects unless explicitly authorized. Codex may not be sole approver of its own integration.

## 13. Success criterion

Codex succeeds by producing **verified, recoverable Nexus progress per unit of resource**, not by maximizing code volume, tool calls, subagents or prose. A truthful `BLOCKED` with the exact prerequisite is preferable to a fabricated `DONE` or an architecture-breaking workaround.

## 14. SHA-bound handoffs with Antigravity

Codex records one of the following durable handoffs for every independently reviewed unit:

```text
HANDOFF_TYPE=IMPLEMENTATION
MISSION=
TASK=
OWNER=Codex
REVIEWER=Antigravity
BASE_SHA=
HEAD_SHA=
BRANCH=
IMPLEMENTED=
RISKS_CLOSED=
PROOF_EXECUTED=
PROOF_NOT_RUN=
KNOWN_LIMITATIONS=
AUTHORITY_CHANGED=
SCHEMA_CHANGED=
WORKTREE_CLEAN=
REMOTE_SYNC=
REVIEW_TARGET=
```

```text
HANDOFF_TYPE=REVIEW
REVIEWED_HEAD=
P0=
P1=
P2=
OBSERVATIONS=
FALSE_POSITIVES=
TEST_GAPS=
MERGE_SAFE=YES|NO
```

The reviewer starts `READ_ONLY` and reviews the exact `REVIEWED_HEAD`. Codex must not treat a review of an earlier SHA as approval for a correction. A reviewer that needs to change Codex-owned work records `WRITE_TRANSFER_REQUIRED=YES`; no edit occurs until the transfer is explicit. Codex remains the writer unless that transfer is recorded.
