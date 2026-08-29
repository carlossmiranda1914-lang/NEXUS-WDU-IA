# NEXUS Project State

Updated: 2026-08-26

Closeout update: ACADEMIC-01 canonical temporal Academic Core is complete on `codex/academic-01-temporal-structure`; it establishes additive Class/Subject/TeacherAssignment/StudentAcademicPlacement authority, tenant-safe temporal history, optimistic concurrency and factual audit. Attendance, Assessment, Student 360 and ACADEMIC-02 remain out of scope.

This file records the current factual engineering state only. It is not a historical diary and must not present planned work as implemented.

## 1. Official repository baseline

- Repository: `carlossmiranda1914-lang/NEXUS-WDU-IA`.
- Comparison baseline: `main`.
- Foundation exit integration: merge `e63054b81bc77a4cb438606ef584cbd4bb878f78` (PR #74).
- Frozen implementation branch: `codex/enrollment-p0-foundation`.
- Frozen checkpoint: `689d1dd8919a25e91911ae118c5aad9ff69c5862`.
- Draft implementation checkpoint PR: `#65`.
- PR #65 is an audit/checkpoint artifact and is not authorized for merge or deploy.
- Documentation consolidation branch: `docs/nexus-canonical-consolidation`.
- Documentation PR: `#66`.

## 2. Current phase

**Foundation Authority Convergence is complete. No Part 2 implementation is authorized until an IAM Mission Pack independently passes DoR and receives explicit implementation authorization.**

The FND-01–FND-06 Foundation sequence is complete and integrated in `main`. IAM-01 implementation was recovered and validated on `codex/iam-01-recovered` from `8c0a0239a0786c2561ef1ef94e1fb869555bf714`: `0019` establishes Membership versioning, unique active Person × Institution membership, IAM intent/ledger/event integrity and tenant-safe FKs; the recovered command service, IAM audit producer, HTTP routes and Membership read API were verified against the approved local disposable PostgreSQL target. This branch remains unmerged; no UI, deployment or legacy-authority reactivation is implied.

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
2. FND-02 — Legacy Write Authority & Fences — DONE — integrated through PR #69 / merge `d84dd0a`; system wipe and legacy student mutations fail closed before token/request/persistence handling; the legacy SLA background writer remains an explicit transitional authority pending a canonical scheduler decision;
3. FND-03 — Tenant Sweep — DONE — CP0–CP7 tenant isolation evidence is complete; transitional Generic Documents, AI and SLA remain fail-closed pending canonical authority;
4. FND-04 — Product Truth Cleanup — DONE — CP0–CP7 PASS. The bounded 27-claim matrix has zero UNKNOWN rows; unavailable/prototype/local-only surfaces no longer present institutional success or availability, canonical Enrollment/Enrollment Documents metadata-state/School Tasks paths remain preserved, and backend Membership/InstitutionalContext remains authority. Dashboard/Search await authorized projections; Enrollment Documents does not claim physical storage; IAM/capability and connector domains remain dependencies. CP6 recorded `test:fnd04` (26 contracts), lint, build and diff PASS; CP7 documentation-only closure rechecked diff, FND-04-diff secret scan, temporary-artifact scan and commit scope. Tracked credential-bearing development configuration and Firebase browser configuration predate FND-04 and remain the mandatory FND-06 gate: remove tracked credential-bearing configuration, rotate potentially active credentials, validate Firebase restrictions/rules and add CI secret detection. FND-05 DoR/decision was the next authorized action at that checkpoint; Foundation closure was completed later through FND-06.
5. FND-05 — Audit Truth — DONE — CP0–CP7 PASS. Canonical audit/history paths are factual; generic `/api/logs` is fenced, realtime is refresh-only, observability is operational metadata only, and AI/background/connectors remain no-effect. AT-09 is not durable audit; retention, integrity, export and historical remediation remain dependencies. No schema or historical-data rewrite occurred. FND-06 DoR/decision is next and retains mandatory secret-management controls;
6. FND-06 — CI vNext Gate — **DONE** — CP0–CP7 PASS and integrated in `main` through `e63054b81bc77a4cb438606ef584cbd4bb878f78`. The exit evidence covers the fail-closed `quality-gate`, disposable PostgreSQL migration/rollback/tenant-isolation/teardown contracts, trigger coverage, Linux secret scanning, controlled failures and final remote workflow. The earlier CP2 external-rotation blocker was reconciled by CP7 external IAM/restrictions evidence; no history rewrite, repository setting, production-source change or credential-value handling occurred. Advanced `main` branch-protection settings remain unverified/unconfigured because of GitHub plan/visibility limits; this is an accepted governance follow-up, not a claim that a post-merge CI run was green.

Foundation completion does not start a mission automatically. IAM is the next canonical tranche. `IAM-01` has a recovered, tested implementation on `codex/iam-01-recovered`; integration still requires normal review and merge, and no further scope is implied.

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

Nexus is **not authorized for broad feature expansion or pilot-readiness claims**. Foundation completion proves only the FND-01–FND-06 convergence scope and its recorded CI evidence; it does not authorize IAM or later product work. Product/platform readiness must be recalculated for each subsequent tranche.

## 13. Update rule

Update this file only when one of these materially changes:

- official baseline/checkpoint or PR state;
- active program/mission or Mission Pack state;
- canonical documentation set;
- major implemented capability;
- major verified architectural/product/security risk;
- release/readiness state.

Use commits, PRs, mission evidence and archive documents for chronology rather than appending daily logs.

## 14. Firebase Auth CSP operational evidence

On 2026-08-27, the production Helmet CSP was verified with an explicit least-privilege `connect-src` allowlist for Firebase Authentication: `identitytoolkit.googleapis.com` and `securetoken.googleapis.com`, plus same-origin Nexus traffic. The policy remains active in production and does not permit a wildcard destination. This is an authentication-connectivity contract only; it does not grant institutional authorization or alter IAM authority.

## 15. IAM / Auth / ENROLLMENT-01 integration baseline

On 2026-08-28, the reviewed integration sequence was merged into `main` without history rewrite:

- PR #78 — IAM recovery baseline — merge `516daab4cd703a294e4db4f47551aeb74d39f4f3`;
- PR #80 — Institutional Access Center, pending activation and AUTH-CSP — merge `91deb51304d485aefbf22fc36373c347e4adf3d4`;
- PR #81 — ENROLLMENT-01 identity-mutation safety — merge `6eceff36dcc829b48abae62ce4244f0ffc4339b1`.

The resulting baseline contains canonical IAM membership authority, the Firebase Auth CSP connectivity contract, and ENROLLMENT-01 registration version authority, stale-write protection, national-ID Person Resolution, factual audit and PostgreSQL/HTTP evidence. PR #79 remains only as the historical recovery reference until its separately recorded equivalence proof is closed as superseded; it is not an integration source for future work.

No next feature mission is implied by this integration. The next roadmap tranche still requires an explicit Mission Pack and authorization.

## 16. ENROLLMENT-02 canonical activation authority

On 2026-08-28, ENROLLMENT-02 completed on `codex/enrollment-02-process-authority-activation`. `Enrollment.active` is a downstream-consumable fact produced only by canonical `ActivateEnrollment`: institution-scoped authorization, version checks, idempotency ledger, atomic Enrollment + StudentProfile activation and factual event/audit in one PostgreSQL transaction. The generic transition route rejects `active`; assignment, reconciliation audit truth and progress semantics have executable evidence. The authoritative quality gate completed `exit=0` with `quality-gate: PASS`. No subsequent mission is authorized implicitly.

## 17. STUDENT-360-01 authorized context projection

On 2026-08-29, STUDENT-360-01 completed on `codex/student-360-01-authorized-context-projection`. It is a server-authorized, tenant-scoped and read-only Student Context projection over existing Person, Membership/InstitutionalContext, StudentProfile, Enrollment, Academic and GuardianRelationship authorities. It has no Student-360 persistence, cache, event or write authority. The projection separates current context from deterministic paginated historical Enrollment/Placement context and exposes only safe Enrollment-document metadata; Finance, Assessment, Attendance and physical Documents remain explicitly `not_yet_authoritative`. The final quality gate recorded `exit=0` and `quality-gate: PASS`. Finance Core has not been started and requires separate authorization.
