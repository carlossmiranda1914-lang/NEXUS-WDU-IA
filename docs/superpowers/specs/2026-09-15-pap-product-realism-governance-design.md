# Nexus Edu IA — Product Realism + PAP Governance Design

**Status:** APPROVED DESIGN FOR REVIEW  
**Date:** 2026-09-15  
**Scope:** repository governance and PAP knowledge capture only  
**Production code:** unchanged by this design  

## 1. Purpose

Nexus Edu IA has two simultaneous objectives that must remain explicitly separated:

1. **Product objective:** continue developing Nexus as a real institutional system intended to solve real school/education-management problems with durable, secure and scalable engineering.
2. **Academic objective (PAP):** make the real project understandable, documentable and presentable by the student author, without weakening or simplifying the product architecture merely for presentation convenience.

The PAP objective is subordinate to product truth. It governs explanation, knowledge capture and presentation evidence. It does not redefine product correctness.

## 2. Core invariant

```text
FINALIDADE_DO_PRODUTO != FINALIDADE_ACADEMICA
```

Nexus remains a real institutional product.

```text
PRODUCT_PURPOSE=REAL_INSTITUTIONAL_SYSTEM
PAP_PURPOSE=UNDERSTANDING_DOCUMENTATION_PRESENTATION
```

The academic presentation must never cause the product to adopt fake, disposable, demo-only or architecturally weaker behavior.

### Product Realism Invariant

> PAP requirements govern explanation and evidence, not product truth.

### No Demo-Driven Architecture

> A feature must not be implemented differently merely because a simpler version would be easier to demonstrate to a jury. When educational explanation is difficult, improve the explanation, not the engineering contract.

## 3. Non-negotiable prohibitions

The PAP context does **not** authorize:

- fake data presented as operational truth;
- decorative cards or UI elements that simulate capabilities that do not exist;
- demo-only modules treated as finished product capability;
- disposable production databases;
- in-memory state presented as durable institutional state;
- frontend-owned institutional authority;
- fake endpoints or mocked persistence presented as real;
- authentication/authorization bypass for presentation;
- weakened tenant isolation;
- simulated uploads presented as stored documents;
- visual success without authoritative persistence;
- architecture simplification solely to make the system easier to explain;
- weakening tests, audit, idempotency, concurrency or failure handling to accelerate a demo.

When test/UAT/demo data is needed, it must be clearly classified as test evidence and never confused with production behavior.

```text
TEST_DATA != PRODUCT_TRUTH
UAT_DATA != PRODUCTION_DATA
DEMO_FIXTURE != PRODUCTION_AUTHORITY
```

## 4. Professional product obligations remain authoritative

For every relevant Nexus capability, the existing engineering contracts remain fully applicable, including:

- PostgreSQL as durable authority where defined by the domain;
- server-side institutional context and authorization;
- multi-tenant isolation;
- exact and immutable business truth where required;
- transactions and rollback semantics;
- idempotency for retryable critical operations;
- audit/outbox where required;
- concurrency safety;
- explicit failure handling;
- realistic operational scale;
- real API/UI integration;
- persistence readback;
- independent evidence and UAT where required.

The PAP layer may document these mechanisms but cannot replace, bypass or dilute them.

## 5. Realistic scale rule

Nexus should be engineered for plausible institutional scale, not only for small presentation fixtures and not for hypothetical infinite scale.

```text
REALISTIC_SCALE=REQUIRED
HYPOTHETICAL_INFINITE_SCALE=NOT_REQUIRED
```

For capabilities where scale is materially relevant, the implementation contract should define a small `SCALE_PROFILE`:

```text
EXPECTED_VOLUME=
CONCURRENT_USAGE=
DATA_GROWTH=
LARGE_LIST_BEHAVIOR=
TRANSACTION_RISK=
STORAGE_RISK=
PERFORMANCE_RISK=
```

This profile is required only where scale can materially affect correctness or usability, including examples such as students, enrollments, financial records, documents, uploads, messages, reports, notifications and imports.

The purpose is to prevent implementations that work with five records but fail in a real school context.

## 6. Two independent completion dimensions

Product completion and PAP readiness are separate.

Every material capability may have:

```text
PRODUCT_STATUS=
PAP_STATUS=
```

Examples:

```text
PRODUCT_STATUS=CLOSED
PAP_STATUS=KNOWLEDGE_CAPTURE_PENDING
```

or:

```text
PRODUCT_STATUS=IN_PROGRESS
PAP_STATUS=DOCUMENTED_AS_IN_PROGRESS
```

A successful demonstration does not close product engineering:

```text
DEMO_WORKS=YES
!=
PRODUCT_STATUS=CLOSED
```

