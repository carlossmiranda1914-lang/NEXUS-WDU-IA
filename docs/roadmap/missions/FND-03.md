# FND-03 — Tenant Sweep

**State:** PREPARATION. Implementation is not authorized until FND-02 is DONE and this Mission Pack passes DoR.

## Objective
Prove that every remaining authoritative P0/P1 institutional-data path derives institution context server-side and cannot read, mutate, stream, cache or expose another tenant's data.

## Origin
AUD-AI-TENANT-001, AUD-COMM-TENANT-001, ownership-bridge findings, uneven legacy tenant coverage, Master Plan v2 backend-authority principle, and Architecture TO-BE v2 multi-tenancy contract.

## Dependency
- FND-01 must have established stable schema/runtime authority.
- FND-02 must have identified which write paths remain authoritative or transitional; FND-03 tests those actual surviving paths rather than auditing dead/removed competitors.

## Preserve
- InstitutionalContext and Membership-derived authorization;
- existing composite tenant constraints and strongest repository-scoping patterns;
- tenant-safe Enrollment, StudentProfile, Tasks and document flows already proven;
- explicit server-owned context even when the UI already filters by institution.

## IN
Authoritative or explicitly transitional P0/P1 paths that touch institutional data, including:
- HTTP APIs and application commands/queries;
- repositories and direct SQL/data access;
- AI tools still enabled;
- realtime rooms/channels/subscriptions;
- cache keys and cached projections;
- files/storage authorization;
- reporting/export paths;
- background/event consumers;
- legacy ownership bridges still required after FND-02.

For each path record:
1. actor/role;
2. server-side context source;
3. tenant predicate and/or database constraint;
4. object identifiers accepted from the client;
5. allow scenario;
6. cross-tenant deny scenario;
7. direct-ID manipulation scenario;
8. realtime/cache/storage scoping where applicable;
9. audit behavior;
10. remediation state and evidence reference.

## OUT
- redesigning domain models solely to simplify tenancy;
- trusting client-supplied institution/school/tenant IDs as authority;
- UI-only filtering as a remediation;
- implementing unrelated IAM or future-domain features;
- broad database RLS adoption unless an approved architecture decision explicitly adds it.

## Required preflight / evidence
Before editing a path:
- its authoritative status must be known from FND-02;
- institutional owner and context source must be identifiable;
- affected repository/query/realtime/storage/cache behavior must be traceable;
- a failing or missing negative case must be reproducible;
- proposed remediation must preserve valid same-tenant behavior.

## Acceptance criteria
- **AC01 Complete tenant matrix:** every surviving P0/P1 institutional-data path is classified and has a server-side tenant authority description.
- **AC02 Direct API isolation:** cross-tenant read/write using another tenant's valid object ID is denied or returns non-disclosing absence according to the domain contract.
- **AC03 Client-ID distrust:** changing client-provided school/institution/tenant identifiers cannot switch authority context.
- **AC04 Repository isolation:** authoritative repositories/queries include the required institutional predicate or equivalent server-owned constraint.
- **AC05 Realtime isolation:** rooms/channels/subscriptions cannot leak events across institutions.
- **AC06 Cache isolation:** cache keys and cached read models cannot collide across tenant context.
- **AC07 Storage/report isolation:** files, exports and reports cannot be fetched for another institution through identifier manipulation.
- **AC08 AI isolation:** enabled AI tools operate under the same tenant policy as the underlying authorized use case.
- **AC09 Transitional bridges:** any remaining bridge is explicitly fenced, tested and linked to its replacement dependency.

## Required tests / evidence
- automated same-tenant allow and cross-tenant deny tests for every critical path changed;
- direct-ID manipulation tests;
- repository/integration tests where scoping is enforced below the API layer;
- realtime/cache/storage negative tests where applicable;
- audit/log evidence showing no foreign-tenant disclosure in failure output;
- existing functional regressions for affected capabilities;
- TypeScript/build and applicable CI gates;
- tenant matrix with AC-to-evidence references.

## DONE
FND-03 is DONE only when AC01–AC09 are PASS for all authoritative P0/P1 institutional-data paths, no critical path relies on frontend filtering or caller-supplied institution authority, and remaining transitional bridges are explicit and tested.

## Stop rules
Stop and return to BLOCKED/PREPARATION if:
- a domain has no canonical institutional owner/context source;
- remediation would require trusting client-provided tenant context;
- safe isolation requires changing unrelated product/domain authority;
- existing data cannot be mapped safely to tenant ownership;
- a cross-tenant behavior cannot be tested without exposing real PII/secrets.
