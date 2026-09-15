# Nexus Edu IA — Documentation Index

**Status:** CANONICAL documentation entrypoint  
**Implementation:** Documentation does not authorize product-code changes by itself.

## 1. Mandatory entrypoint

Anyone — human or agent — planning, reviewing or implementing Nexus work starts here. Never let an old mission, chat handoff, prototype, agent prompt or legacy code path become authority merely because it was found first.

For coding-agent execution, `AGENTS.md` is mandatory. All agents also read `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md`, `docs/operations/PROJECT_STATE.md` and `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`. Codex additionally reads `docs/operations/CODEX_EXECUTION_ADAPTER.md`; Antigravity additionally reads `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md`. Adapters never override canonical product/architecture/mission sources.

PAP documentation under `docs/pap/` explains the real project for understanding, report-building and presentation. It is supporting academic documentation and cannot override product, architecture, mission, security, tenancy or implementation authority.

## 2. Authority hierarchy

When sources conflict, stop and resolve the conflict explicitly. Authority order:

1. **Current approved product direction:** `docs/product/NEXUS_MASTER_PLAN_V2.md` and explicit later product decisions.
2. **Current architecture:** `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` plus accepted ADRs that do not conflict with it.
3. **Current roadmap / active Mission Pack:** `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` and `docs/roadmap/missions/`.
4. **Security, tenancy, data and domain contracts** referenced by the active mission, including the transversal Product Realism + PAP contract where applicable.
5. **Current factual state/audit:** `docs/operations/PROJECT_STATE.md`, `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` and `LEGACY_REPLACEMENT_MAP.md`.
6. **Active GitHub issue/PR evidence.**
7. **Current code/schema/tests as AS-IS evidence.**
8. **Supporting Drive/reference documents** when a canonical repository document points to them for source evidence or normative detail.
9. **PAP knowledge-capture documentation** as explanation of current repository truth, never as authority over product behavior.
10. **Archived/superseded missions, plans, tool workflows and historical conversations.**

Code proves what exists; it does not automatically define what should exist. A benchmark proves an observed pattern; it does not automatically authorize a Nexus feature.

## 3. Canonical set

| Need | Source |
|---|---|
| Coding-agent operating contract | `AGENTS.md` |
| Product realism + PAP transversal contract | `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md` |
| PAP knowledge-capture entrypoint | `docs/pap/README.md` (SUPPORTING) |
| Engineering operating system | `docs/operations/NEXUS_ENGINEERING_OPERATING_SYSTEM.md` |
| Current execution selector | `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` |
| Product direction + market decisions | `docs/product/NEXUS_MASTER_PLAN_V2.md` |
| Target architecture | `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` |
| Accepted institutional-context ADR | `docs/architecture/ADR-001-institutional-context.md` |
| Technical AS-IS audit | `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` |
| Legacy replacement decisions | `docs/audit/LEGACY_REPLACEMENT_MAP.md` |
| Documentation classification | `docs/audit/DOCUMENTATION_REGISTER.md` |
| Implementation order | `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` |
| Mission Packs | `docs/roadmap/missions/` |
| Ready/Done/evidence gates | `docs/DEFINITION_READY_DONE_EVIDENCE.md` |
| Engineering workflow | `docs/operations/IMPLEMENTATION_WORKFLOW.md` + `ENGINEERING_PLAYBOOK.md` |
| Codex execution translation | `docs/operations/CODEX_EXECUTION_ADAPTER.md` (SUPPORTING) |
| Antigravity execution translation | `docs/operations/ANTIGRAVITY_EXECUTION_ADAPTER.md` (SUPPORTING) |
| Current factual project state | `docs/operations/PROJECT_STATE.md` |
| Historical evidence | `docs/archive/` |

External Drive sources remain important evidence, but implementation authority derived from them must be summarized/versioned in the repository so execution never depends on undocumented chat/tool availability.

## 4. Information authority

Each information class has one durable home:

- GitHub/repository — technical/executable truth and approved implementation intent.
- Drive — original business/external source material.
- ChatGPT — direction, reasoning and coordination, not durable authority alone.
- Codex/Antigravity sessions — engineering workspaces, not durable authority alone.
- `docs/pap/` — student understanding/report/presentation material grounded in repository truth, not a source of weaker product behavior.

Important discoveries are promoted to the correct canonical source and then referenced rather than duplicated.

## 5. Mandatory traceability

No mission is READY unless it can trace:

`market/institutional evidence → product decision → architecture/domain authority → AS-IS gap → mission scope → tests/evidence → DONE`.

Every implementation agent must additionally prove:

`Mission state → explicit scope → invariants → AS-IS verification → tests/evidence plan → minimal change → negative/regression gates → DoD`.

For PAP-relevant significant capabilities, knowledge capture follows product truth rather than replacing it:

`truthful product state → author explanation → Feature Record/journal update → PAP readiness when applicable`.

## 6. Documentation states

- **CANONICAL** — may govern implementation.
- **SUPPORTING** — useful detail; cannot override canonical sources.
- **HISTORICAL** — evidence of prior work only.
- **SUPERSEDED** — replaced; must not guide new work.
- **PROTOTYPE** — exploratory; no operational authority.

## 7. ADR rule

ADR identifiers are unique. The accepted `ADR-001` is institutional context. A later architectural decision must receive its own ADR or explicit superseding status; do not overload an existing ADR identifier.

## 8. Archive/delete rule

Classify before moving or deleting. Historical evidence is archived when it explains prior decisions or implementation. Permanent deletion is limited to exact redundancy, generated/transient artifacts or content proven to have no historical/operational value.

## 9. Current execution and recovery

Current factual work is never hard-coded in this index. Read:

1. `docs/operations/PROJECT_STATE.md` for where the project is now;
2. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` for the selected active mission/task/owner/reviewer/gates;
3. the active Mission Pack/spec/plan for implementation authority.

A new agent must be able to recover from those sources plus Git state without previous chat history.