A capability becomes PAP-ready only when the product state is truthful and the author can explain it.

```text
PRODUCT_CLOSED
+
AUTHOR_UNDERSTANDING
+
PAP_DOCUMENTATION
=
PAP_READY
```

## 7. PAP knowledge-capture contract

For each material capability that becomes relevant to the PAP, create or update one concise Feature Record containing:

```text
FEATURE=
INSTITUTIONAL_PROBLEM=
USER=
WHY_IT_EXISTS=

USER_FLOW=

FRONTEND=
API=
BACKEND=
DATABASE=
SECURITY=

IMPORTANT_CODE=
TESTING=
KNOWN_LIMITATIONS=

HOW_I_EXPLAIN_THIS_TO_THE_JURY=
WHAT_I_LEARNED=
```

The Feature Record must be grounded in repository reality. It must distinguish:

- implemented behavior;
- planned behavior;
- blocked behavior;
- external dependencies;
- future improvements.

It must never rewrite planned functionality as implemented functionality.

## 8. PAP documentation structure

Create a lightweight canonical academic area:

```text
docs/pap/
├── README.md
├── PAP_PROJECT_SCOPE.md
├── PAP_TECHNICAL_MAP.md
├── PAP_DATABASE_GUIDE.md
├── PAP_DEVELOPMENT_JOURNAL.md
├── PAP_PRESENTATION_GUIDE.md
└── feature-records/
    └── FEATURE_RECORD_TEMPLATE.md
```

### `README.md`
Explains the purpose of the PAP documentation and makes clear that it does not override product architecture or engineering authority.

### `PAP_PROJECT_SCOPE.md`
Defines what Nexus is, the institutional problem, current delivery scope, implemented/in-progress/planned/externally-blocked boundaries and the academic delivery boundary.

### `PAP_TECHNICAL_MAP.md`
Explains the system in human terms: frontend, client/API boundary, backend, PostgreSQL, Firebase identity, tenancy, file/document storage, integrations and major modules.

### `PAP_DATABASE_GUIDE.md`
Explains the main database concepts and why they exist, including important relationships and domain separation. It is not a schema dump.

### `PAP_DEVELOPMENT_JOURNAL.md`
Chronological record of meaningful implementation work, problems discovered, decisions made, evidence obtained and lessons learned. It should be concise enough to maintain continuously.

### `PAP_PRESENTATION_GUIDE.md`
Translates the real architecture and implemented capabilities into a jury-facing explanation without inventing behavior.

### Feature Records
One record per significant capability, created only when the capability is materially relevant. Do not create one file per trivial UI interaction.

## 9. Code-commenting rule

The project must not be converted into line-by-line tutorial code.

Use comments to explain **why**, authority, invariants or non-obvious constraints; do not narrate obvious syntax.

```text
COMMENT_INTENT_NOT_SYNTAX=YES
```

Appropriate examples include:

```ts
// Institution authority comes from the authenticated server context.
// Never trust an institutionId supplied by the browser here.
```

and:

```ts
// Issued financial documents are immutable.
// Corrections create a linked document instead of rewriting history.
```

Comments that merely restate the next line are discouraged.

## 10. Author-understanding requirement

AI agents may implement code, tests and documentation, but must not replace the student's understanding.

```text
THE_AGENT_MAY_WRITE_THE_CODE=YES
THE_AGENT_MAY_REPLACE_AUTHOR_UNDERSTANDING=NO
```

For significant capabilities, after engineering closure the project workflow should support an explanation pass covering, as applicable:

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

The author should be able to explain:

- what problem is solved;
- why the architecture is structured this way;
- what the important code does;
- what data is persisted;
- what the security boundary is;
- what tests prove;
- what is not yet implemented.

## 11. Relationship to existing governance

This design does not replace the current engineering governance.

### `AGENTS.md`
Must reference the Product Realism + PAP contract in the mandatory reading/governance chain so all implementation agents know the rule before coding.

### Execution Contract
`docs/operations/NEXUS_EXECUTION_CONTRACT_PILOT.md` remains the Finance execution pilot. It should receive a short transversal clause that:

```text
PRODUCT_REALISM_CONTRACT=MANDATORY
PAP_REQUIREMENTS_CANNOT_WEAKEN_PRODUCT_ENGINEERING=YES
PAP_KNOWLEDGE_CAPTURE_REQUIRED_FOR_PAP_READY=YES
```

This does not turn the Finance pilot into a PAP manual and does not change the pilot's authority model.

### Documents module
Documents remains outside the Finance execution pilot where already defined, but it is **not** outside the transversal Product Realism/PAP governance. The Documents analyst must follow the same product-realism invariant and knowledge-capture rules.

