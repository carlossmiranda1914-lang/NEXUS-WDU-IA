# Nexus Edu IA — F3 Ledger Model Review & Proof Contract

**State:** REVIEW — NOT IMPLEMENTATION AUTHORITY  
**Scope:** approved F3-D01 through F3-D07, F0–F2 constraints, canonical Finance architecture, and Nexus engineering governance.

## Executive determination

F3-D01 through F3-D07 are internally coherent and sufficient to define the operational ledger boundary without introducing a statutory/general-ledger accounting system.

No additional P0/P1 architectural gap was found that justifies opening F3-D09 before the foundation implementation gate. Remaining persistence mechanics belong to F4; payment/allocation/reconciliation workflow details belong to later domain slices.

F3 is **NOT YET DESIGN-CLOSED** until F3-D08 and Product Owner closure are explicitly approved.

## Approved F3 decisions under review

### F3-D01 — Operational Financial Journal Authority
The Nexus Finance Journal is institution-scoped, immutable/append-oriented operational economic authority. Confirmed economic events are represented by explicitly typed Journal Transactions and semantically typed positions/entries sufficient to reconstruct financial effect and provenance. The Journal is not a mutable balance store and FINANCE-01 does not thereby become a full statutory/general accounting ledger.

### F3-D02 — Journal Transaction Atomicity & Economic Balance
A confirmed Journal Transaction is an indivisible economic unit. All canonical entries required to express its effect are validated and persisted atomically. Partial Journal persistence is invalid. Economic balance means satisfying the conservation invariants of the transaction type rather than automatically imposing a statutory debit/credit chart-of-accounts model. Confirmed entries are immutable as a set; correction creates a new linked compensating/reversal transaction.

### F3-D03 — Typed Journal Position Law
Every Journal Entry/Position has explicit economic semantics, canonical Money, institution-scoped ownership, source/provenance linkage and a role compatible with the Journal Transaction type. Numeric sign alone never defines business meaning. Entries do not silently mix currencies; any cross-currency relationship is explicit and backed by F2 conversion evidence. Journal positions reference upstream/domain authority but do not duplicate it.

### F3-D04 — Journal Lifecycle & Confirmation Boundary
Only an explicitly confirmed Journal Transaction constitutes canonical economic truth. Preparation/validation states are non-authoritative and cannot feed canonical balances/reports. Confirmation is server-authoritative, atomic and irreversible in place. Pre-confirmation cancellation/failure has no economic effect; post-confirmation correction requires new compensating/reversal authority.

### F3-D05 — Reversal, Compensation & Causal Linkage
Confirmed economic history is append-only. Reversal, refund, credit and adjustment are distinct operations and are not collapsed into generic negative entries. Every compensating transaction preserves explicit causal linkage, reason, authority and provenance. Partial reversals cannot exceed remaining reversible value and concurrent correction must preserve this invariant.

### F3-D06 — Projection, Replay & Rebuild Authority
Journal facts and authoritative Finance aggregates are economic truth; balances, summaries, dashboards, Student 360 finance views, reports and analytical datasets are derived projections. Critical projections are deterministically rebuildable from canonical history. Projection failure/staleness never rewrites or invalidates confirmed economic facts. Replay preserves historical Money/policy/FX/causal semantics rather than applying current configuration retroactively.

### F3-D07 — Idempotency, Concurrency & Duplicate Economic Fact Law
Every authoritative command capable of creating/compensating an economic fact has server-verifiable idempotency identity within institutional and operation scope. Repeated delivery of the same canonical intent returns/references the established result rather than creating another effect. Same idempotency identity with materially different canonical content fails closed. Provider/external identities are preserved in valid scope but never substitute for tenant authorization. Concurrency protection must reach the persistence boundary; check-then-write races are not an acceptable guarantee.

# F3-D08 — Proof Contract & Closure Gate

**Status: PROPOSED — awaiting explicit Product Owner approval.**

F3 may be considered design-complete only if its future implementation plan carries the following blocking proof matrix. A lower proof class cannot substitute for the required higher proof class.

