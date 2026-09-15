# Product Realism + PAP Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved cross-project Product Realism + PAP governance without changing product code, runtime behavior, database, tests, Finance F7 scope, or module authority.

**Architecture:** Create one canonical transversal governance contract, add a lightweight `docs/pap/` knowledge-capture area, and make both discoverable from the existing agent/documentation entrypoints. PAP documentation explains the real product and never replaces product or architecture authority.

**Tech Stack:** Markdown repository governance only.

**Spec:** `docs/superpowers/specs/2026-09-15-pap-product-realism-governance-design.md`

## Global Constraints

- Nexus remains a real institutional product.
- PAP governs understanding, documentation and presentation only.
- Product engineering must not be weakened for presentation convenience.
- Realistic scale is considered where material.
- Documents remains outside the Finance execution pilot but is covered by the transversal governance.
- No source code, tests, schema, migrations, API or runtime behavior changes.
- Historical evidence is not rewritten solely to adopt new wording.

---

### Task 1: Canonical Product Realism + PAP Contract

**Files:**
- Create: `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md`

- [ ] Create the canonical contract from the approved design.
- [ ] Preserve the distinction between product purpose and PAP purpose.
- [ ] Include: Product Realism Invariant, No Demo-Driven Architecture, truthful test/UAT boundaries, realistic-scale profile, separate Product/PAP status, author-understanding requirement, comment-intent-not-syntax rule, Documents/all-module coverage, truthful PAP delivery states, anti-bureaucracy rules.
- [ ] Verify `git diff --check`.
- [ ] Commit: `docs(governance): add product realism and PAP contract`.

### Task 2: PAP Knowledge-Capture Area

**Files:**
- Create: `docs/pap/README.md`
- Create: `docs/pap/PAP_PROJECT_SCOPE.md`
- Create: `docs/pap/PAP_TECHNICAL_MAP.md`
- Create: `docs/pap/PAP_DATABASE_GUIDE.md`
- Create: `docs/pap/PAP_DEVELOPMENT_JOURNAL.md`
- Create: `docs/pap/PAP_PRESENTATION_GUIDE.md`
- Create: `docs/pap/feature-records/FEATURE_RECORD_TEMPLATE.md`

- [ ] Create an entrypoint explaining that PAP docs do not override product/architecture/mission authority.
- [ ] Define truthful delivery states: implemented/proven, in development, planned, externally blocked, outside PAP scope.
- [ ] Create a human-readable technical-map structure for frontend, API boundary, backend, identity/context, PostgreSQL, Documents/files, integrations and modules.
- [ ] Create a database-guide structure that explains concepts and relationships without becoming schema authority.
- [ ] Create a concise journal template for meaningful development events and learning.
- [ ] Create a presentation guide grounded in implemented behavior and explicit limitations.
- [ ] Create the Feature Record template including Product/PAP status, institutional problem, user flow, technical flow, important code, evidence, scale profile when material, truth boundary, jury explanation and learning.
- [ ] Verify no unsupported implementation claims were introduced.
- [ ] Verify `git diff --check`.
- [ ] Commit: `docs(pap): add knowledge capture structure`.

### Task 3: Mandatory Discoverability

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/README.md`

- [ ] Add `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md` to the mandatory reading order immediately after `docs/README.md`.
- [ ] Add one concise AGENTS section stating that all modules and agents follow the contract, Product completion and PAP readiness are separate, and Documents is covered by the transversal rule.
- [ ] Add canonical index entries for the Product Realism/PAP contract and `docs/pap/README.md`.
- [ ] State that PAP documentation explains repository truth but cannot override product/architecture/mission authority.
- [ ] Verify references and `git diff --check`.
- [ ] Commit: `docs(governance): require product realism contract`.

### Task 4: Bind the Finance Execution Pilot Without Redefining It

**Files:**
- Modify: `docs/operations/NEXUS_EXECUTION_CONTRACT_PILOT.md`

- [ ] Add a short transversal clause declaring the Product Realism contract mandatory and PAP knowledge capture required for PAP readiness.
- [ ] State that PAP does not redefine Finance authority, closure evidence or Product status.
- [ ] Preserve the existing Finance execution sequence and Documents exclusion from the Finance pilot.
- [ ] State that Documents is still covered by the transversal Product Realism/PAP governance.
- [ ] Verify `git diff --check`.
- [ ] Commit: `docs(governance): bind execution pilot to product realism`.

### Task 5: Final Verification

- [ ] Confirm changed files are limited to documentation/governance plus this spec/plan.
- [ ] Confirm no product code, tests, schema, migrations or runtime behavior changed.
- [ ] Confirm these concepts are discoverable: real product purpose, PAP explanation purpose, no demo-driven architecture, realistic scale, separate Product/PAP status, author understanding, Documents coverage.
- [ ] Run a placeholder scan and `git diff --check`.
- [ ] Verify exact branch, HEAD and clean working tree.
- [ ] Return:

```text
RESULT=
FINAL_HEAD=
BRANCH=codex/pap-product-realism-governance
CANONICAL_PRODUCT_REALISM_CONTRACT=YES|NO
AGENT_DISCOVERABILITY=YES|NO
DOCUMENTS_ANALYST_COVERED=YES|NO
FINANCE_PILOT_REDEFINED=YES|NO
PAP_DOC_STRUCTURE_CREATED=YES|NO
PRODUCT_VS_PAP_STATUS_SEPARATED=YES|NO
NO_DEMO_DRIVEN_ARCHITECTURE_RULE=YES|NO
REALISTIC_SCALE_RULE=YES|NO
AUTHOR_UNDERSTANDING_CONTRACT=YES|NO
PRODUCTION_CODE_CHANGED=YES|NO
TESTS_CHANGED=YES|NO
SCHEMA_OR_MIGRATIONS_CHANGED=YES|NO
RUNTIME_BEHAVIOR_CHANGED=YES|NO
FILES_CHANGED=
READY_FOR_INDEPENDENT_REVIEW=YES|NO
```

Expected: Finance pilot not redefined; no product/test/schema/runtime changes; ready for independent review.

## Self-Review

The plan covers the approved canonical contract, PAP documentation structure, Feature Record, AGENTS/docs index discoverability, Finance-pilot compatibility, Documents analyst coverage, Product/PAP status separation, realistic scale, author understanding and the prohibition on demo-driven architecture. No product implementation is authorized by this plan.
