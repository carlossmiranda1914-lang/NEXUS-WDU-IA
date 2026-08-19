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

## 3. Why Foundation comes first

AUDIT-01 found competing authorities: migrations vs runtime DDL, canonical Membership vs legacy users, tenant-safe modules vs duplicate legacy routes, factual audit vs invented presentation, real integrations vs simulated success, and new vNext flows alongside client/demo state. Building new modules before convergence would multiply those contradictions.

## 4. Part 1 — Foundation Authority Convergence

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

## 5. Part 2 — IAM

Resolve usable account provisioning, invite/request-access, Membership activation/suspension, email verification semantics, institutional role administration and external-integration identity separation. No admin screen may create a “user” that cannot participate in the canonical auth chain.

## 6. Part 3 — Enrollment hardening

Close remaining process/audit/assignment/identity-mutation concurrency findings. Preserve intake idempotency, state machine, snapshots, physical-file contract and atomic activation.

## 7. Part 4 — Academic Core

Implement temporal academic structure before grades/attendance: program/course, class/level, subject, teacher/staff relation and `Teacher × Class × Subject × AcademicYear`. This is directly supported by the market benchmark and removes teacher JSON-array authority.

## 8. Part 5 — Student 360

Build an authorized read projection only after canonical sources exist. Student 360 must preserve context across enrollment, academic, documents, finance and other authorized domains without becoming a write silo.

## 9. Part 6 — Finance Core

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

## 10. Part 7 — Teaching / Assessment / Attendance

Derive permissions from canonical teacher assignments. Assessment separates entry, validation and publication. Attendance stores real facts/exceptions. Neither domain writes directly into a legacy Student aggregate.

## 11. Part 8 — Documents / Communication / Workflow

Generalize the strong Enrollment document patterns to platform contracts where appropriate. Communication gains tenant-safe delivery facts and durable events. Workflow/process patterns may reuse Enrollment Process concepts after audit semantics are corrected.

## 12. Part 9 — BI

Contextual indicators first, executive BI second, Power BI integration where it adds analytical depth. Every metric identifies its canonical source, calculation, freshness and authorization. No fabricated predictions.

## 13. Part 10 — AI

Only after domain use cases are authoritative. AI tools call authorized commands; per-tool policy, tenant isolation, data minimization, confirmation and audit are mandatory.

## 14. Mission gate

Every mission must state: benchmark/product rationale; architecture contract; findings/gaps; dependencies; IN/OUT scope; files/domains expected; invariants; security/tenancy; migration/rollback; automated and negative tests; manual evidence; stop rules; Definition of Done.

The active Foundation Mission Packs live in `docs/roadmap/missions/`.
