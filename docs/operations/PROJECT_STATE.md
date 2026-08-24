# NEXUS Project State

Updated: 2026-08-24

This file records the current factual engineering state only. It is not a historical diary and must not present planned work as implemented.

## 1. Official repository baseline

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Comparison baseline: `main`.
- Frozen implementation branch: `codex/enrollment-p0-foundation`.
- Frozen checkpoint: `689d1dd8919a25e91911ae118c5aad9ff69c5862`.
- Draft implementation checkpoint PR: `#65`.
- PR #65 is an audit/checkpoint artifact and is not authorized for merge or deploy.
- Documentation consolidation branch: `docs/nexus-canonical-consolidation`.
- Documentation PR: `#66`.

## 2. Current phase

**Implementation remains frozen pending explicit implementation authorization.**

The planning/governance phase for Foundation is closed sufficiently to begin the controlled implementation flow once the documentation baseline is accepted and the active mission is explicitly authorized.

Official flow:

`market/real-system benchmark → canonical product/architecture sources → AUDIT-01 AS-IS diagnosis → legacy replacement map → vNext roadmap → Mission Pack → DoR → explicit authorization → implementation → evidence/DoD → factual state update`.

Do not continue S04, open opportunistic feature slices, perform unrelated UX cleanup, merge PR #65, or start a later Foundation/domain mission merely because work already exists.

## 3. AUDIT-01 conclusion

The repository contains two architectural generations:

- a legacy application with broad aggregates, client/localStorage state, simulations, direct/duplicated write paths and several weak domain boundaries;
- a materially stronger vNext foundation around Person/Identity/Membership, InstitutionalContext, Academic Year, Enrollment, document policy/files, state machines, transactions, idempotency and database constraints.

The approved strategy is not full rewrite and not blind continuation. Preserve the strong vNext foundation, remove competing authority capability by capability, then build new domains on the consolidated platform.

Canonical findings: `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md`.

## 4. Gold foundation to preserve

Current high-value foundations include:

- Person / Identity / Membership;
- InstitutionalContext and server-derived tenant authorization;
- Person Resolution and restricted cross-institution match handling;
- Academic Year lifecycle;
- Enrollment intake idempotency/transaction boundaries;
- Registration and GuardianRelationship foundation;
- Enrollment validation gates and state machine;
- atomic activation introduced in the frozen checkpoint;
- document policy snapshots and publication/versioning;
- physical enrollment-file storage contract;
- composite tenant-integrity constraints in later migrations;
- Enrollment Process projection/optimistic concurrency patterns;
- authorized-students helper;
- strongest tenant-safe Tasks/realtime/audit patterns.

These are preservation candidates, not proof that the whole platform is production-ready.

## 5. Critical structural risks

Current P0/P1 risks include, among others:

- migrations competing with runtime schema DDL/self-healing;
- unsafe/false DB readiness semantics;
- legacy identity/user administration competing with canonical Membership authority;
- legacy write paths and duplicate route authority;
- uneven tenant isolation outside the vNext core;
- AI tools with legacy direct-write/tenant risks;
- legacy finance without canonical ledger/payment authority;
- product simulations/mocks presented as operational behavior;
- audit presentation capable of diverging from factual evidence;
- external Google authorization sharing the primary Nexus auth session;
- uneven CI protection across the new foundation.

Use `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` and `docs/audit/LEGACY_REPLACEMENT_MAP.md` for authoritative planning detail.

## 6. Canonical implementation sources

Current primary repository sources in PR #66:

- coding-agent contract: `AGENTS.md`;
- documentation entrypoint: `docs/README.md`;
- product/benchmark direction: `docs/product/NEXUS_MASTER_PLAN_V2.md`;
- target architecture: `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`;
- technical audit: `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md`;
- legacy migration map: `docs/audit/LEGACY_REPLACEMENT_MAP.md`;
- roadmap: `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`;
- Foundation mission packs: `docs/roadmap/missions/FND-01.md` through `FND-06.md`;
- DoR/DoD/evidence: `docs/DEFINITION_READY_DONE_EVIDENCE.md`;
- implementation workflow: `docs/operations/IMPLEMENTATION_WORKFLOW.md`;
- engineering playbook: `docs/operations/ENGINEERING_PLAYBOOK.md`;
- Codex-specific execution translation: `docs/operations/CODEX_EXECUTION_ADAPTER.md` (SUPPORTING; never overrides canonical sources).