| Material risk / invariant | Required proof | Primary tool/evidence | Blocking condition |
| --- | --- | --- | --- |
| Parallel/legacy financial authority survives | Trace every authoritative financial write into canonical Finance command/Journal or an explicit fence | Repository authority trace + HTTP integration + Product Truth regression | Any operational path can mutate balance/economic state outside canonical Finance authority |
| Journal transaction partially persists | Forced failure between transaction/entry writes proves all-or-nothing behavior | Disposable real PostgreSQL transaction test | Header/transaction exists without complete required entries, or entries survive failed confirmation |
| Economic balance/conservation violated | Executable domain + PostgreSQL scenarios for each foundation transaction type prove conservation invariant | Domain tests + PostgreSQL integration | Confirmed transaction can violate its declared economic invariant |
| Generic/untyped +/- entries obscure meaning | Transaction/entry contract rejects missing or incompatible position semantics | Domain/contract test; structural check complementary only | A confirmed entry can exist with Money/sign but no valid economic role |
| Mixed currency enters one economic relationship without FX evidence | Negative behavior proves same-currency enforcement and explicit F2 conversion evidence | Domain + PostgreSQL integration | Cross-currency entry set confirms without explicit valid conversion provenance |
| Cross-tenant/foreign-unit references enter Journal | Same-tenant allow plus foreign-tenant/resource denial without disclosure | HTTP/PostgreSQL tenant-security regression | Foreign Institution/resource can be referenced, mutated or discovered |
| Draft/pending state affects balance | Ordered lifecycle proof shows only confirmed Journal authority reaches projections | Domain/state-transition + PostgreSQL/read-model test | Pre-confirmation transaction changes authoritative balance/read model |
| Confirmation failure leaves partial economic truth | Inject validation/persistence failure and prove zero canonical effect | PostgreSQL integration | Failed/cancelled pre-confirmation operation leaves Journal/balance effect |
| Confirmed history can be mutated/cancelled in place | Attempts to update/delete economic fields or revert confirmed lifecycle are rejected | PostgreSQL/repository integration + domain test | Confirmed amount/currency/type/entry-set/economic state can be rewritten destructively |
| Reversal/compensation loses causal history | Create original + partial/full compensation and reconstruct chain | PostgreSQL integration + read/rebuild proof | Correction can neutralize history without explicit linkage/reason/provenance |
| Over-reversal under concurrency | Competing partial reversals against same remaining amount | Concurrent disposable PostgreSQL test | Combined committed reversals exceed remaining reversible amount |
| Retry/duplicate command creates duplicate fact | Sequential and concurrent identical retries prove exactly one economic result | PostgreSQL idempotency/concurrency test | Same canonical intent can commit multiple economic facts |
| Idempotency key reused for different intent | Canonical fingerprint mismatch returns conflict with no second economic effect | HTTP/domain + PostgreSQL integration | Same scoped identity silently returns/overwrites a different economic operation |
| Provider callback duplication creates duplicate fact | Repeated provider operation identity results in one canonical transaction | HTTP/provider-adapter + PostgreSQL test | Duplicate callback/provider retry creates another payment/economic fact |
| Response lost after commit causes duplicate retry | Simulated committed transaction + unknown transport response + retry recovers existing result | HTTP/service + PostgreSQL integration | Retry after uncertain response can create second fact |
| Legitimate same-amount operations are falsely deduplicated | Two distinct explicit economic identities with same amount/context both succeed | PostgreSQL integration | Similar payload alone is treated as duplicate identity |
| Projection becomes authority | Destroy/rebuild projection and prove same result from canonical history | PostgreSQL/read-model rebuild test | Projection contains exclusive economic fact or cannot be deterministically rebuilt |
| Projection failure invalidates confirmed Journal | Force downstream projection failure after canonical commit | PostgreSQL + worker/outbox/recovery proof in F4 implementation | Confirmed fact is rolled back/re-written because projection failed |
| Historical replay changes under new policy/FX | Rebuild after policy/rate/registry changes yields same historical economic position | PostgreSQL historical-reproducibility test | Current configuration alters confirmed historical Money/FX/policy meaning |
| Legacy `outstandingFees` remains balance authority | Negative regression proves it cannot independently drive canonical balance | Repository/HTTP/read-model regression | Legacy field can authoritatively create/alter reported Finance position |
| Evidence/audit provenance is insufficient | Confirmed transaction can be traced to command, institution context, actor/system, reason/evidence where required | PostgreSQL/HTTP audit integration | Required provenance is absent, invented, or exists only in transient logs |

