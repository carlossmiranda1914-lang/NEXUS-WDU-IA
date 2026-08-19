# NEXUS Project State

Updated: 2026-08-19

This file records the current factual engineering state only. It is not a historical diary and must not present planned work as implemented.

## 1. Official repository baseline

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Comparison baseline: `main`.
- Frozen implementation branch: `codex/enrollment-p0-foundation`.
- Frozen checkpoint: `689d1dd8919a25e91911ae118c5aad9ff69c5862`.
- Draft implementation checkpoint PR: `#65`.
- PR #65 is an audit/checkpoint artifact and is not authorized for merge or deploy.
- Documentation consolidation branch: `docs/nexus-canonical-consolidation`.
- Documentation-only Draft PR: `#66`.

## 2. Current phase

**Implementation is frozen.**

The current program is documentation governance and planning after a deep repository audit:

`market/real-system benchmark → canonical product/architecture sources → AUDIT-01 AS-IS diagnosis → legacy replacement map → vNext roadmap → Foundation Mission Packs → readiness review → only then implementation`.

Do not continue S04, open opportunistic feature slices, perform UX cleanup unrelated to an approved mission, merge PR #65, or start a new domain merely because work already exists.

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

Current P0/P1 planning blockers include, among others:

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

Use `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` and `docs/audit/LEGACY_REPLACEMENT_MAP.md` for the authoritative planning detail.

## 6. Canonical product and architecture direction

Current primary repository sources in PR #66:

- documentation entrypoint: `docs/README.md`;
- product/benchmark direction: `docs/product/NEXUS_MASTER_PLAN_V2.md`;
- target architecture: `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md`;
- technical audit: `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md`;
- legacy migration map: `docs/audit/LEGACY_REPLACEMENT_MAP.md`;
- roadmap: `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`;
- Foundation mission packs: `docs/roadmap/missions/FND-01.md` through `FND-06.md`.

The market study is incorporated as product decisions, not as permission to copy the reference systems. Key directions include persistent entity context, Student 360 as an authorized projection, explicit Teacher × Class × Subject × AcademicYear assignment, deep but integrated Finance, contextual/executive BI, Task-First/Context-First UX, and rejection of fragmented portals, repeated searches and fake operational success.

## 7. Next implementation tranche — not yet authorized

The planned first tranche is **Foundation Authority Convergence**:

1. FND-01 — Schema Authority;
2. FND-02 — Legacy Write Authority & Fences;
3. FND-03 — Tenant Sweep;
4. FND-04 — Product Truth Cleanup;
5. FND-05 — Audit Truth;
6. FND-06 — CI vNext Gate.

Each mission is currently documentation/planning material. Code may begin only after the individual Mission Pack passes Definition of Ready and explicit authorization.

## 8. Documentation governance phase

DOC-AUDIT-01 is consolidating repository documentation so historical mission logs, Codex-specific workflows, old plans and prototypes cannot silently override current canonical sources.

Rules:

- classify before delete;
- preserve historical evidence in archive when it still explains prior decisions/implementation;
- resolve duplicate ADR identifiers;
- remove tool-specific assumptions from durable engineering governance;
- keep Google Drive useful for external/source artifacts, but keep the implementation-governing canonical summary in the repository;
- update this state file whenever the active phase, baseline, canonical source set or critical verified risk changes.

## 9. Release/readiness statement

Nexus is **not currently authorized for broad feature expansion or pilot-readiness claims** based on surface completeness. Readiness must be recalculated after the Foundation convergence gates close the relevant P0/P1 findings and CI proves the consolidated invariants.

## 10. Update rule

Update this file only when one of these materially changes:

- official baseline/checkpoint or PR state;
- active program/mission;
- canonical documentation set;
- major implemented capability;
- major verified architectural/product/security risk;
- release/readiness state.

Use commits, PRs, mission evidence and archive documents for historical chronology rather than appending daily logs here.
