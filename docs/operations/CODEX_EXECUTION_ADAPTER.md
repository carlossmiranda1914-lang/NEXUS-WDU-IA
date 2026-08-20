# Nexus Edu IA — Codex Execution Adapter

**Status:** SUPPORTING execution adapter  
**Authority:** subordinate to `AGENTS.md`, `docs/README.md`, canonical product/architecture/audit/roadmap documents and the active Mission Pack.  
**Purpose:** make Codex execute exactly the approved mission without inventing scope or architecture.

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
INVARIANTS: <3-8 bullets>
IN SCOPE: <areas/files/domains>
OUT OF SCOPE: <explicit exclusions>
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

For FND-01 specifically, Codex must not begin implementation while its state is `BLOCKED — EXTERNAL EVIDENCE ONLY`.

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
