# FND-03 — Tenant Sweep DoR Evidence

**Mission:** FND-03 — Tenant Sweep
**State:** READY — awaiting explicit implementation authorization.
**Baseline:** `main` / `d84dd0a486f61e5830bab81578197f0593b1283c`.

## Readiness decision

FND-01 schema authority and FND-02 write authority are DONE and integrated. The surviving-path import, tenant matrix, characterization and locked CP0–CP7 plan are complete. The matrix identifies no unclassified P0/P1 institutional path and no conflict with canonical InstitutionalContext, Person/Identity/Membership, Enrollment, Documents or modular Tasks authority.

## Characterization evidence

- `tests/institutional-context.test.ts`: active Membership selection is fail-closed.
- `tests/multi-tenant.test.ts`: client tenant header cannot override `InstitutionalContext`.
- `tests/websocket-isolation.test.ts` and `tests/realtime-bridge.test.ts`: Task rooms reject foreign subscription and broadcast only to the verified tenant.
- `tests/institution-resource-ownership.test.ts`: ownership bridge resolves only active-institution identifiers.
- FND-01 CP4 PostgreSQL and S02.3 document PostgreSQL remain canonical regression anchors.

## AC01–AC09 DoR plan

| AC | DoR status | Implementation evidence gate |
|---|---|---|
| AC01 matrix | READY | all surviving matrix rows traced |
| AC02 API isolation | READY | A/B direct-ID integration tests |
| AC03 client-ID distrust | READY | header/body/query manipulation tests |
| AC04 repository isolation | READY | SQL/repository predicate contracts |
| AC05 realtime | READY | upgrade/room/reconnect tests |
| AC06 cache | READY | A/B key and invalidation tests |
| AC07 storage/reports | READY | file/export authorization tests |
| AC08 AI | READY | enabled-tool policy/context tests |
| AC09 bridges | READY | bridge ownership/fence tests |

## Risks and stop conditions

FIN-01, COM-01, GDOC-01 and AI-01 are P0 transitional remediation candidates. Their paths are classified but must not be changed until their CP proves a canonical owner or approved fail-closed fence. Missing physical-storage ownership, an unscoped batch/AI tool, or a repository that cannot be safely scoped without a future domain is a stop condition, not permission to infer ownership.

## Explicit exclusions

No production fix, schema/migration, RLS rollout, IAM redesign, Finance/Academic/Documents/Communication redesign, push, PR, merge or deployment is authorized by this DoR.

## CP3 closure

Finance and Communication HTTP endpoints are fail-closed pending canonical authority. Teacher legacy operations and request-access are fail-closed because no complete institutional ownership predicate is proven. Generic Documents are formally deferred to mandatory CP5: metadata and physical object ownership, direct-ID authorization, MIME/hash/size/path and download/export negatives must be proven together before any replacement/removal decision.

## CP4 closure

CP4 is PASS. WebSocket token verification and InstitutionalContext resolution occur before room registration; invalid identity closes before assignment. Foreign subscriptions are rejected, publication without institutional context emits no event, and reconnect removes the prior socket before a new authorized context is resolved. Multi-membership context is not merged: a client `SUBSCRIBE` cannot add a foreign or prior institution. The Task realtime bridge remains tenant-scoped. CP5 files/storage/reports is next; FND-03 is not DONE.

## CP5 closure

CP5 is PASS. Generic Documents are fenced with `CANONICAL_DOCUMENT_AUTHORITY_REQUIRED` before database metadata, physical storage, audit-success or events because joint DB/object ownership is unproven. Direct document/file/path/client tenant IDs therefore have no authority. The only mounted export in scope is canonical School Tasks export, protected by `multiTenantMiddleware`; the legacy duplicate route is not mounted. Enrollment Documents remain canonical and are preserved by their PostgreSQL regression. CP6 is next; FND-03 is not DONE.
