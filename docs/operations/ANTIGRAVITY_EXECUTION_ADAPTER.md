# Nexus Edu IA — Antigravity Execution Adapter

**Status:** SUPPORTING execution adapter  
**Authority:** subordinate to `AGENTS.md`, `docs/README.md`, canonical product/architecture/audit/roadmap documents, `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` and the active Mission Pack.  
**Purpose:** make Antigravity operate as a complementary Nexus engineering agent without creating parallel authority, duplicate work or unreviewed integration.

## 1. Operating role

Antigravity may act as implementer or reviewer according to the engineering configurator. It has no permanent “frontend-only”, “review-only” or secondary status.

A unit of code/authority has one implementation owner at a time. If Antigravity is reviewer, it begins read-only and reports findings before editing. It may implement corrections only after explicit ownership transfer or when the active plan assigns the correction to it.

## 2. Mandatory reading order

Before engineering work:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/operations/PROJECT_STATE.md`
4. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`
5. active Mission Pack
6. referenced spec/plan/ADR/contracts
7. `docs/DEFINITION_READY_DONE_EVIDENCE.md`
8. `docs/operations/NEXUS_ENGINEERING_OPERATING_SYSTEM.md`
9. `docs/operations/ENGINEERING_PLAYBOOK.md`
10. this adapter

Do not use chat history as authority over these sources.

## 3. Start gate

Before editing, verify:

- task ownership is assigned to Antigravity in the configurator/plan;
- branch/worktree and base SHA are identified;
- active Mission Pack is READY/authorized as required;
- scope and forbidden scope are explicit;
- no other agent currently owns the same code/authority;
- preflight/evidence required by the mission is available.

If any of these is materially unresolved, remain read-only and report the exact conflict.

## 4. Implementer mode

When Antigravity is OWNER:

- diagnose the root cause before changing behavior;
- use TDD/contract-first evidence where applicable;
- make the smallest complete change that preserves canonical authority;
- never move tenant/person/role/state authority into the browser;
- run targeted evidence first and widen only when current changes invalidate broader proof;
- checkpoint reviewed work in Git so another agent can recover without chat history.

The implementer does not self-approve product integration.

## 5. Reviewer mode

When Antigravity is REVIEWER:

- start read-only;
- read the spec/plan, diff, tests and claimed invariants before broad repository exploration;
- actively try to refute the implementer’s claims;
- classify findings as `P0`, `P1`, `P2`, `OBSERVATION` or `FALSE_POSITIVE`;
- distinguish implementation defects from product/architecture/scope decisions;
- do not edit the owner’s code until correction ownership is explicitly transferred.

A review PASS means the reviewed task/claim is supported by evidence. It does not mean the whole mission/product is DONE.

## 6. Complementarity with Codex

Codex and Antigravity may work in parallel only when:

- tasks are independent; or
- the shared interface/contract is already frozen.

They must not independently redesign the same authority, migration, component or workflow and reconcile later by convenience.

Recommended patterns:

- Codex implements → Antigravity reviews.
- Antigravity implements → Codex reviews.
- Codex backend A + Antigravity independent UI B against a frozen contract.

Duplicate investigation requires an explicit reason, such as independent security/adversarial verification.

## 7. Resource discipline

Use progressive context from `NEXUS_ENGINEERING_CONFIG.yaml`.

- Start with PROJECT_STATE/config/active task.
- Open only directly affected files/contracts first.
- Reuse evidence that remains valid on the unchanged authority/HEAD.
- Rerun evidence marked or rendered INVALIDATED by the delta.
- Avoid repeated full-repository scans and full quality gates during micro-loops.
- Use subagents only for independent uncertainty or review that materially improves confidence.

Resource savings may never remove TDD, security, tenant isolation, data integrity, independent/adversarial review or required final gates.

## 8. Stop/classification rules

Classify discoveries as:

- `NORMAL_DEFECT` — fix within task scope.
- `IMPLEMENTATION_DETAIL` — resolve without changing product/architecture intent.
- `ENVIRONMENT_BLOCKER` — preserve state and report exact recovery action.
- `GENUINE_PREREQUISITE` — stop dependent work; define smallest missing authority/dependency.
- `SCOPE_EXPANSION` — require explicit authorization.
- `PRODUCT_DECISION` — Product Owner decision required.
- `ARCHITECTURE_CHANGE` — governance/ADR decision required.

Never fabricate missing facts or hide a missing backend authority behind UI behavior.

## 9. Handoff

Every handoff must provide:

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

If credits/session end, this factual handoff plus Git/ledger state is the recovery contract.

## 10. Integration

A task may enter its mission branch only after the applicable implementation evidence and independent review. A mission enters `main` only after its applicable aggregate gates, adversarial product review, Human UAT and PR review.

Antigravity must not merge or approve its own implementation as the sole reviewer.

## 11. Success criterion

Antigravity succeeds when it increases verified Nexus progress while preserving the single canonical product/architecture authority. More code, more agents or more activity are not success metrics by themselves.
