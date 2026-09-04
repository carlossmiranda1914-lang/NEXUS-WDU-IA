# Nexus Edu IA — F4 Persistence, Migration & Recovery Review

**State:** DESIGN-CLOSED_FOR_FOUNDATION_GATE — NOT IMPLEMENTATION AUTHORITY
**Scope:** approved F4-D01 through F4-D04, F0–F3 constraints, canonical migration runner, current PostgreSQL proof practices and Nexus engineering governance.

## Executive determination

F4-D01 through F4-D04 are approved, coherent and sufficient to define the minimum persistence boundary required to implement and test the Finance foundation.

No additional P0/P1 architectural gap was found that justifies opening F4-D05 before the Finance Foundation Implementation Plan. The remaining implementation-specific choices — exact table names, concrete indexes, lock syntax, isolation levels per command, decimal library and worker mechanics — belong to the implementation plan and approved missions as long as they preserve the laws below.

## Approved F4 decisions

### F4-D01 — Canonical Financial Transaction Boundary
Every authoritative Finance command has one PostgreSQL atomicity boundary for all state required to truthfully establish its economic result. Where applicable this includes authoritative aggregate mutation, complete Journal Transaction and Entries, scoped idempotency identity/fingerprint/result, required factual financial audit/provenance and durable outbox/event intent required for recoverable downstream processing. Either the complete authoritative set commits or none of it does. Reconstructible projections and external/network side effects do not determine whether an already committed economic fact exists.

### F4-D02 — Persistence Integrity & Database Enforcement Law
PostgreSQL is a defense-in-depth authority for stable structural financial integrity. Domain/application code owns economic meaning and policy, while schema constraints, referential integrity, scoped uniqueness and tenant-safe relationships protect persistence-level invariants where deterministically expressible. Confirmed economic facts are not corrected by delete/soft-delete or destructive mutation.

### F4-D03 — Scoped Concurrency & Locking Law
Concurrency protection is scoped to the smallest authoritative resource/identity required to preserve each invariant. PostgreSQL is the final arbiter through scoped uniqueness, aggregate version/CAS and explicit locking/isolation where necessary. Check-then-write without persistence protection is forbidden. Lock acquisition is deterministic when multiple resources are involved. Global Finance locks and blanket SERIALIZABLE are not defaults. External/provider/network calls are never made while canonical Finance locks/transactions are held open.

### F4-D04 — Persistence, Migration & Recovery Proof Contract + Closure Gate
**APPROVED.** F4 implementation claims are valid only when the implementation plan and foundation mission preserve the blocking persistence, migration, recovery and concurrency proof contract below. Failure of any blocking condition prevents DONE and prevents dependent Finance layers from treating the foundation as proven.