## Required evidence classes by Nexus governance

Nexus engineering governance requires:
- domain policy risks → executable unit/domain proof;
- HTTP/authorization risks → positive and negative HTTP integration proof;
- persistence/concurrency/idempotency risks → disposable PostgreSQL scenarios;
- tenant/privacy risks → same-tenant allow plus cross-role/cross-tenant denial;
- migration/schema risks → clean isolated migration/bootstrap proof;
- governance claims → canonical-source consistency plus independent review.

Static/AST/source tests may complement these proofs but cannot close stateful persistence, concurrency, authorization or tenant risks.

## Closure-level proof requirements

A future Finance Foundation implementation checkpoint that claims the F3 invariants must, at minimum, produce:

1. fresh targeted domain tests for Journal lifecycle/economic invariants;
2. fresh disposable PostgreSQL atomicity/rollback proof;
3. fresh PostgreSQL idempotency/concurrency proof, including concurrent duplicate command and over-reversal cases;
4. fresh same-tenant allow / cross-tenant deny proof;
5. fresh canonical projection rebuild proof;
6. fresh historical replay proof under changed policy/FX inputs;
7. affected migration clean-chain proof once F4 defines schema;
8. affected HTTP authorization proof once commands are exposed;
9. canonical quality gates appropriate to the delta;
10. independent read-only review bound to the exact implementation HEAD.

`CI green` alone is insufficient. `MERGE_SAFE` for foundation-critical work requires zero unresolved P0/P1 findings and the applicable stateful proofs.

## STOP / blocking conditions

Implementation must stop and return for architecture/adjudication if any of the following occurs:
- implementation requires a second financial write authority;
- a required invariant cannot be enforced without changing an approved F0–F3 law;
- transaction ordering/concurrency semantics cannot be made deterministic under the F4 persistence model;
- a legacy Finance path must remain writable as hidden compatibility authority;
- cross-tenant ownership cannot be proven unambiguously;
- migration would destructively reinterpret existing financial data without an approved reconciliation/migration policy;
- a provider/payment workflow requires economic semantics not expressible by the approved Journal model;
- a projection must become exclusive economic authority to satisfy product behavior.

Ordinary implementation details, concrete table names, index choices, decimal library selection, worker mechanics and non-material internal refactors do not reopen F3 when they preserve the approved laws.

## Completeness adjudication

Cross-check against F0–F2 and the canonical roadmap found:
- no contradiction with immutable/append-only financial history;
- no contradiction with exact Money/currency/FX rules;
- no contradiction with server-authoritative tenant/capability rules;
- no need to introduce full double-entry statutory accounting at this foundation stage;
- no need to define Payment/Allocation/Reconciliation workflow states inside F3;
- no unresolved P0/P1 F3 design gap beyond approving this proof/closure contract.

## Candidate closure state

If F3-D08 is explicitly approved by the Product Owner:

`F3_STATUS=DESIGN-CLOSED`  
`KNOWN_F3_P0_DESIGN_GAPS=0`  
`KNOWN_F3_P1_DESIGN_GAPS=0`  
`IMPLEMENTATION_AUTHORIZED=NO`  
`NEXT_STAGE=F4_MINIMUM_TRANSACTION_AND_PERSISTENCE_DESIGN`

F3 closure will authorize only the minimal F4 design needed to make F0–F3 implementable and testable. It will not authorize Payments, Allocation, Reconciliation, Reporting or the complete Finance module.
