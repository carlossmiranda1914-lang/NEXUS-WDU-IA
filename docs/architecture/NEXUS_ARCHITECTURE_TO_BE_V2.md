# Nexus Edu IA — Architecture TO-BE v2

**Status:** CANONICAL target architecture  
**Purpose:** convert product direction and AUDIT-01 evidence into enforceable architecture boundaries.

## 1. Architectural thesis

Nexus is one integrated platform composed of bounded domains sharing explicit platform capabilities. Integration does not mean shared-table chaos. Separation does not mean isolated portals.

## 2. Layers

1. **Experience:** app shell, task-first/context-first workspaces, navigation, search, notifications, contextual BI and AI assistance.
2. **Application:** authorized commands, queries, transactions and orchestration.
3. **Domain:** entities, invariants, policies and domain events.
4. **Workflow:** process state, tasks, approvals, blockers, SLAs and evidence.
5. **Infrastructure:** PostgreSQL, storage, outbox/events, realtime, external integrations and AI providers.

## 3. Platform capabilities

These are transversal and must not be reimplemented independently by each module:

- Person / Identity / Membership;
- InstitutionalContext and tenant authorization;
- Academic temporal context;
- audit/correlation/evidence;
- document/file storage contract;
- idempotency primitives;
- event/outbox infrastructure;
- realtime tenant isolation;
- integration credentials and external-account separation;
- policy/authorization primitives.

## 4. Domain authority

| Domain | Owns | Must not own |
|---|---|---|
| Identity/IAM | Person identity, login binding, Membership | student debt, grades, class structure |
| Enrollment | application/intake lifecycle, registration evidence, activation | long-term grades/finance |
| Academic Core | year, program/course, class/level, subject, assignment | payments |
| Student | institutional StudentProfile and student relationships | duplicated person identity |
| Finance | fee rules, obligations, financial documents, payments, allocations, adjustments, ledger | cloned Student/Class/Course |
| Assessment | assessment configuration, entries, validation/publication history | teacher identity authority |
| Attendance | attendance facts and justified exceptions | enrollment identity |
| Documents | document policy/evidence/files/publication/signature contracts | arbitrary localStorage documents as truth |
| Communication | message/notification delivery facts | global tenantless broadcasts |
| BI | read models/metrics | new transactional source of truth |
| AI | recommendations/orchestration through authorized use cases | direct table-write authority |

## 5. Canonical identity model

Authentication answers who the account is. Membership answers where and with which institutional role the person acts. Person identity and institutional relationships are distinct. A user-visible `role` in a legacy user table is not authorization authority.

Person resolution is fail-closed. Cross-institution possible matches do not reveal foreign-tenant identity details without an authorized decision path. Identity mutation must eventually receive the same collision protection as intake resolution.

## 6. Multi-tenancy

Every business operation derives institution context on the server. Tenant boundaries are enforced at multiple levels:

- authenticated Membership/InstitutionalContext;
- application policies;
- repository queries;
- institution-aware unique constraints and composite foreign keys where meaningful;
- negative cross-tenant tests;
- realtime room/channel isolation;
- cache keys including tenant/context.

A frontend filter is never a tenant boundary.

## 7. Data authority and schema evolution

PostgreSQL migrations are the single schema-evolution authority. Runtime startup may validate prerequisites but must not silently become a second migration engine. A migration or initialization failure that invalidates safe operation must fail closed rather than announce operational readiness.

New domains should prefer database invariants for states that must never exist, following the strongest patterns already present in Enrollment/document migrations.

## 8. Enrollment and Student lifecycle

Enrollment state transitions are explicit domain policy. Activation is a dedicated transactional use case that synchronizes the Enrollment and StudentProfile invariants and records evidence. Generic status mutation must not bypass activation semantics.

StudentProfile represents the person's institutional student relationship; Student 360 is a read projection, not another write model.

## 9. Academic Core

Canonical teaching operations require explicit temporal assignments. `Teacher × Class × Subject × AcademicYear` is modeled as data, not JSON/string arrays. Assessment and Attendance authorization derives from those assignments.

## 10. Finance

Finance is ledger-oriented. Critical writes are idempotent and transactional. Reconciliation, payment confirmation, reversal/refund and adjustments are explicit use cases with audit evidence. Balance is a projection over movements. Financial operations may not mutate a legacy `outstandingFees` field as the sole source of truth.

## 11. Documents

Document policy is versioned and published immutably. Enrollment snapshots preserve the requirements valid at the time of the process. Physical files use authorized storage with hash, size, MIME, state and idempotency evidence. Browser localStorage is not institutional document storage.

## 12. Events and outbox

Business state change and durable event registration occur in the same transaction when downstream effects matter. Consumers are idempotent. In-memory event buses may be used for local non-critical concerns but do not satisfy durable delivery requirements.

## 13. Audit truth

Audit records factual actions and actors. Presentation may translate technical codes into user language but must not invent receipts, signatures, approvals or other events that did not occur. System-derived reconciliation is distinguishable from a human command.

## 14. AI Gateway

All AI execution follows:

`InstitutionalContext → tool/use-case policy → minimized retrieval → model → validation → confirmation when required → authorized application command → audit`.

Every tool has its own authorization and tenant checks. The model's selection of a tool never grants permission.

## 15. External integrations

External OAuth/account authorization is separated from the primary Nexus authentication session. Disconnecting Drive/Sheets or another provider must not sign the user out of Nexus or silently replace the authenticated institutional identity.

## 16. UX architecture

The app shell preserves institution, temporal context, role and entity context. Domain routes are feature-owned. Long workflows use dedicated workspaces. Contextual BI and authorized cross-domain read projections reduce repeated searches without duplicating transactional data.

## 17. Repository target

```text
src/
  app-shell/
  features/
  shared/
  design-system/
server/
  api/
  application/
  domain/
  workflow/
  security/
  audit/
  infrastructure/
    db/
    events/
    storage/
    integrations/
```

This is a migration target, not permission for a repository-wide rewrite.

## 18. Architecture gates

A capability is not DONE unless applicable evidence proves: domain owner; canonical data authority; backend authorization; tenant isolation; real persistence; transaction/idempotency behavior; failure states; audit; desktop/tablet/mobile behavior; automated tests; CI; and documentation alignment.
