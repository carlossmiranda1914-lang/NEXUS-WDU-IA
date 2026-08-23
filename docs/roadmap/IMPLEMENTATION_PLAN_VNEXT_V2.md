# Nexus Edu IA — Implementation Plan vNext v2

**Status:** CANONICAL roadmap; code remains frozen until an active mission is READY and explicitly authorized.

## 1. Governing chain

`market/operation evidence → product decision → architecture contract → AUDIT-01 gap → program → Mission Pack → tests/evidence → DONE`.

No step may be skipped because an implementation looks easy.

## 2. Program order

1. **FOUNDATION AUTHORITY CONVERGENCE**
2. **IAM / institutional access lifecycle**
3. **Enrollment hardening and canonical handoff**
4. **Academic Core**
5. **Student 360 read model**
6. **Finance Core**
7. **Teaching / Assessment / Attendance**
8. **Documents / Communication / Workflow expansion**
9. **Contextual + Executive BI / Power BI integration**
10. **AI Gateway / authorized automation**

Order may change only through an explicit decision that updates dependencies and this roadmap.

## 3. Execution/change-control rule

This roadmap is the implementation sequence, not a brainstorming backlog.

Once a Mission Pack becomes `READY`, implementation must execute that approved contract rather than redesign the plan inside the coding task. A change to product direction, domain ownership, architecture authority, mission order, mandatory acceptance criteria or cross-mission dependency requires an explicit planning decision and an update to the canonical source before implementation continues.

Implementation discoveries are classified as:
- **IN-SCOPE DEFECT/DETAIL** — solve inside the active Mission Pack when it is already covered by its objective, invariants and acceptance criteria;
- **BLOCKER** — stop the active step when safe implementation cannot continue without unresolved evidence/authority/data truth;
- **PREREQUISITE** — create or activate the required preceding work; do not absorb it silently;
- **FUTURE SCOPE** — record in the appropriate future program/mission, but do not implement opportunistically.

No coding agent may use implementation convenience, existing legacy code or prior investment as authority to alter this sequence.

## 4. Why Foundation comes first

AUDIT-01 found competing authorities: migrations vs runtime DDL, canonical Membership vs legacy users, tenant-safe modules vs duplicate legacy routes, factual audit vs invented presentation, real integrations vs simulated success, and new vNext flows alongside client/demo state. Building new modules before convergence would multiply those contradictions.

## 5. Part 1 — Foundation Authority Convergence

Foundation is executed as a dependency chain. A later mission may be prepared/read in advance, but implementation does not begin until the required predecessor is DONE and the later Mission Pack independently passes DoR.

`FND-01 Schema Authority → FND-02 Write Authority → FND-03 Tenant Sweep → FND-04 Product Truth → FND-05 Audit Truth → FND-06 CI Gate`

### FND-01 — Schema Authority
**Goal:** migrations become the only schema-evolution authority; startup fails closed when DB prerequisites are unsafe.  
**Origin:** AUD-DB-001/002.  
**Preserve:** numbered migrations, preflight discipline, strongest DB constraints.  
**Exit:** clean database can migrate to target; runtime no longer performs competing business-schema evolution; failure cannot be reported as readiness.

### FND-02 — Legacy Write Authority Map & Fences
**Goal:** identify and fence legacy writes that compete with vNext sources.  
**Origin:** IAM split, legacy students, duplicate Tasks routes, legacy finance/doc writes.  
**Exit:** authoritative write paths are explicit; dangerous duplicates are blocked/removed only after coverage.

### FND-03 — Tenant Sweep
**Goal:** prove institution isolation across every remaining authoritative API/repository/realtime path.  
**Origin:** AI cross-tenant, chat race, ownership bridges, uneven legacy coverage.  
**Exit:** tenant matrix and negative tests cover all authoritative P0/P1 paths.

### FND-04 — Product Truth Cleanup
**Goal:** no prototype/mock/simulation is presented as operational capability.  
**Origin:** fake Supabase sync, Parent Portal demo, GlobalSearch synthesis, localStorage documents, fake signature/certificate language.  
**Exit:** operational UI is real or explicitly prototype/demo and excluded from production authority.

### FND-05 — Audit Truth
**Goal:** audit evidence records what happened, by whom/system, without invented business facts.  
**Origin:** AUD-AUDIT-001, document actor attribution, process reconciliation actor semantics.  
**Exit:** factual raw event contract + safe presentation mapping + actor tests.

