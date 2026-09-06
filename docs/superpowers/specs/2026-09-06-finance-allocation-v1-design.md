# Nexus Edu IA — Finance Allocation v1 Design

**Status:** PRODUCT DESIGN CONSOLIDATED — AWAITING FINAL PRODUCT OWNER SPEC APPROVAL
**Date:** 2026-09-06
**Baseline:** `90c62bb5ae0656bb99c847149f3bb6618f8fe600`
**Planning branch:** `codex/finance-allocation-v1-plan`
**Scope:** first canonical Allocation authority connecting confirmed Payments to eligible Obligations.

## 1. Purpose

Allocation v1 answers one economic question only:

> Which exact portion of a confirmed Payment has been explicitly applied to which eligible Obligation?

Allocation is a new canonical Finance authority. It does not replace Payment, Obligation, Financial Account, Journal, Reconciliation, Credit, Refund or Adjustment.

This mission starts from the already validated Finance baseline:

- Fee Catalogue authority exists;
- Financial Account authority exists;
- Obligation authority exists;
- Payment Core exists;
- Finance Operational Context exists and has passed Human UAT;
- Payment remains confirmed independently of Allocation;
- unallocated money remains explicit.

## 2. Canonical basis

This design is constrained by the approved Finance architecture:

1. Obligation, Payment, Allocation, Financial Document and Reconciliation are separate truths.
2. Payment confirmation does not itself settle an Obligation.
3. Allocation is the explicit application of confirmed value to an eligible Obligation/financial position.
4. Canonical economic facts are immutable in place; material correction uses compensating/reversal authority.
5. Balances/positions are derived projections, not independently editable authority.
6. Finance is institution-scoped, server-authoritative, exact-decimal and fail-closed.
7. Authoritative commands are atomic, idempotent and persistence-safe under concurrency.
8. Unapplied money and other legitimate intermediate states must remain representable.

## 3. Product Owner-approved decisions D1-D5

### D1 — Explicit Allocation
Allocation v1 is explicit. A human financial operator deliberately chooses which eligible Obligation(s) receive value from a confirmed Payment.

There is no automatic oldest-first, fee-type priority, student priority or hidden allocation policy in v1.

### D2 — Partial Allocation
Partial application is valid on both sides.

- A Payment may be partially allocated and retain an unapplied remainder.
- An Obligation may be partially covered and retain an uncovered remainder.
- A remainder does not automatically become Credit, Refund, Adjustment or a new Obligation.

### D3 — Eligibility Boundary
An Allocation is eligible only when all of the following are true:

- same Institution;
- same Financial Account;
- same canonical Currency;
- Payment is canonically confirmed;
- Obligation is canonically eligible for allocation;
- requested amount is strictly positive;
- requested amount does not exceed remaining allocatable Payment value;
- requested amount does not exceed remaining coverable Obligation value.

Cross-currency Allocation is out of scope for v1. Existing FX architecture does not authorize hidden conversion inside Allocation.

### D4 — Immutable Allocation / Compensating Correction
A confirmed Allocation cannot be edited or deleted in place.

Correction creates a new causally linked Allocation Reversal/Compensation fact. Partial reversal is allowed only up to the remaining reversible amount of the original Allocation.

Reason and provenance are mandatory for a corrective reversal.

### D5 — Derived Position
Payment and Obligation application/coverage positions are derived from confirmed Allocations net of valid Allocation reversals.

Presentation concepts may include:

Payment:
- `Por associar`;
- `Parcialmente associado`;
- `Totalmente associado`.

Obligation:
- `Em aberto`;
- `Parcialmente coberta`;
- `Coberta`.

These are derived positions, not new editable economic authorities. `Coberta` does not mean `Reconciliada`.

## 4. Authority model

### 4.1 Allocation

A confirmed Allocation is an immutable economic relationship containing at minimum:

```ts
Allocation {
  id
  institutionId
  financialAccountId
  paymentId
  obligationId
  money: Money
  effectiveAt
  recordedAt
  actor/provenance
  commandCorrelation/idempotency identity
  status: confirmed
}
```

Exact physical names remain implementation details, but these semantic relationships are mandatory.

### 4.2 Allocation Reversal

A correction is a distinct immutable fact:

```ts
AllocationReversal {
  id
  institutionId
  originalAllocationId
  money: Money
  reason
  effectiveAt
  recordedAt
  actor/provenance
  commandCorrelation/idempotency identity
  status: confirmed
}
```

The reversal does not delete or mutate the original Allocation.

### 4.3 No mutable balance fields

The following values are projections, not standalone write authority:

- Payment allocated total;
- Payment unapplied remainder;
- Obligation covered total;
- Obligation uncovered remainder;
- Payment allocation presentation status;
- Obligation coverage presentation status.