| Material risk / invariant | Enforcement expectation | Failure scenario to exercise | Required proof | Blocking condition |
| --- | --- | --- | --- | --- |
| Clean schema cannot be created deterministically | Append-only canonical migrations through existing runner | Empty disposable database | Full ordered migration/bootstrap run on real PostgreSQL | Finance schema requires manual DDL or cannot bootstrap from zero |
| Applied migration history can be rewritten | Existing checksum ledger remains authoritative | Modify an already-applied migration | Migration runner rejects checksum mismatch | Any implementation rewrites applied migration history instead of adding a new migration |
| Migration partially applies | Migration transaction + migration ledger entry commit together | Inject SQL failure mid-migration | Real PostgreSQL rollback proof | Partial Finance schema survives a failed migration |
| Migration ordering is ambiguous | Unique ordered filenames in canonical chain | Duplicate/ambiguous migration order | Discovery/runner rejection | Two migrations can occupy ambiguous order |
| Money/rate persistence loses exactness | Exact PostgreSQL NUMERIC/DECIMAL mapping compatible with F2 envelopes | Boundary and round-trip values | API/domain/PostgreSQL/domain exact round-trip tests | Value, currency, normalization or rate changes across persistence |
| Floating-point financial authority enters schema | Schema forbids REAL/FLOAT/DOUBLE for authoritative money/rates | Schema inspection + attempted path | Migration/schema contract + PostgreSQL behavior | Authoritative Finance value persists through floating-point type |
| Canonical financial transaction partially commits | One DB transaction for required authoritative set | Failure after aggregate, Journal header, entries, audit, idempotency or mandatory outbox stages | Failure-injection PostgreSQL integration | Any required subset survives without the complete economic result |
| DB constraint failure leaves partial authority | Constraints participate in same transaction | Deliberately violate tenant/FK/check/uniqueness late in command | PostgreSQL rollback proof | Earlier economic writes remain committed after later constraint rejection |
| Duplicate idempotency identity commits twice | Scoped uniqueness + transaction-safe command record | Two concurrent identical commands | Concurrent real PostgreSQL proof | More than one canonical economic result commits |
| Same idempotency identity hides different intent | Persist canonical fingerprint with identity | Same key, different canonical command | HTTP/domain + PostgreSQL conflict proof | Different intent is replayed/overwritten as if identical |
| Response lost after commit causes duplicate | Durable result lookup by idempotency identity | Commit succeeds; response is treated as lost; retry | Service/HTTP + PostgreSQL recovery proof | Retry creates a second fact or cannot recover committed result |
| Provider callback duplicate creates another fact | Scoped provider identity uniqueness where applicable | Repeated same provider operation identity | Adapter/HTTP + PostgreSQL integration | Duplicate provider delivery creates duplicate economic effect |
| Legitimate equal-valued operations are deduplicated | Identity is causal/operational, not amount similarity | Two distinct operations with same Money/context | PostgreSQL positive proof | Similar payload prevents a valid second operation |
| Concurrent over-reversal | Lock/CAS/constraint strategy protects remaining reversible value | Two reversals individually valid but jointly excessive | Concurrent PostgreSQL proof | Combined committed reversal exceeds remaining reversible amount |
| Stale aggregate write overwrites newer state | Version/CAS where aggregate mutation is version-sensitive | A/B concurrent expected-version writes | PostgreSQL/service conflict proof | Both stale and current writes commit as if valid |
| Deadlock/serialization abort is mistaken for economic failure/success | DB abort yields no fact; retry uses same idempotency identity | Force/observe transient concurrency abort where practical | PostgreSQL/service recovery proof | Partial fact survives or retry uses a new uncontrolled economic identity |
| Cross-tenant relationship persists | Composite/tenant-safe FK/ownership constraints where applicable | Local Institution + foreign referenced resource | PostgreSQL negative security proof | Foreign-tenant resource can be linked to Finance authority |
| Orphan Journal entry/causal reference persists | Referential integrity | Insert entry/reversal target without valid parent | PostgreSQL rejection | Orphaned economic relation can persist |
| Confirmed economic history can be destructively altered | Append-only repository model plus persistence protection | UPDATE/DELETE confirmed amount/type/currency/entry-set through approved path | Repository/PostgreSQL negative proof | Confirmed economic meaning can be changed in place |
| Required outbox intent can disappear after confirmed fact | Mandatory downstream intent joins canonical commit when required | Fail outbox insert | PostgreSQL rollback proof | Fact commits even though required recoverable intent does not |
| Downstream worker failure rewrites Finance truth | Projection/delivery outside canonical commit; retry/rebuild idempotent | Fail projection/outbox consumer after commit | Recovery/replay integration | Confirmed Journal is rolled back, edited or marked economically failed |
| Restart loses pending recoverable work | Durable outbox/idempotency state survives process restart | Commit fact + pending outbox; restart worker/app | Restart/recovery proof | Required downstream work exists only in memory/transient queue |
| Projection cannot be rebuilt | Projection contains no exclusive economic truth | Drop/clear projection and rebuild | Real PostgreSQL/read-model rebuild proof | Rebuild differs from canonical history or requires hidden mutable legacy state |
| Historical replay uses current policy/FX | Fact preserves historical context/provenance | Change policy/rate/registry after confirmation then rebuild | Historical reproducibility test | Historical position changes under newer configuration |
| Legacy Finance field remains write authority | Legacy path fenced/read-only/non-authoritative | Attempt legacy `outstandingFees` mutation to affect Finance position | Repository/HTTP/read-model regression | Legacy field independently changes canonical financial balance |
| Application restart depends on runtime DDL | Startup validates expected schema; migrations remain sole schema authority | Restart with complete schema and with intentionally missing/incompatible schema | Startup/readiness integration | Runtime silently creates/repairs Finance business schema outside migration authority |

