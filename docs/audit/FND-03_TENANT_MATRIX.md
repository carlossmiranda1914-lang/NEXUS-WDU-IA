# FND-03 — Tenant Surface Matrix

**Status:** DoR evidence, 2026-08-24. **Baseline:** `d84dd0a` (FND-01/FND-02 DONE).  This matrix imports only surviving canonical and explicitly transitional paths from FND-02; fenced mutations and browser-only prototypes are excluded.

| ID | Domain/status | Entrypoint → query/storage | Context/predicate/DB defence | Allow / cross-tenant / client-ID evidence | Realtime/cache/storage/report | Risk/treatment/checkpoint |
|---|---|---|---|---|---|---|
| CTX-01 | Canonical context | `requireAuth` → `resolveInstitutionalContext` | Firebase UID → active Membership; requested header validated, never authoritative | no membership 403; multi-membership selection 409; foreign selection 403 | N/A | P0 PRESERVE, CP2; `institutional-context.test.ts` |
| ENR-01 | Canonical Enrollment/StudentProfile | enrollment controllers/APIs → vNext tables | `institutionalContext`, institutional predicates and composite ownership constraints | A allow/B non-disclosure; body/header B rejected | no realtime/cache; document metadata scoped | P0 PRESERVE, CP2; enrollment PostgreSQL contracts |
| DOC-01 | Canonical Enrollment Documents | controller/API → `enrollment_documents`, events | context + enrollment ownership/state policy; FK/snapshots | A allow; B is NOT_FOUND; direct ID cannot switch context | metadata only; physical-file contract must be traced | P0 PRESERVE, CP5; S02.3 PostgreSQL |
| TASK-01 | Canonical School Tasks | modular controller/service/repository | `multiTenantMiddleware` derives tenant from context; repository tenant argument/ownership | A allow; header/query B 403; foreign task ID scoped to A | tenant WebSocket room; `tenant:<id>:<key>` cache; export scoped | P0 PRESERVE, CP2/4/6 |
| IAM-01 | Transitional request-access/self-profile | `/api/profile/request-access` and profile reads | authenticated identity; Membership remains authorization owner | must retain no-membership/multi-membership negatives | no room/cache | P1 TRANSITION, CP3 |
| TEA-01 | Transitional Teachers | legacy HTTP/read-write surfaces → `teachers`/ownership bridge | legacy role + ownership bridge; complete repository predicate unproven | test direct B ID/header/body cases | global legacy events are dropped by `broadcastToAll` | P1 FIX, CP3 |
| FIN-01 | Transitional Finance | invoices/payment/reconcile + AI invoice tool | legacy role/ownership; all joins/aggregates require sweep | test B invoice/student and manipulated IDs | global events dropped; reports/export unproven | P0 FIX, CP3/5/6 |
| COM-01 | Transitional Communication | chat/announcements → tables | legacy route context; latest-row/race finding remains | reproduce A/B visibility and non-disclosing error | legacy global broadcast intentionally drops without context | P0 FIX, CP3/4 |
| GDOC-01 | Transitional generic Documents | SchoolDocuments/API → `uploaded_documents` | ownership bridge varies by operation | test file ID B, MIME/hash/size/path handling | storage key/download/export unproven | P0 FIX, CP5 |
| AUTO-01 | Transitional Automations/Approvals | HTTP/jobs → tables/logs | legacy role; workflow ownership incomplete | test direct B ID and retry batch scope | events/global notification must stay dropped | P1 FIX, CP6 |
| SLA-01 | Transitional SLA worker | startup interval → `school_tasks.sla_status` | batch source/predicate needs trace; no client context | fixture A/B batch must prove no mixing | no room/cache authority | P1 FIX, CP6 |
| AI-01 | Transitional enabled AI tools | `/api/chat` dispatcher → legacy reads/writes/logs | Firebase auth only; no per-tool InstitutionalContext policy | model/body tenant selection must be rejected/fenced | responses/logs must not disclose B | P0 FIX/FENCE, CP6 |
| RT-01 | Canonical Tasks realtime | WebSocket upgrade → `SchoolTaskWebSocketManager` | UID → context; socket tenant fixed at connection | A cannot subscribe B; reconnect/membership suspension require integration proof | room `tenant-<institutionId>` | P0 PRESERVE, CP4 |
| CACHE-01 | Canonical Tasks cache | `SchoolTaskCache` | caller supplies verified tenant | A/B same local key is isolated | key `tenant:<id>:<key>`; tenant invalidation | P1 PRESERVE, CP6 |
| MIG-01 | Canonical migration infrastructure | runner/ledger | target DB only; no tenant business query | N/A for tenant entity access | no realtime/cache/storage | P2 PRESERVE, CP6 |

## Confirmed characterization findings

- `multiTenantMiddleware` rejects conflicting header/query tenant IDs and derives all task aliases from `InstitutionalContext`.
- Task WebSocket clients receive a fixed tenant at verified connection, reject `SUBSCRIBE` for another tenant and broadcasts require a nonblank verified institution.
- Task cache keys are tenant-prefixed and invalidation is tenant-prefixed.
- FND-02 left global `broadcastToAll` calls in transitional legacy code, but its function deliberately drops events without institutional context. This is safe-fail behaviour, not proof that each transitional repository/query is scoped.
- P0 remediation candidates are FIN-01, COM-01, GDOC-01 and AI-01; their complete allow/deny/repository/storage traces are CP3/CP5/CP6 entry gates. No P0/P1 path is unclassified.

## Standard fixture and future negative contract

Use disposable Institution A/B, `institution_admin` A/B, `secretariat` A, teacher A, no-membership user and explicit multi-membership user; synthetic IDs only. Each CP must prove A allow, B deny/non-disclosure, header/body/query tenant distrust, manipulated entity ID, row-count/fingerprint no-mutation, safe audit output and relevant realtime/cache/storage scope.