If materialized for performance, they must remain rebuildable/verifiable from canonical facts.

## 5. Command model

### 5.1 ConfirmAllocation

The primary v1 command accepts one confirmed Payment and one or more explicit allocation lines chosen by the operator.

Conceptually:

```ts
ConfirmAllocation {
  paymentId
  lines: [
    { obligationId, amount }
  ]
  effectiveAt
  idempotencyKey
}
```

The server resolves institution, Financial Account, Currency, Payment state, Obligation state and remaining values. Browser-provided tenant/account/status/remaining values are never authority.

### 5.2 Atomic multi-line confirmation

One user confirmation may distribute one Payment across multiple eligible Obligations. The entire submitted command is one PostgreSQL atomicity boundary:

- either every requested line is valid and commits;
- or none of the lines commits.

The system must not silently commit only the lines that happen to be valid.

Each payment-obligation relationship remains individually reconstructable even when created by one command/correlation.

### 5.3 ReverseAllocation

Correction targets one confirmed Allocation fact and specifies an exact reversal amount plus mandatory reason.

The server proves remaining reversible value under concurrency before commit.

A full reversal makes the full original amount available again through derived position. A partial reversal restores only the reversed portion.

## 6. Economic invariants

For a Payment `P` in currency `C`:

```text
netAllocated(P) = sum(confirmed allocations from P) - sum(valid allocation reversals from P)
unapplied(P) = paymentAmount(P) - netAllocated(P)
```

Invariant:

```text
0 <= netAllocated(P) <= paymentAmount(P)
```

For an Obligation `O` in currency `C`:

```text
netCovered(O) = sum(confirmed allocations to O) - sum(valid allocation reversals to O)
uncovered(O) = obligationAmount(O) - netCovered(O)
```

Invariant:

```text
0 <= netCovered(O) <= obligationAmount(O)
```

No floating-point arithmetic is permitted. Canonical Money operations use the existing exact-decimal Money model.

The sum of allocation lines committed by one command must equal exactly the command's allocated total. No remainder may disappear through rounding.

## 7. Eligibility and account scope

Allocation v1 deliberately uses Financial Account as the responsibility boundary.

A Payment on Financial Account A may not be allocated to an Obligation on Financial Account B, even if:

- the same Person appears in both contexts;
- the amount and currency match;
- both accounts belong to the same Institution.

A single Financial Account may legitimately contain obligations for multiple associated students. Explicit allocation across those students is allowed only because the obligations share that same canonical Financial Account; no guardian relationship is used as substitute authority.

Foreign-tenant identifiers fail closed and must not disclose existence.

## 8. Currency law

Allocation v1 is same-currency only.

```text
Payment.currency == Allocation.currency == Obligation.currency
```

No implicit FX, reciprocal rate, presentation conversion or provider conversion may make a cross-currency allocation appear valid.

Cross-currency allocation, if ever required, is a future mission requiring explicit Conversion Evidence and policy.

## 9. Lifecycle and correction

There is no editable confirmed Allocation draft in v1.

The interaction may have a browser-side review stage before submission, but canonical economic authority begins only on successful server confirmation.

After confirmation:

- Allocation is immutable;
- destructive DELETE is forbidden through authoritative paths;
- changing payment/obligation link, amount or currency in place is forbidden;
- correction uses ReverseAllocation;
- a reversal may itself not be destructively edited to rewrite history.

Allocation reversal is not Payment refund. It changes the internal application of received value, not the fact that the money was received.

## 10. Journal boundary

Allocation changes canonical financial position because it creates settlement effect between an existing Payment and an existing Obligation. Therefore confirmation and reversal must participate in the existing canonical Finance economic-fact / Journal transaction boundary.

The implementation must extend the existing Journal semantics minimally to represent:

- allocation confirmation;
- allocation reversal/compensation.

This does not authorize a statutory/general-ledger chart of accounts or unrelated accounting expansion.

The Allocation aggregate/fact, required Journal representation, idempotency result, provenance/audit and any mandatory durable intent belong to the same PostgreSQL atomicity boundary where required by the existing Finance laws.

If the current Journal implementation cannot express Allocation without violating approved F0-F4 laws, implementation must STOP for architecture adjudication rather than bypass the Journal.

## 11. Idempotency

Every allocation confirmation and reversal command requires server-verifiable scoped idempotency.

Required behavior:

- same idempotency identity + same canonical intent -> return established result;
- same identity + materially different intent -> conflict, no second effect;
- lost response after commit + retry -> recover committed result;
- similar amounts/obligations with distinct operation identity remain valid distinct operations.

Idempotency identity is institution/operation scoped and persistent; process-local memory is insufficient.