## Migration law carried into Finance

The existing Nexus migration runner already provides the required baseline mechanism:
- migrations are discovered in deterministic ordered filenames;
- duplicate order is rejected;
- `nexus_schema_migrations` records filename + SHA-256 checksum;
- an applied migration missing from the directory or whose checksum changes is rejected;
- each new migration runs inside `BEGIN`/`COMMIT` and records its ledger row in the same transaction;
- failure issues `ROLLBACK` and aborts the chain.

Finance must extend this canonical chain. It must not introduce an alternate schema runner or mutable setup path.

## Recovery semantics

Recovery is defined by authority, not by process memory:

1. If PostgreSQL commit did not occur, no economic fact exists.
2. If PostgreSQL commit occurred, the economic fact exists even if the HTTP response, projection, worker or notification failed.
3. Retried commands first resolve scoped idempotency/economic authority and recover existing committed result when applicable.
4. Mandatory outbox intent is durable in the same commit as the fact it represents; delivery is retryable and idempotent outside that transaction.
5. Projection/rebuild workers consume canonical facts and cannot mutate them to make downstream state appear successful.
6. Restart must not require replaying chat/session memory or transient in-process queues to discover committed work.

## Required foundation implementation evidence

Before F0–F4 foundation can be treated as proven, the implementation checkpoint must produce, at minimum:

1. clean disposable PostgreSQL bootstrap through the full canonical migration chain;
2. migration checksum rewrite rejection;
3. failed-migration rollback proof;
4. exact Money/rate persistence round-trip including envelope boundaries;
5. canonical financial transaction failure-injection tests at multiple internal stages;
6. DB constraint rollback proof;
7. sequential + concurrent idempotency proofs;
8. same-key/different-fingerprint conflict proof;
9. committed-result recovery after simulated lost response;
10. concurrent over-reversal and stale-version proof;
11. same-tenant allow + cross-tenant deny at persistence/API boundaries;
12. confirmed-history mutation/delete rejection;
13. mandatory-outbox atomicity proof and consumer retry/restart recovery;
14. projection destroy/rebuild equivalence;
15. historical replay under changed policy/FX/registry;
16. startup with valid schema succeeds without business DDL; incompatible/missing required schema fails closed;
17. affected quality gates and independent read-only review bound to the exact HEAD.

CI green alone does not close persistence integrity.

## STOP / blocking conditions

Implementation must stop for architecture/adjudication rather than patch around the problem if:
- F0–F3 invariants require a second persistence authority;
- Finance cannot be represented through the canonical migration chain;
- safe tenant ownership requires ambiguous or unverifiable legacy ownership;
- migration would reinterpret/destructively convert legacy financial values without an explicitly approved reconciliation policy;
- an invariant can only be preserved by holding a database transaction open across an external provider/network call;
- idempotency/concurrency correctness depends on process-local memory or non-durable locks;
- required recovery depends on a non-durable queue;
- projection correctness requires treating a projection/legacy field as canonical truth;
- a proposed schema type cannot preserve F2 exactness/normalization requirements.

## Completeness adjudication

Cross-check of F4-D01 through F4-D04 against F0–F3 and the existing migration/runtime model found:
- no contradiction with current canonical migration authority;
- no need for a second migration mechanism;
- no unresolved P0/P1 persistence-design gap;
- no need to choose concrete table names/index names/library implementation before writing the implementation plan;
- no justification for opening F4-D05 solely to continue architectural planning.

## Closure

**F4_STATUS=DESIGN-CLOSED_FOR_FOUNDATION_GATE**
**PRODUCT_OWNER_APPROVAL=YES**
**KNOWN_F4_P0_DESIGN_GAPS=0**
**KNOWN_F4_P1_DESIGN_GAPS=0**
**IMPLEMENTATION_AUTHORIZED=NO**
**NEXT_STAGE=FINANCE_FOUNDATION_IMPLEMENTATION_SPEC_AND_PLAN**

F4 closure ends the current foundation-design loop. The next step is not F5/F6 design. The next step is to consolidate F0–F4 into an implementation-ready Finance Foundation spec, self-review it, obtain Product Owner approval, and then write small bounded implementation missions/plans with Codex as writer and Antigravity as independent read-only reviewer.
