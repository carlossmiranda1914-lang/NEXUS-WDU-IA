# Nexus Edu IA — Codex Execution Adapter

**Status:** SUPPORTING execution adapter  
**Authority:** subordinate to `AGENTS.md`, `docs/README.md`, canonical product/architecture/audit/roadmap documents and the active Mission Pack.  
**Purpose:** make Codex execute exactly the approved mission without inventing scope or architecture, while using implementation time/tokens efficiently.

## 1. Start condition

Codex may edit production code only when all are true:

- the active Mission Pack exists;
- Mission Pack state is `READY`;
- explicit implementation authorization has been given;
- required external/environment evidence is available;
- repository preflight is not BLOCKED;
- no canonical-source conflict is unresolved.

Otherwise Codex remains in analysis/evidence mode without changing the mission to a non-canonical state.

## 2. Mandatory first response before editing

Before the first code change, Codex must output a compact execution header:

```text
MISSION: <ID>
STATE: <official mission state>
BASELINE: <branch/SHA>
OBJECTIVE: <one sentence>
PRIMARY PAIN/ROOT CAUSE: <one sentence>
INVARIANTS: <3-8 bullets>
IN SCOPE: <areas/files/domains>
OUT OF SCOPE: <explicit exclusions>
PRESERVE: <existing gold/patterns that must not regress>
TEST/EVIDENCE PLAN: <ordered list>
STOP CONDITIONS: <mission-specific conditions>
```

If the state is not `READY`, or any field cannot be filled from canonical sources/repository evidence, do not edit.

## 3. Required reading declaration

Codex must confirm it read the exact canonical files required by `AGENTS.md` plus the active Mission Pack and referenced evidence. It must not claim a file was consulted if it was not opened.

Historical/archive documents may be used only when the Mission Pack or a canonical source explicitly points to them.

## 4. AS-IS verification before implementation

The Mission Pack is a contract, but AS-IS claims must still be verified against the active implementation baseline. Codex must confirm:

- target symbols/files still exist;
- no later commit already solved the issue;
- current behavior matches the finding;
- relevant tests/CI paths still exist;
- no unrelated local/branch changes conflict with the mission.

If the finding is stale, STOP and report rather than implementing an obsolete fix.

## 5. Change strategy

Codex must prefer the smallest reversible change that satisfies the full invariant.

Forbidden without explicit Mission Pack authority:

- repository-wide refactor;
- renaming broad directories/modules;
- speculative abstractions;
- new product features;
- opportunistic UX cleanup;
- new dependencies merely for convenience;
- weakening/removing critical tests;
- silently changing domain semantics;
- converting legacy compatibility structures into canonical architecture without a documented decision.

## 6. Test-first behavior for defects/invariants

When the mission corrects a verified defect or invariant failure:

1. create/identify the test that fails for the current defect where practical;
2. show that the test targets the documented invariant, not implementation details;
3. implement the minimal correction;
4. show the focused test passing;
5. run required negative/security/concurrency tests;
6. run relevant regression and global gates from the Mission Pack.

If a red test cannot be created safely, Codex must explain why and use another explicit evidence method approved by the mission.

## 7. Database/migration missions

For schema work Codex must:

- never edit an already-applied migration to hide drift;
- preserve deterministic migration ordering;
- validate existing data before stronger constraints;
- add compatibility migrations only when the Mission Pack explicitly permits them;
- distinguish transitional schema from canonical domain schema in comments/docs;
- use preflight before shared-environment mutation;
- stop on ambiguous tenant ownership or destructive conversion;
- prove clean migration-only bootstrap when required;
- prove application startup no longer mutates schema when that is an invariant;
- include recovery/roll-forward evidence.

For FND-01 specifically, the Mission Pack is `READY` for implementation planning/execution only after explicit implementation authorization. READY does not authorize commit, push, merge or deploy.

## 8. Tenant/security missions

Every touched institutional path requires an explicit answer:

- where institution context comes from;
- which policy/role authorizes the action;
- how repository/query scope is enforced;
- whether DB constraints add defence in depth;
- which cross-tenant negative test proves isolation.

No UI filter or request body institution ID counts as authorization.

## 9. AI/tool missions

Codex must never treat LLM tool selection as authorization. AI execution must pass through the same application policies/use cases as non-AI execution. Every tool requires independent role, tenant, validation and audit checks.

## 10. UX missions

Codex must implement from product/experience rules, not invent a layout from convenience. Required checks include task-first flow, context preservation, explicit states, mobile/tablet/desktop behavior and real backend persistence/authorization.

Do not copy reference-market UI literally; follow the ADOPT/ADAPT/REJECT decisions in the Master Plan.

## 11. Progress reporting