## 12. Concurrency

Allocation correctness must reach PostgreSQL.

Required concurrent safety:

- two commands cannot jointly allocate more than the Payment's remaining value;
- two commands cannot jointly cover more than the Obligation's remaining value;
- two reversals cannot jointly reverse more than an Allocation's remaining reversible amount;
- allocation and reversal racing on the same resources cannot create negative or excessive derived positions;
- check-then-write without persistence locking/CAS/constraint protection is forbidden.

When one command touches multiple Obligations, locks/resources must be acquired in deterministic order to reduce deadlock risk.

No external/provider/network call occurs while Allocation database locks are held.

## 13. Authorization and tenancy

Allocation requires an explicit server-side Finance capability/policy appropriate to applying received value.

The browser may send resource identifiers and intended Money but cannot assert:

- institution;
- role/capability;
- Financial Account ownership;
- Payment confirmation state;
- obligation eligibility;
- remaining values;
- derived statuses.

Authorization is resolved from active institutional Membership/context.

Read and mutation paths require same-tenant allow plus cross-tenant denial proof.

## 14. Provenance and audit

Every confirmed Allocation and reversal preserves enough evidence to reconstruct:

- institution;
- actor/system identity and Membership context;
- Payment;
- Obligation;
- Financial Account;
- exact Money;
- effective and recorded time;
- command correlation/idempotency identity;
- correction reason for reversal;
- causal link to original Allocation where applicable.

Audit records do not replace the financial fact itself.

## 15. Read model and operational UX

Allocation v1 integrates into the already approved Financial Account-centered operational surface rather than creating a disconnected module.

### 15.1 Payment presentation

For each confirmed Payment, show:

- received Money;
- allocated Money;
- unapplied Money;
- derived allocation position;
- Allocation history.

### 15.2 Obligation presentation

For each eligible Obligation, show:

- original Money;
- covered Money;
- uncovered Money;
- derived coverage position;
- Allocation history.

### 15.3 Explicit allocation workflow

From a selected Financial Account context:

1. operator selects a confirmed Payment with available unapplied value;
2. Nexus displays only eligible open/partially covered Obligations from the same Financial Account and currency;
3. operator enters exact amounts against one or more Obligations;
4. UI continuously shows intended distribution and remaining Payment amount, but browser calculations are advisory only;
5. operator reviews a confirmation summary;
6. server revalidates all facts and confirms atomically;
7. UI reloads canonical server projection;
8. derived positions update from confirmed Allocation facts.

No obligation is auto-selected by hidden priority.

### 15.4 Reversal workflow

From Allocation history:

1. authorized operator selects an Allocation;
2. selects full or partial reversal amount within server-proven reversible value;
3. enters mandatory reason;
4. reviews correction impact;
5. server confirms reversal atomically;
6. canonical read model refreshes.

The UI must not label this as Payment refund.

## 16. Error behavior

Fail closed with no partial economic effect for at least:

- Payment not found/not confirmed;
- Obligation not found/not eligible;
- different Institution;
- different Financial Account;
- different Currency;
- zero/negative allocation amount;
- amount exceeds Payment remaining value;
- amount exceeds Obligation remaining value;
- duplicate/conflicting idempotency identity;
- stale/concurrent over-allocation;
- reversal exceeds remaining reversible value;
- unauthorized capability;
- invalid effective/provenance requirements.

Errors must use operational language where presented to users and must not leak foreign-tenant resource existence.

## 17. Required persistence shape

Allocation v1 is expected to require a new canonical append-only migration because Allocation is a genuinely new economic authority.

Implementation must use the existing canonical migration chain and migration runner. No runtime DDL, alternate schema bootstrap or mutable setup path is allowed.

The implementation plan may choose exact table/index/constraint names, but persistence must support:

- immutable Allocation facts;
- immutable Allocation reversal facts or an equivalent semantically explicit compensating structure;
- institution/account/payment/obligation ownership integrity;
- exact Money persistence;
- causal reversal linkage;
- idempotency/concurrency protection;
- efficient derivation of remaining Payment/Obligation positions.

Migration design must not rewrite historical Payment or Obligation Money.

## 18. Mandatory proof contract

Allocation v1 cannot claim DONE through source-string tests alone.

Required executable proof classes include:

### Domain/model
- exact partial allocation arithmetic;
- same-currency enforcement;
- eligibility rules;
- no over-allocation;
- no over-coverage;
- derived status thresholds;
- reversal arithmetic;
- no negative derived remainder.

