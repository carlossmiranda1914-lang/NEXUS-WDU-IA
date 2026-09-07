# FINANCE-F5-01 — Obligation-linked Adjustment v1 design

## Status and outcome

This is a specification, not implementation authority. An authorized `financial` or `institution_admin` operator records one exact-Money administrative correction against one issued open Obligation in the authenticated institution. The original Obligation, Payments, and Allocations remain immutable. `director` has read access only; `secretariat`, `teacher`, `student`, and `parent` cannot mutate. The workspace shows the fact, reason, date, original amount, effective due, covered amount, and remaining amount.

`secretariat`, `teacher`, `student`, and `parent` cannot create an Adjustment. Institution ownership is derived from authenticated context; foreign resources fail closed without disclosure.

## Domain and immutability

`Adjustment` is an append-only fact: `id`, `institutionId`, `financialAccountId`, `obligationId`, `direction` (`increase` | `decrease`), positive `Money`, bounded non-empty reason, effective/recorded timestamps, human actor, command/idempotency identity, Journal transaction id, and optional `compensatesAdjustmentId`.

Direction plus strictly-positive Money is canonical: Money remains unsigned and semantic direction cannot be inferred from a sign. `OBLIGATION_ORIGINAL_AMOUNT_MUTABLE=NO`; `ADJUSTMENT_MUTABLE=NO`; `ADJUSTMENT_DESTRUCTIVE_DELETE=NO`. A mistaken Adjustment is corrected only by a new compensating Adjustment linked to a root Adjustment; partial compensation is allowed, but the sum of all linked compensations may not exceed the target's amount. A target cannot itself be a compensation. Its direction must oppose the target, and the same covered-floor law applies. No generic edit/delete or Refund substitution exists.

## Derived position law

For one Obligation and currency:

`netAdjustments = Σ(increase.amount) − Σ(decrease.amount)`

`effectiveDue = originalObligationMoney + netAdjustments`

`netCovered = Σ(Allocation.amount for Obligation) − Σ(AllocationReversal.amount linked to those Allocations)`

`remainingCoverable = effectiveDue − netCovered`

All sums use `Money`; no JavaScript Number. This is the **one server-authoritative Obligation financial-position calculation** consumed identically by Adjustment validation, future Allocation eligibility validation, and Financial Account operational reads. Facts are canonical and positions are computed projections (optionally materialized only if rebuildable). `ALLOCATION_FACT_MUTATION=NO`; `ALLOCATION_AUTHORITY_INTEGRATION_CHANGE=YES`: Allocation rows remain immutable, while future Allocation validation must consume this Adjustment-aware `remainingCoverable`. Creation of a decrease requires `effectiveDueAfter >= netCovered`; hence remaining coverable cannot become negative. An increase has no covered-floor upper bound. Currency must equal both Obligation and Financial Account currency.

## Journal and PostgreSQL authority

Extend, but do not reinterpret, current typed Journal vocabulary with transaction type `obligation_adjustment` and positions `obligation_due_increased` and `obligation_due_decreased`. A transaction has one direction-consistent positive-Money entry, source reference `obligationId`, actor/provenance, effective time, reason, and optional compensating linkage. Existing unsupported types remain rejected.

Migration numbering is assigned only after fresh preflight. It creates `finance_obligation_adjustments` with UUID primary key; tenant composite FKs to Financial Account, Obligation, Journal and optional prior Adjustment; `NUMERIC(30,12)` positive-envelope check; ISO currency; direction check; reason non-empty and at most 500 characters; actor provenance; timestamps; command/idempotency uniqueness; indexes by institution/obligation/account; and immutable update/delete trigger. It never alters `finance_obligations.amount`.

## Atomicity, locking, and concurrency

One command uses authenticated institution/capability context, then locks in one global order: Financial Account, Obligation, its effective Allocation rows, related Allocation Reversal rows, then existing Adjustment rows for that Obligation; a compensation additionally locks its root target before its compensation rows. It rereads canonical facts, validates account/status/currency/direction/reason/floor/idempotency and cumulative compensation, inserts Journal and Adjustment in one PostgreSQL transaction, and commits any rebuildable projection/audit/outbox atomically.

This serializes negative Adjustment versus Allocation, two negative Adjustments, positive Adjustments, Adjustment versus Allocation Reversal, and competing compensations. Same idempotency key plus same fingerprint replays one result; a different fingerprint conflicts. Failure leaves no partial Adjustment, Journal, projection, or rewritten Obligation.

## HTTP and operational workflow

One command route is proposed: `POST /api/finance/obligations/:obligationId/adjustments`, with an `Idempotency-Key`; normal body `{ direction, amount, currency, reason }`, or compensating body `{ direction, amount, currency, reason, compensatesAdjustmentId }`; response returns the fact and rebuilt position. `effectiveAt` is server-authoritative confirmation time and `recordedAt` server-authoritative persistence time: v1 accepts no user-supplied historical effective time. It maps unauthenticated/forbidden/not-found/intent-conflict/validation to 401/403/404/409/422. There is no CRUD edit/delete route. Existing Financial Account operational context is extended as the read surface.

The UI is part of the vertical: select charge → **Registar correção** → choose **Aumentar** or **Reduzir valor a cobrar** → exact amount and required reason → preview → confirm → canonical refresh/history. It explains: “Esta correção não altera a cobrança original. Fica registada no histórico.” A decrease preview shows current effective due, covered, proposed reduction, new effective due, and new remaining amount; a floor breach is a business error. Light/dark/responsive states are required.

## Proof and UAT

PostgreSQL proof covers fresh migration, tenant composite FKs, exact Money and scale, currency, append-only rows, atomic Journal+Adjustment rollback, replay/conflict, concurrent decreases, competing partial compensations, Adjustment/Allocation and Adjustment/Reversal races, non-negative remaining, rebuild consistency, history preservation, and rejection of unsupported Journal vocabulary. It proves original 100, decrease 20, covered 40 gives remaining 40; Allocation 41 is rejected and Allocation 40 accepted; compensation restores capacity deterministically. HTTP proof is real client → Express → command → PostgreSQL. UI proves positive/decrease flows, reason, preview, floor error, submitting/server errors, refresh/history/original preservation, derived values, themes and responsive layout.

UAT: original 100 EUR, covered 40 EUR. Record −20: effective 80, remaining 40, original 100. Attempt another −50: reject because due 30 would be below covered 40. Record +10: effective 90, remaining 50. Refresh proves facts and reason persist.

## Explicit exclusions and readiness

Discounts, penalties, automated schedules, credits, refunds, provider returns, reconciliation, FX, invoice rewrite, Payment/Allocation mutation, scholarships, waivers, bulk/import, reporting, automation, and fiscal semantics are excluded. The Mission Pack is not READY until product semantics, correction linkage, Journal vocabulary, formula, role matrix, lock order, persistence/HTTP/UI contracts, proof matrix and UAT are approved.