During a long implementation Codex reports only meaningful checkpoints:

- verified root cause;
- first failing test/evidence;
- implementation boundary completed;
- new blocker or scope conflict;
- validation result.

Do not narrate every command.

## 12. Discovered adjacent problems

Classify each discovery:

- **BLOCKS CURRENT MISSION + IN SCOPE** → may fix with evidence;
- **BLOCKS CURRENT MISSION + OUT OF SCOPE** → STOP and move the mission to `BLOCKED` if safe continuation is impossible;
- **DOES NOT BLOCK** → record as finding/follow-up, do not fix;
- **INVALIDATES MISSION ASSUMPTION** → STOP and return the mission to `PREPARATION` or `BLOCKED` according to the evidence.

This prevents scope creep disguised as helpfulness.

## 13. Completion output

Codex may say `DONE` only after the Mission Pack DoD is fully satisfied. Final report must use an official mission state from `docs/DEFINITION_READY_DONE_EVIDENCE.md`:

```text
MISSION: <ID>
FINAL STATE: DONE | VALIDATING | IMPLEMENTING | BLOCKED
BASELINE → HEAD: <refs>

IMPLEMENTED
- ...

INVARIANTS PROVEN
- ...

TESTS / EVIDENCE
- <command/test>: PASS/FAIL/BLOCKED/NOT RUN

MIGRATION / DATA SAFETY
- ...

TENANCY / SECURITY
- ...

REGRESSIONS / BUILD
- ...

KNOWN RESIDUAL RISKS
- ...

DOCUMENTATION UPDATED
- ...

NEXT AUTHORIZED ACTION
- none unless explicitly defined by roadmap/mission state
```

A partial result remains `IMPLEMENTING`, `VALIDATING` or `BLOCKED`; it must never be renamed DONE or assigned an invented state.

## 14. Commit/PR discipline

Codex must not assume that permission to edit also grants permission to commit, push, open a PR, merge or deploy. Those actions remain separate authorization gates.

Commit messages should identify the Mission ID when practical. A PR must stay scoped to the mission and include test/evidence summary and unresolved risks.

## 15. Absolute prohibitions

Codex must not:

- continue a BLOCKED mission;
- invent or use a non-canonical mission state to bypass a gate;
- start the next mission automatically;
- merge the frozen checkpoint merely because it contains useful work;
- invent missing staging/production facts;
- fabricate tests, CI results, migration runs or UI validation;
- report a mock/prototype as operational behavior;
- hide a failing test by removing it from CI;
- weaken tenant/security policy to make a flow pass;
- alter canonical product/architecture to justify an easier implementation;
- use prior chat memory as authority over repository sources.

## 16. Success criterion

The objective of this adapter is not to make Codex produce more code. It is to make each implementation **predictable, auditable, reversible and aligned with the approved Nexus architecture/product plan**.

The mission objective is achieved only when the real root cause/invariant defined by the Mission Pack is fixed and proven. A workaround that merely hides the symptom is not success.

## 17. Priority order during implementation

When several possible actions exist, Codex must choose in this order:

1. **Protect safety and data integrity** — tenancy, authorization, PII, finance, migrations, destructive operations.
2. **Preserve approved invariants and existing gold** — vNext patterns explicitly marked PRESERVE must not be discarded merely because replacing them is easier.
3. **Remove the root blocker of the active mission** — solve the cause that prevents the mission outcome.
4. **Prove the smallest critical path** — focused failing test/contract before broad edits where practical.
5. **Implement the smallest complete change** that satisfies all mandatory AC/invariants.
6. **Run negative/regression evidence** before cleanup/optimization.
7. **Only then improve local clarity/performance** when it is directly required for the mission.

Do not spend implementation budget on formatting, unrelated cleanup, speculative abstractions, broad comments or future-proofing that does not move a mandatory acceptance criterion from FAIL/NOT RUN to PASS.

## 18. Objective persistence and failure-recovery protocol

An error, unexpected legacy dependency or failing test does **not** automatically justify abandoning the mission or changing the objective. Use this protocol:

1. **Reproduce** — capture the exact failure and affected invariant.
2. **Classify** — implementation defect, stale assumption, missing dependency, data/environment blocker, or out-of-scope architectural conflict.
3. **Localize** — identify the narrowest root cause and all equivalent entry paths that can reproduce it.
4. **Protect** — do not remove/disable working safeguards, tests, constraints or preserved vNext behavior just to proceed.
5. **Choose the smallest safe recovery**:
   - if in-scope and architecture-preserving → fix and continue;
   - if a prerequisite can be satisfied inside approved scope → satisfy it and continue;
   - if it requires new product/domain authority, destructive data decision, unknown tenant ownership, unavailable environment/secret, or scope expansion → STOP/BLOCK;
   - if the Mission Pack assumption is false → return to `PREPARATION`/`BLOCKED`, update evidence; do not improvise a new mission.
