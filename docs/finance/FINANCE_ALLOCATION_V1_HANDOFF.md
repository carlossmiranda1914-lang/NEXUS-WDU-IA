# Finance Allocation v1 — Implementation Handoff

## Identity

- Branch: `codex/finance-f4-allocation-v1`
- Spec: `docs/superpowers/specs/2026-09-06-finance-allocation-v1-design.md` (`7f3325f3587c30d6759dda847578e32e82889308`)
- Plan: `docs/superpowers/plans/2026-09-06-finance-allocation-v1.md` (`75384fe381fe4958ba7cb00de36e0ee13b38085a`)
- Baseline: `90c62bb5ae0656bb99c847149f3bb6618f8fe600`
- Frozen implementation SHA: `bd416ff0edee747b8d8f27751607cc211cdd8120`
- Migration: `0037_finance_allocation_authority.sql`

## Canonical authority and laws

Financial Account is the responsibility boundary. Payment and Obligation retain their original exact Money. Allocation is the explicit, manual application of confirmed Payment value to an eligible Obligation; Allocation Reversal is its immutable, causally linked compensation.

- Allocation != Payment; Payment confirmation alone does not cover an Obligation.
- Allocation Reversal != Payment Refund; Allocation != Reconciliation.
- D1 explicit/manual; D2 partial on both sides; D3 same Institution, Financial Account and Currency plus confirmed Payment and eligible Obligation; D4 immutable facts corrected only by reversal; D5 derived positions only.
- One Payment may allocate to multiple Obligations. Remainders and partial coverage remain explicit.

## Boundaries

Exact decimal Money is authoritative; JavaScript floating point is not. Confirmed Allocation is immutable, reversal reason is mandatory, and Payment/Obligation Money is never mutated. There is no automatic allocation, FX, Credit, Refund, Reconciliation, provider activation, treasury, payables, fiscal or statutory ledger scope.

Journal semantics are `payment_allocation`/`allocated_value` and `allocation_reversal`/`released_value`. Commands use `finance.allocation.confirm` and `finance.allocation.reverse`. PostgreSQL transactions, row locks and deterministic Obligation ordering prove atomicity, idempotency, over-allocation, over-coverage and over-reversal protection.

HTTP endpoints: `POST /api/finance/allocations`, `POST /api/finance/allocations/:allocationId/reversals`, and scoped `GET /api/finance/allocations`. The UI uses explicit selection, preserves history, avoids Refund terminology, and refetches canonical context after mutation.

## Final verification and UAT

F3, F2, F1, Foundation, FND03, lint, build, diff, secrets, artifacts, F4 aggregate and Operational Consolidation passed in fresh durable execution. FINAL_AUTOMATED_VERIFICATION=PASS; FINAL_REVIEW=PASS; P0_OPEN=0; P1_OPEN=0; ALLOCATION_IMPLEMENTATION_FROZEN=YES.

F3 test-only corrections: `91ad5559f76b5b10dd27ed8e930e88c49bce4601` makes the webhook fixture effective at its event timestamp; `bd416ff0edee747b8d8f27751607cc211cdd8120` limits the F3 allocation prohibition to its dedicated branch. PRODUCTION_CODE_CHANGED_BY_F3_FIXES=NO.

## Bounded audit remediation

The post-closeout audit identified proof gaps rather than a new Finance phase. They are closed by executable evidence: Task 3 now performs real migrated-schema PostgreSQL confirmation, rollback, Journal atomicity and idempotency proof; Task 5 mounts Express routes against PostgreSQL for authorization, tenancy, conflict and reversal behavior; the command boundary rejects JavaScript-number Money inputs; the concurrency suite includes the Allocation-versus-Reversal race; and the rendered confirmation workflow proves multi-line review, exact remainder, client transport and canonical refetch. Allocation policy reuse is canonical because the existing `payment-policy.ts` is the established Finance write-capability boundary for confirmed received value. No separate capability was introduced.

AUDIT_REMEDIATION=PASS; P0_OPEN=0; P1_OPEN=0; FINAL_AUTOMATED_VERIFICATION=PASS.

The final audit adjudicated its proposed unconfirmed-Payment case as invalid: Payment Core deliberately materializes only canonical `confirmed` Payments (`PaymentStatus = 'confirmed'` and migration 0035 enforces the same). No Payment lifecycle, migration 0035, or impossible pending fixture was introduced. The valid P1-A finding was fixed through real `AllocationApiClient → Express → PostgreSQL` confirmation and reversal proof. Client requests now include the displayed canonical currency, while PostgreSQL still verifies it against the locked Payment and Obligation.

AUDIT_FINAL_CLOSURE=PASS; PAYMENT_STATUS_DOMAIN=CONFIRMED_ONLY; UNCONFIRMED_PAYMENT_CANONICAL_STATE=NOT_MODELED; P1_B_FINDING=WITHDRAWN_INVALID_ASSUMPTION.

HUMAN_UAT=PENDING. Prepare one same-institution/account/currency scenario with a confirmed unapplied Payment and at least two eligible Obligations. The Product Owner explicitly allocates, refreshes, inspects history, performs a reasoned partial/full reversal, and confirms original Payment/Obligation Money remains unchanged.