### FND-06 — CI vNext Gate
**Goal:** CI protects the actual foundation risk surface.  
**Origin:** uneven suite coverage and S04 gap.  
**Exit:** migration, tenancy, identity, enrollment, document, activation and relevant foundation regression suites run remotely and gate integration.

The detailed executable contract for each Foundation mission is the corresponding file in `docs/roadmap/missions/`. Summary text here never overrides a Mission Pack.

## 6. Foundation exit gate

No Part 2 implementation starts merely because FND-06 is reached. Foundation Authority Convergence is closed only when:
- FND-01 through FND-06 are individually DONE with their required evidence;
- no known P0/P1 competing schema/write/tenant/product-truth/audit authority remains outside an explicitly approved transitional dependency;
- remote CI protects the agreed Foundation invariants;
- `docs/operations/PROJECT_STATE.md` records the resulting factual state;
- the next Mission Pack independently passes DoR and receives explicit implementation authorization.

## 7. Part 2 — IAM

Resolve usable account provisioning, invite/request-access, Membership activation/suspension, email verification semantics, institutional role administration and external-integration identity separation. No admin screen may create a “user” that cannot participate in the canonical auth chain.

IAM implementation must consume the converged Foundation authority. It must not reintroduce runtime schema mutation, duplicate legacy write authority or client-owned tenant context.

## 8. Part 3 — Enrollment hardening

Close remaining process/audit/assignment/identity-mutation concurrency findings. Preserve intake idempotency, state machine, snapshots, physical-file contract and atomic activation.

## 9. Part 4 — Academic Core

Implement temporal academic structure before grades/attendance: program/course, class/level, subject, teacher/staff relation and `Teacher × Class × Subject × AcademicYear`. This is directly supported by the market benchmark and removes teacher JSON-array authority.

## 10. Part 5 — Student 360

Build an authorized read projection only after canonical sources exist. Student 360 must preserve context across enrollment, academic, documents, finance and other authorized domains without becoming a write silo.

## 11. Part 6 — Finance Core

Minimum sequence:

1. finance authority and ledger model;
2. fee/emolument catalogue;
3. obligation/charge rules tied to canonical academic/enrollment context;
4. invoice/document lifecycle where required;
5. payments and allocations;
6. penalties/discounts/credits/adjustments;
7. reversals/refunds;
8. reconciliation with idempotency and transaction boundaries;
9. student financial read model/extract;
10. operational reports and exports.

The legacy `outstandingFees` field cannot remain balance authority.

## 12. Part 7 — Teaching / Assessment / Attendance

Derive permissions from canonical teacher assignments. Assessment separates entry, validation and publication. Attendance stores real facts/exceptions. Neither domain writes directly into a legacy Student aggregate.

## 13. Part 8 — Documents / Communication / Workflow

Generalize the strong Enrollment document patterns to platform contracts where appropriate. Communication gains tenant-safe delivery facts and durable events. Workflow/process patterns may reuse Enrollment Process concepts after audit semantics are corrected.

## 14. Part 9 — BI

Contextual indicators first, executive BI second, Power BI integration where it adds analytical depth. Every metric identifies its canonical source, calculation, freshness and authorization. No fabricated predictions.

## 15. Part 10 — AI

Only after domain use cases are authoritative. AI tools call authorized commands; per-tool policy, tenant isolation, data minimization, confirmation and audit are mandatory.

## 16. Mission gate

Every mission must state: benchmark/product rationale; architecture contract; findings/gaps; dependencies; IN/OUT scope; files/domains expected where knowable from AS-IS evidence; invariants; security/tenancy; migration/rollback; automated and negative tests; manual evidence; stop rules; Definition of Done.

A Mission Pack must be specific enough that two competent executors reading the same canonical sources would implement materially the same scope and prove it with the same acceptance contract. If that is not true, the mission remains PREPARATION/BLOCKED rather than entering implementation.

The active Foundation Mission Packs live in `docs/roadmap/missions/`.

## 17. Plan completion standard

The roadmap is considered ready for implementation by tranche only when the next active Mission Pack is `READY`; its predecessors/dependencies are satisfied; external operational facts required by that mission are known; mandatory AC/evidence are explicit; and no unresolved canonical conflict can change the expected implementation boundary.

The objective is not to eliminate every future discovery. The objective is to ensure discoveries cannot silently rewrite product, architecture, authority or scope during coding.
