# Nexus Product Realism + PAP Contract

**Status:** CANONICAL  
**Scope:** all Nexus modules, agents, analysts and future implementation work.

## 1. Two purposes, one product truth

Nexus Edu IA has two simultaneous purposes that must never be confused:

```text
PRODUCT_PURPOSE=REAL_INSTITUTIONAL_SYSTEM
PAP_PURPOSE=UNDERSTANDING_DOCUMENTATION_PRESENTATION
```

The PAP objective governs explanation, evidence, learning and presentation. It does not redefine product correctness, architecture, persistence, security, tenancy, scale or implementation authority.

**PAP requirements govern explanation and evidence, not product truth.**

## 2. Product Realism Invariant

Nexus must continue to be developed as a real institutional system intended to solve real operational problems in schools and training institutions.

A feature is not allowed to become fake, disposable, demo-only or architecturally weaker because a simpler version would be easier to present.

```text
PRODUCT_CORRECTNESS > PRESENTATION_CONVENIENCE
PAP_READY != PAP_SIMPLIFIED
```

When an implementation is difficult to explain, improve the explanation. Do not weaken the engineering contract.

## 3. No Demo-Driven Architecture

The PAP context does not authorize:

- fake data presented as operational truth;
- decorative UI that simulates non-existent capability;
- demo-only modules treated as finished product;
- disposable production databases;
- in-memory state presented as durable institutional truth;
- frontend-owned tenant, role, eligibility or domain authority;
- fake endpoints or mocked persistence presented as real;
- authentication or authorization bypass for demonstration;
- weakened tenant isolation;
- simulated uploads presented as stored documents;
- visual success without authoritative persistence;
- weakened transactions, idempotency, audit, concurrency or failure handling merely to accelerate presentation.

Test, UAT and demo data are allowed only when explicitly classified:

```text
TEST_DATA != PRODUCT_TRUTH
UAT_DATA != PRODUCTION_DATA
DEMO_FIXTURE != PRODUCTION_AUTHORITY
```

## 4. Existing engineering authority remains primary

All existing Nexus engineering contracts continue to apply, including where relevant:

- PostgreSQL durable authority;
- server-side institutional context and authorization;
- multi-tenant isolation;
- immutable historical truth;
- exact money;
- transaction and rollback semantics;
- idempotency;
- audit/outbox;
- concurrency safety;
- failure handling;
- real UI -> API -> backend -> persistence integration;
- independent evidence and UAT.

PAP documentation may explain these mechanisms but may not replace or bypass them.

## 5. Realistic scale

Nexus must be engineered for plausible institutional scale, not only for small presentation fixtures and not for hypothetical infinite scale.

```text
REALISTIC_SCALE=REQUIRED
HYPOTHETICAL_INFINITE_SCALE=NOT_REQUIRED
```

When scale can materially affect correctness, persistence, UX or performance, the active capability should define:

```text
SCALE_PROFILE
EXPECTED_VOLUME=
CONCURRENT_USAGE=
DATA_GROWTH=
LARGE_LIST_BEHAVIOR=
TRANSACTION_RISK=
STORAGE_RISK=
PERFORMANCE_RISK=
```

Typical candidates include students, enrollments, documents, uploads, payments, messages, notifications, reports and imports.

## 6. Product status and PAP status are independent

Every material capability may have separate states:

```text
PRODUCT_STATUS=
PAP_STATUS=
```

Valid examples:

```text
PRODUCT_STATUS=CLOSED
PAP_STATUS=KNOWLEDGE_CAPTURE_PENDING
```

```text
PRODUCT_STATUS=IN_PROGRESS
PAP_STATUS=DOCUMENTED_AS_IN_PROGRESS
```

The following implication is forbidden:

```text
DEMO_WORKS=YES
=> PRODUCT_STATUS=CLOSED
```

A capability becomes PAP-ready only when its product state is truthful and the author can explain the implemented reality:

```text
PRODUCT_CLOSED
+
AUTHOR_UNDERSTANDING
+
PAP_DOCUMENTATION
=
PAP_READY
```

## 7. Author understanding contract

AI may write code, tests and documentation. It may not replace the student's understanding.

For significant capabilities, the author should be able to explain, as applicable:

```text
Frontend
-> client/API boundary
-> HTTP route
-> authentication/authorization
-> domain/service authority
-> persistence
-> database relationships
-> readback
-> UI result
```

The author should understand:

- the institutional problem;
- why the capability exists;
- the user journey;
- the important code path;
- the database role;
- the security/tenant boundary;
- what tests prove;
- what remains unimplemented or externally blocked.

## 8. PAP knowledge capture

Material PAP-relevant capabilities should use a concise Feature Record grounded in repository truth. It must distinguish implemented, in-development, planned, externally blocked and out-of-scope behavior.

The canonical template lives at:

`docs/pap/feature-records/FEATURE_RECORD_TEMPLATE.md`

PAP documentation must not turn plans into implementation claims.

## 9. Code comments

Use comments to explain intent, authority, invariants or non-obvious constraints.

```text
COMMENT_INTENT_NOT_SYNTAX=YES
```

Do not convert the codebase into line-by-line tutorial code. Comments that merely narrate obvious syntax are discouraged.

## 10. Module coverage

This contract is transversal. It applies to Finance, Documents, IAM, Students, Academic, Enrollment and future modules.

Documents may remain outside the Finance execution pilot, but Documents is not outside this Product Realism/PAP governance.

Module-specific plans may add stricter rules but may not weaken this contract.

## 11. Truthful PAP delivery boundary

The PAP does not require pretending that the entire Nexus platform is complete. Delivery and presentation must distinguish:

```text
IMPLEMENTED_AND_PROVEN
IN_DEVELOPMENT
PLANNED
BLOCKED_BY_EXTERNAL_DEPENDENCY
OUTSIDE_PAP_SCOPE
```

External barriers and unfinished integrations must be presented truthfully.

## 12. Anti-bureaucracy rule

This contract must improve rigor without creating documentation debt that slows product development.

Therefore:

- no Feature Record for trivial changes;
- no duplicate PAP copy of product architecture;
- no duplicate code for presentation;
- no repository-wide audit for every PAP update;
- no forced rewrite of historical plans;
- no requirement to comment every line or function;
- update only PAP records materially affected by current work.

## 13. Relationship to repository authority

This contract complements, and does not replace:

- `AGENTS.md`;
- `docs/README.md`;
- current product and architecture documents;
- active Mission Packs and implementation plans;
- `docs/operations/NEXUS_EXECUTION_CONTRACT_PILOT.md` where applicable.

If PAP documentation conflicts with current product/architecture/mission authority, PAP documentation loses and must be corrected.

## 14. Development flow

Normal engineering remains primary:

```text
INSTITUTION_PROBLEM
-> REAL_USER_JOURNEY
-> EXISTING_CAPABILITIES
-> FACTUAL_GAPS
-> IMPLEMENTATION
-> TESTING
-> VALIDATION_UI
-> VERTICAL_PROOF
-> INDEPENDENT_CLOSURE
```

PAP knowledge capture follows the real engineering state:

```text
PRODUCT_STATE
-> AUTHOR_EXPLANATION
-> FEATURE_RECORD
-> PAP_JOURNAL_UPDATE
-> PAP_READY_WHEN_APPLICABLE
```

**Build Nexus as a real product, and make the real product progressively understandable and presentable.**
