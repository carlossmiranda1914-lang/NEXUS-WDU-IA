# Finance F7 Task 9 Debit Event Basis Design

## Status

Approved design prerequisite for Finance F7 Task 9 (Nota de Débito).

## Context

Task 8 (Nota de Crédito) is closed. Task 9 is blocked because the current Finance model can prove that an Obligation increased, but cannot yet prove, as a structured server-authorized fact, that the increase is specifically a debit-event basis for which the proven Angola Nota de Débito rule applies.

The existing `ObligationAdjustment` authority already preserves institution, obligation, exact amount, currency, reason, actor, journal, idempotency and historical position. It must remain the owner of this economic fact. A new DebitEvent aggregate/table is not justified.

## Goal

Extend the existing `ObligationAdjustment` authority with the minimum persisted, structured debit-event basis required to distinguish:

- an ordinary increase adjustment that remains only an obligation adjustment; from
- an increase adjustment that is an authoritative factual debit event eligible for later Nota de Débito policy evaluation.

This prerequisite does not itself issue a Nota de Débito.

## Non-goals

- No new Finance architecture.
- No new DebitEvent entity or aggregate.
- No changes to Financial Account, Payment, Allocation, Credit Note, invoice or invoice-receipt authority.
- No browser-authored fiscal/tax decision.
- No claim that AO production is enabled.
- No automatic conversion of every increase adjustment into a Nota de Débito.
- No sign inversion or reuse of Credit Note semantics.

## Authority model

`ObligationAdjustment` remains the authoritative economic event.

A new optional structured field records whether the economic event has been classified, by an authorized server path, as a debit-event basis.

Proposed semantic shape:

```ts
type ObligationAdjustmentBasis = 'general' | 'debit_event';
```

The persisted value may be represented as a nullable/optional `basis_type` column for backward compatibility, where historical rows without the field are treated as `general`.

The field represents a factual classification of the adjustment. It does not represent document eligibility and must not be named `isDebitNoteEligible`, `documentType`, `taxMode`, or any equivalent fiscal conclusion.

## Invariants

1. `basisType='debit_event'` is valid only when `direction='increase'`.
2. `direction='decrease'` with `basisType='debit_event'` is rejected.
3. Historical adjustments with no basis remain valid general adjustments.
4. `reason` remains mandatory; structured basis does not replace the factual reason.
5. Amount remains positive exact Money and currency must continue matching the Obligation.
6. Tenant/institution comes only from server-resolved institutional context.
7. The basis participates in the idempotency fingerprint; the same key with different basis is a conflict, not a replay.
8. Persistence, readback, audit and outbox must expose the structured basis truthfully.
9. Journal semantics remain `obligation_due_increased` / `obligation_due_decreased`; do not overload journal position type with document semantics.
10. No tax value is accepted from the browser for debit-event classification.
11. Zero-tax behavior for a future Nota de Débito is derived by the Angola policy from `AO-RJF-DEBIT-083`, not stored as a user-authored adjustment field.
12. This prerequisite alone does not make Task 9 UAT-ready or AO-production-ready.

## Authorization

Use the existing authority that already permits recording an Obligation Adjustment. Do not add a broader role or client-side permission shortcut.

If the current command path lacks sufficient server-side authorization for this more specific classification, add the narrowest server capability/policy check inside the existing Finance authority. Do not authorize based on hidden UI state or browser labels.

## Persistence

Prefer a minimal migration that extends `finance_obligation_adjustments` with an optional structured basis column. No new table unless the existing row cannot truthfully own the fact, which the current adjudication says it can.

The migration must preserve all existing rows and require no backfill beyond interpreting null/absent as general.

## API and model contract

Extend the existing adjustment command/read model, not a new endpoint.

Illustrative command shape:

```ts
interface RecordObligationAdjustmentCommand {
  obligationId: string;
  direction: 'increase' | 'decrease';
  amount: Money;
  currency: string;
  reason: string;
  basisType?: 'general' | 'debit_event';
  compensatesAdjustmentId?: string;
}
```

Normalization rules:

- omitted basis => `general`
- only `general` or `debit_event` accepted
- `debit_event` requires `increase`
- basis must be part of the canonical fingerprint

Read models must return the persisted basis so later Nota de Débito policy code can consume server truth without inferring from `reason`.

## UI behavior

The existing general adjustment UI may be minimally extended to let an authorized operator choose whether an increase represents the specific factual debit-event basis.

The UI must communicate that this classifies the underlying financial event; it does not promise Nota de Débito issuance or AO production readiness.

For decreases, the debit-event option must not be available.

The browser sends the factual classification request, but the server validates and owns the accepted persisted fact.

## Task 9 handoff contract

After this prerequisite is proven, Task 9 may consume only:

```text
ObligationAdjustment.direction == increase
AND ObligationAdjustment.basisType == debit_event
```

as the candidate economic source for Nota de Débito.

The Angola document policy must still independently enforce:

- AO-RJF-DOC-080
- AO-RJF-DEBIT-083
- required institution data
- zero tax liquidation derived by policy
- supported relationship/provenance
- series/readiness requirements
- fail-closed AO production prerequisites

No future Task 9 code may infer debit-event eligibility from free-text `reason` alone.

## Evidence required for prerequisite closure

Fresh evidence must prove:

- RED test first for missing/invalid basis semantics.
- Existing general adjustments remain backward-compatible.
- Debit-event basis accepted only for increase.
- Decrease + debit-event rejected.
- Exact money and currency rules preserved.
- Tenant isolation preserved.
- Idempotency replay works for identical basis.
- Same idempotency key + changed basis conflicts.
- Persisted readback returns basis after restart.
- Audit/outbox evidence includes/links the accepted basis without rewriting historical truth.
- General adjustment UI regression passes.
- Focused normal UI can create a classified increase adjustment without SQL/API helper issuance.
- Lint, build and `git diff --check` pass.

## Closure rule

The prerequisite may be marked `CLOSED` only when all required machine evidence is fresh and the normal product path proves the structured basis survives refresh/restart.

Task 9 itself remains `IN_PROGRESS` until Nota de Débito issuance, artifact and Human UAT are separately completed.

## Protected boundaries

Escalate before changing any of the following unless a reproducible prerequisite defect proves it unavoidable:

- global IAM/Membership architecture
- global tenant resolution
- Financial Account authority
- Payment/Allocation authority
- Credit Note authority
- shared numbering/idempotency semantics
- global journal architecture
- unrelated Finance roadmap tasks

## Product/PAP truth

This change is a domain-authority refinement, not a new subsystem. For PAP documentation, it should be explained as the separation between:

- a generic increase to an Obligation; and
- a structured factual debit-event classification later consumed by fiscal-document policy.

Until Nota de Débito closes vertically, PAP status remains `IN_DEVELOPMENT` for the Nota de Débito capability.