6. **Re-run the failed evidence first**, then widen regressions.
7. **Continue toward the original observable objective** only while the approved invariants remain valid.

Codex must not "contornar" a problem by bypassing authorization, replacing PostgreSQL with local state, hardcoding data, swallowing errors, disabling tests, inventing mocks as real flows, or silently changing the requirement.

## 19. Token/credit efficiency protocol

Efficiency means reducing redundant reasoning/tool usage **without reducing evidence or safety**.

### Reading discipline
- Read the canonical chain once at mission start, then keep a compact working summary of objective, invariants, scope, preservation rules and stop conditions.
- Do not repeatedly reopen large canonical documents unless a concrete ambiguity requires it.
- Open only the Mission Pack-referenced ADR/evidence/domain material needed for the current step.
- Prefer targeted symbol/file searches over full-repository rereads after the initial AS-IS map.

### Execution discipline
- Work in **micro-loops**: one failing invariant → one minimal change → one focused test.
- Prefer existing patterns/utilities over designing new frameworks.
- Reuse already-proven command/test results within the same unchanged HEAD; do not rerun expensive global gates after every small edit.
- Run cheap/focused tests first; widen to PostgreSQL/integration/regression/static/build when the focused change is stable or when the Mission Pack explicitly requires earlier proof.
- Avoid generating long prose, alternative implementations or speculative plans during coding; report only decisions that affect scope, risk, evidence or next action.
- Do not inspect unrelated directories "just in case".
- Do not fix non-blocking adjacent defects in the current mission.

### Validation budget
Use the minimum test surface that proves the current step, but never omit mandatory DoD evidence. Final validation still runs every applicable gate required by the Mission Pack.

### Retry control
If the same approach fails twice for the same root cause without new evidence, STOP repeating it. Reclassify the failure, inspect the underlying contract/dependency and choose a new evidence-based path or block the mission.

## 20. Prompt execution contract

A user/orchestrator prompt to Codex should be intentionally short. It should **reference**, not duplicate, canonical repository documentation.

Recommended mission-start prompt:

```text
Execute only Mission <ID> on the approved implementation baseline.

Before editing:
1. read AGENTS.md and follow its canonical reading order;
2. read docs/operations/CODEX_EXECUTION_ADAPTER.md;
3. read the active Mission Pack and every source/evidence it explicitly requires;
4. verify current Git/AS-IS state and run the required read-only preflight;
5. output the mandatory execution header from the Codex adapter.

Do not edit if the Mission is not READY, explicit implementation authorization is absent, AS-IS contradicts the Mission Pack, or a stop condition is met.

Implement the smallest complete change that satisfies the Mission Pack. Preserve all items marked PRESERVE. Follow test-first/root-cause discipline, classify adjacent discoveries, and stop rather than expand scope.

Optimize token/credit usage according to the adapter: targeted reads, focused tests first, no repeated broad scans or speculative implementation. Do not trade safety/evidence for token savings.

Do not start another Mission, commit, push, open/merge a PR or deploy unless separately authorized.
```

The prompt must not restate hundreds of lines of architecture. The repository is the persistent context; the prompt selects the mission and grants the relevant authorization.

## 21. Session/context exhaustion recovery

If Codex approaches context/token exhaustion or a session is interrupted:

1. do not widen scope to "finish quickly";
2. leave the code in a testable/recoverable state when possible;
3. record compact factual handoff: Mission, official state, baseline/head, completed ACs, current failing evidence, files touched, unresolved blocker and exact next safe action;
4. on resume, re-read only `AGENTS.md`, `PROJECT_STATE`, active Mission Pack, adapter, current diff and the evidence needed for the next action;
5. do not replay full historical chat or broad research unless a canonical conflict requires it.

A context reset must not reset mission scope, architecture authority or acceptance criteria.

## 22. Realistic completion rule

Codex is expected to pursue the approved mission objective through normal implementation defects, legacy surprises and test failures, but **not at any cost**.

It must continue when the obstacle is an in-scope technical defect with a safe architecture-preserving solution. It must stop when continuing would require violating a canonical invariant, inventing missing facts, making an unapproved destructive decision, crossing tenant/security boundaries, or expanding into another mission/domain.

Professional success is either:

- `DONE` with every mandatory criterion/evidence proven; or
- `BLOCKED` with the exact blocker, evidence, protected work and smallest prerequisite needed to resume.

A truthful BLOCKED result is preferable to a fabricated DONE or a workaround that creates architectural debt.