### Real PostgreSQL
- clean migration chain;
- exact Money round-trip;
- allocation + Journal atomicity;
- forced-failure rollback;
- same-tenant ownership constraints;
- concurrent Payment over-allocation attempt;
- concurrent Obligation over-coverage attempt;
- concurrent over-reversal attempt;
- idempotent retry;
- same-key/different-intent conflict;
- lost-response recovery where current command framework supports it;
- immutable confirmed fact behavior.

### HTTP/security
- authorized positive allocation;
- role/capability denial;
- cross-tenant denial/non-disclosure;
- cross-account rejection;
- cross-currency rejection;
- invalid Payment/Obligation lifecycle rejection;
- idempotency transport contract.

### UI/behavior
- explicit selection only;
- partial one-Payment/one-Obligation allocation;
- one Payment distributed across multiple Obligations;
- unapplied remainder remains visible;
- partially covered Obligation remains visible;
- fully allocated/covered derived presentation;
- refresh persists canonical state;
- reversal restores derived availability;
- no Allocation action mutates Payment receipt fact or Obligation original amount.

### Regression
- Finance Operational Consolidation;
- Payment Core;
- Financial Account/Obligation;
- Fee Catalogue;
- Finance Foundation;
- FND03 tenant isolation;
- lint/build/secrets/artifacts/diff integrity.

## 19. Human UAT

Human UAT is mandatory and distinct from automated readiness.

Minimum UAT scenario:

1. open known Financial Account;
2. verify one confirmed Payment with unapplied value;
3. verify at least two eligible same-currency Obligations;
4. explicitly apply part of the Payment to Obligation A;
5. explicitly apply another part to Obligation B;
6. confirm one Obligation becomes `Coberta` and another may remain `Parcialmente coberta`;
7. confirm Payment may remain `Parcialmente associado` if value remains;
8. refresh and prove persistence;
9. open Allocation history and perform an authorized partial/full reversal with reason;
10. prove the original Allocation remains in history;
11. prove derived Payment/Obligation positions update correctly;
12. prove original Payment amount and original Obligation amount never change;
13. prove no Reconciliation claim is displayed;
14. verify light/dark/responsive presentation as applicable to current Finance workspace.

## 20. Explicit non-goals

Allocation v1 does NOT implement:

- automatic allocation priority;
- oldest-first allocation;
- AI suggested allocation;
- cross-currency allocation;
- Credit authority;
- overpayment-to-credit conversion;
- Refund authority;
- Payment reversal beyond what current Payment Core already canonically supports;
- penalties/discounts/adjustments;
- reconciliation;
- bank matching;
- Adyen/EMIS/MB WAY/Multibanco/MULTICAIXA activation;
- fiscal document issuance;
- treasury/payables;
- provider settlement;
- statutory/general-ledger accounting;
- cross-Financial-Account transfer of value;
- guardian relationship as financial responsibility authority.

If implementation discovers one of these is required to proceed safely, it must STOP and present direct dependency evidence rather than absorb the scope silently.

## 21. Definition of Done

Allocation v1 is DONE only when all of the following are true:

- D1-D5 behavior is implemented exactly;
- Allocation and reversal authorities are immutable and auditable;
- same-Institution/account/currency eligibility is enforced server-side;
- partial allocation on both sides works exactly;
- no Payment or Obligation is over-applied under concurrency;
- derived positions are reconstructable;
- Journal/economic fact boundary remains coherent;
- no automatic Allocation policy was introduced;
- no hidden FX, Credit, Refund or Reconciliation behavior was introduced;
- applicable stateful PostgreSQL, HTTP/security and UI behavioral proofs pass;
- Finance regressions remain green;
- final runtime SHA parity is proven;
- Product Owner Human UAT passes;
- the final baseline/handoff records the exact implementation SHA and future extension points.

## 22. Architecture stop conditions

Implementation must stop before proceeding if:

1. Allocation requires rewriting confirmed Payment or Obligation economic meaning;
2. current Journal cannot represent Allocation without violating F0-F4;
3. cross-tenant/account ownership cannot be proven unambiguously;
4. concurrency safety can only be achieved with process-local memory;
5. exact Money cannot be preserved through persistence;
6. a migration would destructively reinterpret existing Payment/Obligation history;
7. a non-goal authority becomes necessary for correctness;
8. implementation requires provider/network calls inside canonical Finance transaction locks.

## 23. Final design determination

The approved product direction and canonical Finance laws are compatible.

Allocation v1 is intentionally narrow:

**confirmed Payment -> explicit exact allocation -> eligible Obligation -> derived financial position**

with immutable compensating reversal for correction.

It completes the missing settlement relationship without prematurely introducing reconciliation, credits, refunds, automation or provider operations.

**DESIGN_READY_FOR_PRODUCT_OWNER_SPEC_APPROVAL=YES**
**IMPLEMENTATION_AUTHORIZED=NO**