The market study is incorporated as product decisions, not as permission to copy reference systems. Key directions include persistent entity context, Student 360 as an authorized projection, explicit Teacher × Class × Subject × AcademicYear assignment, deep but integrated Finance, contextual/executive BI, Task-First/Context-First UX, and rejection of fragmented portals, repeated searches and fake operational success.

## 7. Environment truth

The prior external-evidence blocker is closed by explicit project declaration on 2026-08-20:

- Development — PROVEN;
- CI/Test — PROVEN;
- Staging — **NOT YET PROVISIONED**;
- Production — **NOT YET PROVISIONED**.

This is a project-state declaration, not an inference from missing deployment files.

Any future staging/production environment must adopt this deployment contract before being considered healthy:

`read-only preflight → identify target DB → backup/change gate when data exists → nexus:migrate → migration-ledger/checksum verification → schema validation → application start → health/readiness`.

If later evidence shows a pre-existing shared environment, the affected database/schema mission returns immediately to `BLOCKED` until reconciled.

## 8. FND-01 readiness result

`FND-01 — Schema Authority` is the first implementation mission.

Current state:

**DONE — FND-01 Schema Authority validated on 2026-08-24.**

FND-01 implementation established:

- runtime startup is validation-only and fails closed;
- numbered migrations reproduce the supported schema, including transitional legacy compatibility;
- test setup delegates to the canonical migration runner;
- `school_tasks` + `task_versions` are covered by the tenant-safe reconciliation migration;
- migration ordering, ledger/checksum, recovery and regression contracts are proven;
- staging and production are not yet provisioned and their future deployment contract is fixed.

No subsequent mission is authorized by this completion.

See:
- `docs/roadmap/missions/FND-01.md`;
- `docs/roadmap/missions/FND-01_DOR_EVIDENCE.md`.

## 9. Foundation execution order

The controlled Foundation sequence is:

1. FND-01 — Schema Authority — **DONE**;
2. FND-02 — Legacy Write Authority & Fences — PREPARATION until predecessor DONE and independent DoR passes;
3. FND-03 — Tenant Sweep — PREPARATION;
4. FND-04 — Product Truth Cleanup — PREPARATION;
5. FND-05 — Audit Truth — PREPARATION;
6. FND-06 — CI vNext Gate — PREPARATION.

No mission starts automatically after a previous mission. Each requires an independent DoR and explicit authorization.

## 10. Coding-agent / Codex execution governance

Any coding agent, including Codex, must follow `AGENTS.md`. Codex additionally reads `docs/operations/CODEX_EXECUTION_ADAPTER.md`.

Required execution chain:

`canonical reading → Mission state check → scope/invariants → AS-IS verification → preflight → failing/contract test where applicable → minimal implementation → focused tests → negative/security/tenant tests → regression → migration/static/build gates → evidence → DoD → factual state update`.

Before any future mission edit, Codex must output the mandatory execution header defined by the adapter and re-verify its Mission Pack assumptions.

Chat context is never implementation authority. A later mission cannot be pulled forward by convenience.

## 11. Documentation governance

DOC-AUDIT-01 and the consistency pass consolidated repository documentation so historical mission logs, old plans, tool-specific historical workflows and prototypes cannot silently override current canonical sources.

Rules:

- document only decisions/evidence/contracts that govern implementation;
- preserve historical evidence when it explains prior decisions/implementation;
- keep durable governance tool-neutral;
- use Codex adapter only as an execution translation;
- update this state file only when active phase, baseline, canonical sources, mission readiness or critical verified risk materially changes.

## 12. Release/readiness statement

Nexus is **not authorized for broad feature expansion or pilot-readiness claims**. FND-01 READY means only that its implementation contract is sufficiently defined. Product/platform readiness must be recalculated after Foundation convergence closes the relevant P0/P1 findings and CI proves the resulting invariants.

## 13. Update rule

Update this file only when one of these materially changes:

- official baseline/checkpoint or PR state;
- active program/mission or Mission Pack state;
- canonical documentation set;
- major implemented capability;
- major verified architectural/product/security risk;
- release/readiness state.

Use commits, PRs, mission evidence and archive documents for chronology rather than appending daily logs.
