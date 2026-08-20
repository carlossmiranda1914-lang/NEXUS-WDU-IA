# Nexus Mission Pack — [ID] [Outcome]

**State:** BACKLOG | PREPARATION | BLOCKED | READY | IMPLEMENTING | VALIDATING | DONE | CANCELLED | SUPERSEDED  
**Owner:**  
**Dependencies:**  
**Baseline/ref:**

## 1. Problem and outcome

What real institutional/user problem is blocked? What observable outcome must exist when DONE?

## 2. Traceability

- Market/institutional evidence:
- Product decision: ADOPT | ADAPT | KEEP NEXUS | REJECT | INVESTIGATE
- Canonical product source:
- Architecture/ADR contract:
- AUDIT finding / AS-IS gap:
- Dependency missions:

## 3. Scope

### IN

### OUT

## 4. Domain authority

- Owning domain:
- Canonical entities/data:
- Referenced domains:
- Forbidden duplicated authority:

## 5. Actors and authorization

- Actors/roles:
- Institutional context source:
- Resource/relationship checks:
- Cross-tenant negative cases:

## 6. States and invariants

List allowed states/transitions, impossible states and concurrency/idempotency rules.

## 7. Persistence / migration

- Schema change:
- Migration order:
- Existing-data reconciliation:
- Transaction boundary:
- Rollback/recovery:

## 8. API / event / integration contract

Commands, queries, events/outbox, external integrations and failure semantics.

## 9. UX contract

Entry point, task/context preservation, loading/empty/error/conflict/no-permission/success states, desktop/tablet/mobile behavior and applicable visual tokens.

## 10. Test plan

- focused domain/policy tests;
- PostgreSQL/integration tests;
- tenant-negative tests;
- idempotency/concurrency tests;
- migration tests;
- regressions;
- static/type/build;
- manual/user evidence.

## 11. Evidence required for DONE

Exact commands/checks, screenshots/records where applicable, PR/CI evidence and remaining-risk statement.

## 12. Stop rules

List discoveries that require stopping/escalating instead of expanding scope.

## 13. Definition of Ready

READY only when canonical sources, dependencies, scope, authority, invariants, security/tenancy, migration impact, tests/evidence and stop rules are sufficiently resolved to implement without improvising architecture/product decisions. A required external unknown or unresolved condition means PREPARATION/BLOCKED, not conditional READY.

## 14. Definition of Done

DONE only when the required real behavior, persistence, authorization, isolation, failures, tests, evidence, documentation and user-visible states are proven. A screen, endpoint or green local happy-path alone is insufficient.