### Other modules
IAM, Students, Academic, Enrollment, Finance and future modules inherit the same transversal governance without duplicating the contract in each module.

## 12. Canonical governance artifact

The implementation of this design should create one concise cross-project authority:

```text
docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md
```

This file becomes the canonical contract for the relationship between product engineering and PAP obligations.

It should contain only durable rules, not module-specific implementation history.

## 13. Development workflow integration

For material capabilities, the normal engineering workflow remains primary:

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

The PAP layer follows without changing product authority:

```text
PRODUCT_CLOSURE
-> AUTHOR_EXPLANATION
-> FEATURE_RECORD
-> PAP_JOURNAL_UPDATE
-> PAP_READY
```

For an in-progress capability, PAP documentation may record the truthful current state without declaring it closed.

## 14. Report-building strategy

The PAP report should be built incrementally from repository evidence rather than reconstructed at the end of development.

For significant work, the journal/feature record should capture:

1. problem identified;
2. analysis;
3. solution chosen;
4. architecture involved;
5. implementation summary;
6. database implications;
7. interface behavior;
8. security/authority implications;
9. tests/evidence;
10. result;
11. problems encountered;
12. decisions made;
13. limitations;
14. future improvements;
15. student learning.

This is knowledge capture, not a second implementation report for every commit.

## 15. Truthful scope for the PAP delivery

The project does not need to pretend that every planned Nexus capability is complete by the PAP delivery date.

The academic scope must distinguish:

```text
IMPLEMENTED_AND_PROVEN
IN_DEVELOPMENT
PLANNED
BLOCKED_BY_EXTERNAL_DEPENDENCY
OUTSIDE_PAP_SCOPE
```

External barriers, unfinished integrations and future modules must be presented truthfully. The PAP may demonstrate a robust bounded product slice rather than falsely claiming total platform completion.

## 16. Anti-bureaucracy constraints

This governance must improve rigor without creating documentation debt that slows product development.

Therefore:

- no Feature Record for trivial changes;
- no duplicate architecture documents;
- no separate PAP copy of implementation code;
- no mandatory repository-wide audit for every PAP update;
- no forced rewriting of historical plans;
- no requirement to comment every function or line;
- no repeated explanation of unchanged architecture;
- update only PAP records affected by the current material capability.

## 17. Implementation scope for this governance change

The follow-up implementation plan should be documentation-only and limited to:

1. create `docs/governance/NEXUS_PRODUCT_REALISM_AND_PAP_CONTRACT.md`;
2. create the initial `docs/pap/` structure and Feature Record template;
3. add a concise mandatory reference in `AGENTS.md`;
4. add the short transversal clause in `docs/operations/NEXUS_EXECUTION_CONTRACT_PILOT.md`;
5. add discoverability links in the closest canonical documentation index if required by existing repository conventions;
6. do not alter product code, tests, migrations, schemas, APIs or module authority;
7. do not rewrite historical evidence solely to adopt new wording.

## 18. Acceptance criteria

The governance change is complete when:

```text
CANONICAL_PRODUCT_REALISM_CONTRACT=YES
AGENT_DISCOVERABILITY=YES
DOCUMENTS_ANALYST_COVERED=YES
FINANCE_PILOT_NOT_REDEFINED=YES
PAP_DOC_STRUCTURE_CREATED=YES
PRODUCT_VS_PAP_STATUS_SEPARATED=YES
NO_DEMO_DRIVEN_ARCHITECTURE_RULE=EXPLICIT
REALISTIC_SCALE_RULE=EXPLICIT
AUTHOR_UNDERSTANDING_CONTRACT=EXPLICIT
PRODUCTION_CODE_CHANGED=NO
TESTS_CHANGED=NO
```

A future agent must be able to answer, from repository documentation alone:

1. Is Nexus still a real product rather than a PAP demo? **Yes.**
2. May PAP convenience weaken architecture/security/persistence? **No.**
3. Must important work be understandable and documentable by the student? **Yes.**
4. Is Documents covered even though it is outside the Finance execution pilot? **Yes.**
5. Are Product completion and PAP readiness the same state? **No.**

## 19. Non-goals

This governance change does not:

- change the Finance F7 roadmap;
- reopen closed Finance authorities;
- redesign Documents;
- define a new product architecture;
- change the database;
- change runtime behavior;
- create demo data;
- create presentation-only product features;
- require completion of the entire Nexus platform before PAP delivery;
- replace the current engineering operating system.

It adds one transversal rule: **build Nexus as a real product, and make the real product progressively understandable and presentable.**
