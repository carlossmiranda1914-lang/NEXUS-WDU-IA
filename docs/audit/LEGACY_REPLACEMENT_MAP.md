# Nexus Edu IA — Legacy Replacement Map

**Status:** CANONICAL migration decision map  
**Rule:** retire legacy authority by capability, not by deleting whole tables/components prematurely.

| Legacy capability/source | Current problem | Canonical destination | Decision | Removal gate |
|---|---|---|---|---|
| `users` role/status administration | Competes with Firebase + Identity + Membership; user creation may not create usable identity | Person + Identity + Membership + explicit onboarding/provisioning | REPLACE | canonical create/invite/request-access path tested; no authorization reads legacy role/status |
| legacy `students` identity fields | Person/student/academic/finance mixed | Person + StudentProfile | REPLACE incrementally | reads/writes for identity and student status use vNext only |
| legacy `students` class/course fields | denormalized academic context | Academic Core enrollment/class assignment | REPLACE | canonical Academic Core exists and consumers migrated |
| legacy `students` grades/attendance | aggregate fields rather than domain history | Assessment + Attendance | REPLACE | canonical domains and read projections exist |
| `outstandingFees` on student | mutable balance masquerades as finance truth | Finance ledger/read model | REPLACE | obligations/payments/adjustments migrated and reconciled |
| legacy invoices/payment status | status-centric, weak validation/reconciliation semantics | Finance bounded context | REPLACE | ledger-backed payment lifecycle and idempotency proven |
| legacy teacher JSON arrays | no explicit temporal Teacher×Class×Subject relation | Academic Core TeacherAssignment | REPLACE | assignment model + authorization tests |
| school docs in localStorage/DataURL | browser persistence and sensitive duplication | Document domain + authorized storage | REPLACE | storage contract + document metadata/read APIs live |
| GlobalSearch synthesized entities | fabricated projections/hardcoded defaults | canonical search/read model | REPLACE | indexed/authorized search over real sources |
| Parent Portal demo | hardcoded guardian/student/payment/message behavior | authorized-students + Student 360 + real Finance/Communication | REBUILD | required canonical domains exist |
| Google Sheets import to React state | external API real, institutional write fake | connector → validated import command → Enrollment/Academic use case | ADAPT | canonical import workflow with preview/idempotency/audit |
| shared Firebase auth for Google connector | integration identity can replace/logout Nexus identity | separate OAuth credential/integration account | REPLACE | integration disconnect cannot affect Nexus session |
| AI direct tools/table writes | LLM path can bypass use-case policy/tenant checks | AI Gateway → authorized application commands | REPLACE | per-tool policy, confirmation and audit tests |
| in-memory/local event bus for critical downstream effects | no durable delivery | transactional outbox/events | ADAPT | durable outbox and idempotent consumers for critical events |
| duplicate Tasks routes in `server.ts` | safe modular route coexists with unsafe legacy authority | tenant-safe module controller/service/repository | REMOVE legacy path | route inventory proves one authoritative path |
| runtime schema DDL | second schema authority and partial-start risk | versioned migrations + startup validation | REMOVE authority | clean DB migration + startup failure tests + CI |
| transformed audit narratives | presentation can invent business facts | factual audit event + separate safe presentation | REFACTOR | raw evidence immutable; presentation mapping tested |
| client “security profiles” | UI state implies security without backend policy | backend policy/RBAC configuration where product requires it | REPLACE/rename | security claims match backend enforcement |
| fake Supabase sync | reports success without operation | no equivalent unless real sync is required | REMOVE | UI/callers removed or real requirement specified |

## Migration rule

A legacy read may temporarily survive after its write authority is removed, but only with an explicit migration purpose and owner. No new feature may depend on a legacy source simply because it is easier to query.

## Anti-big-bang rule

Do not perform `students old → students new` as a single migration. Split identity, institutional student profile, academic structure, finance, assessment, attendance and documents into their owning domains. Preserve historical data with reconciliation evidence.
