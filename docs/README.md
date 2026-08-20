# Nexus Edu IA — Documentation Index

**Status:** CANONICAL documentation entrypoint  
**Implementation:** FROZEN. Documentation does not authorize product-code changes.

## 1. Mandatory entrypoint

Anyone — human or agent — planning, reviewing or implementing Nexus work starts here. Never let an old mission, chat handoff, prototype, Codex prompt or legacy code path become authority merely because it was found first.

For coding-agent execution, `AGENTS.md` is mandatory. When Codex is the implementation agent, also read `docs/operations/CODEX_EXECUTION_ADAPTER.md`; the adapter never overrides canonical product/architecture/mission sources.

## 2. Authority hierarchy

When sources conflict, stop and resolve the conflict explicitly. Authority order:

1. **Current approved product direction:** `docs/product/NEXUS_MASTER_PLAN_V2.md` and explicit later product decisions.
2. **Current architecture:** `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` plus accepted ADRs that do not conflict with it.
3. **Current roadmap / active Mission Pack:** `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` and `docs/roadmap/missions/`.
4. **Security, tenancy, data and domain contracts** referenced by the active mission.
5. **Current factual state/audit:** `docs/operations/PROJECT_STATE.md`, `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` and `LEGACY_REPLACEMENT_MAP.md`.
6. **Active GitHub issue/PR evidence.**
7. **Current code/schema/tests as AS-IS evidence.**
8. **Supporting Drive/reference documents** when a canonical repository document points to them for normative detail.
9. **Archived/superseded missions, plans, tool workflows and historical conversations.**

Code proves what exists; it does not automatically define what should exist. A benchmark proves an observed pattern; it does not automatically authorize a Nexus feature.

## 3. Canonical set

| Need | Source |
|---|---|
| Coding-agent operating contract | `AGENTS.md` |
| Product direction + market decisions | `docs/product/NEXUS_MASTER_PLAN_V2.md` |
| Target architecture | `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` |
| Accepted institutional-context ADR | `docs/architecture/ADR-001-institutional-context.md` |
| Technical AS-IS audit | `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` |
| Legacy replacement decisions | `docs/audit/LEGACY_REPLACEMENT_MAP.md` |
| Documentation classification | `docs/audit/DOCUMENTATION_REGISTER.md` |
| Implementation order | `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` |
| Prepared Foundation missions | `docs/roadmap/missions/FND-01.md` … `FND-06.md` |
| Ready/Done/evidence gates | `docs/DEFINITION_READY_DONE_EVIDENCE.md` |
| Engineering workflow | `docs/operations/IMPLEMENTATION_WORKFLOW.md` + `ENGINEERING_PLAYBOOK.md` |
| Codex execution translation | `docs/operations/CODEX_EXECUTION_ADAPTER.md` (SUPPORTING only) |
| Current factual project state | `docs/operations/PROJECT_STATE.md` |
| Historical evidence | `docs/archive/` |

`docs/ARCHITECTURE_V4.md` remains SUPPORTING during reconciliation; Architecture TO-BE v2 is primary. External Drive sources remain important references, but implementation authority is summarized/versioned in the repository so work does not depend on undocumented chat/tool availability.

## 4. Mandatory traceability

No mission is READY unless it can trace:

`market/institutional evidence → ADOPT/ADAPT/KEEP/REJECT/INVESTIGATE → product requirement → architecture/domain authority → AS-IS finding/gap → mission scope → tests/evidence → DONE`.

Every implementation agent must additionally prove:

`Mission state → explicit scope → invariants → AS-IS verification → tests/evidence plan → minimal change → negative/regression gates → DoD`.

## 5. Documentation states

- **CANONICAL** — may govern implementation.
- **SUPPORTING** — useful detail; cannot override canonical sources.
- **HISTORICAL** — evidence of prior work only.
- **SUPERSEDED** — replaced; must not guide new work.
- **PROTOTYPE** — exploratory; no operational authority.

## 6. ADR rule

ADR identifiers are unique. The accepted `ADR-001` is institutional context (2026-08-10). The earlier duplicate identity/membership proposal has been preserved as `ADR-000-institutional-identity-membership-proposal.md` with SUPERSEDED PROPOSAL status so its reasoning remains available without ambiguous authority.

## 7. Archive/delete rule

Classify before moving or deleting. Historical evidence is archived when it explains prior decisions or implementation. Permanent deletion is limited to exact redundancy, generated/transient artifacts or content proven to have no historical/operational value.

## 8. Current freeze and first mission gate

The frozen enrollment checkpoint and prior implementation remain AS-IS evidence. Do not continue S04, merge PR #65, start a new module or perform opportunistic UX/code cleanup.

The first planned implementation mission is `FND-01 — Schema Authority`, but its current state is **BLOCKED — EXTERNAL EVIDENCE ONLY**. Internal repository investigation is closed; implementation cannot start until staging/production migration/deployment reality is confirmed or those environments are explicitly recorded as not yet provisioned and a future deployment contract is approved.

Implementation resumes only through an individually `READY` Mission Pack plus explicit authorization.
