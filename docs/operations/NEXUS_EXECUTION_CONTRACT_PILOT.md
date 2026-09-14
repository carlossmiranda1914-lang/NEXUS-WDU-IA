# Nexus Edu IA — Execution Contract Pilot

**Status:** APPROVED PILOT  
**Initial pilot:** Finance  
**Documents module:** explicitly excluded from this pilot; handled by a separate analyst.  
**Purpose:** preserve the approved development method in durable repository context so execution does not depend on chat history.

## 1. Core principle

A Nexus capability is developed as:

`Authority Core -> Validation UI -> Early Vertical Proof -> Hardening -> Independent Closure -> Product UX later`

The backend owns domain truth and authority. A minimal but real Validation UI must appear early enough to prove that the real product can exercise that authority. Deep/final UX is a later capability unless explicitly included.

## 2. Goal contract

Every executable capability starts with:

```text
ACTOR=
STARTING_STATE=
ACTION=
AUTHORITATIVE_RESULT=
VISIBLE_RESULT=
```

If these cannot be stated clearly, the capability is not ready for execution.

## 3. Adaptive risk

Use one primary risk class:

- `R0 LOCAL` — isolated, non-stateful, presentation/local behavior.
- `R1 PRODUCT` — bounded product/API/state change.
- `R2 CRITICAL_STATE` — money, documents, persistence, concurrency, migrations, idempotency, audit or important institutional state.
- `R3 AUTHORITY` — IAM, tenancy, security, legal/fiscal authority, cross-domain authority or architecture.

Risk determines proof depth. It does not justify extra reports by itself.

## 4. Authority boundary

Each capability names:

```text
DOMAIN_AUTHORITY=
PERSISTENCE_AUTHORITY=
AUTHORIZATION_AUTHORITY=
TENANT_AUTHORITY=
CLIENT_AUTHORITY=
```

The client may request, display and explain. It never fabricates business authority, institutional context, permissions, eligibility or authoritative state transitions.

## 5. Delivery shape

### Authority Core

Implement the smallest correct authoritative path first: domain/state transition, persistence, authorization, tenancy, transactions, idempotency, audit/outbox, API/error semantics as applicable.

### Validation UI

Build a minimal real surface early. It is not a mock and not disposable. It must respect the official architecture, but does not need final Nexus UX depth.

Its purpose is to prove:

`real actor -> real UI -> real API -> authoritative backend -> persistence -> visible result`

### Product UX

Deep UX, responsive refinement, visual density, advanced navigation and final polish are separate unless explicitly part of the current objective.

## 6. Authorized and protected surfaces

Each contract declares:

```text
AUTHORIZED_SURFACE=
PROTECTED_SURFACE=
```

The agent has strong autonomy inside the authorized surface when changes directly serve the objective. Crossing a protected authority requires escalation.

## 7. Change traceability

Every material change must map to the objective:

```text
CHANGE=
WHY_REQUIRED=
OBJECTIVE_OR_INVARIANT_SERVED=
```

If that causal link cannot be established, the change is `OUT_OF_OBJECTIVE` and must not be implemented.

## 8. Agent autonomy

### GREEN — fix and continue

The executor does not ask for new authorization for normal in-scope engineering problems, including implementation bugs, wiring defects, API/client mismatch, Validation UI integration defects, persistence/idempotency defects inside the approved authority, focused test repairs caused by the delta, legitimate UAT fixture repair, or safe non-destructive environment recovery.

This autonomy applies only while:

```text
OBJECTIVE_UNCHANGED=YES
AUTHORITY_UNCHANGED=YES
PROTECTED_SURFACE_TOUCHED=NO
SECURITY_WEAKENED=NO
```

### YELLOW — investigate, then escalate

The executor may investigate fully but must stop before changing a protected boundary when the smallest correct solution requires a product decision, architecture/authority change, global IAM/tenant change, protected shared service, unexpected schema expansion, application shell change, new legal/fiscal policy or external production authority.

Escalation must contain:

```text
ROOT_CAUSE=
WHY_CURRENT_CONTRACT_CANNOT_CLOSE=
PROTECTED_AUTHORITY_REQUIRED=
SMALLEST_DECISION_REQUIRED=
OPTIONS=
RECOMMENDATION=
```

### RED — hard stop

Never weaken tenant isolation, move server authority to the browser, fabricate success/evidence, invent legal/fiscal rules, rewrite immutable history, weaken tests to obtain PASS, bypass security or enable test authority in production.

## 9. Failure classification

Before changing code for a meaningful failure, classify it:

`PRODUCT | IMPLEMENTATION | ENVIRONMENT | AUTOMATION | TEST | DEPENDENCY | CONFIGURATION | UNKNOWN`

A failed automation interaction is not automatically a product defect. An environment defect is not automatically a reason to change product code.

## 10. Early vertical proof

As soon as a thin slice exists, prove:

`ACTOR -> VALIDATION_UI -> API -> AUTHORITY -> PERSISTENCE -> READBACK -> VISIBLE_RESULT`

For a mutation, typical proof is:

```text
UI_ACTION=YES
NETWORK_REQUEST=YES
AUTHORITATIVE_COMMAND_REACHED=YES
STATE_CHANGED=YES
DB_READBACK=YES
UI_READBACK=YES
```

If this fails, classify and resolve the failure before deepening unrelated implementation or UX.

## 11. Evidence contract

Required evidence is defined before implementation and is proportional to risk. Typical R2 evidence may include domain transition, PostgreSQL readback, authorization allow/deny, tenant negative, idempotency, vertical UI->API->state proof and required persistence after refresh/restart.

Only add artifact/document proof when the artifact itself is part of the objective.

Evidence is classified:

- `FRESH` — current delta requires it now.
- `REUSABLE` — still valid because the current delta cannot affect it.
- `INVALIDATED` — current delta may affect it; rerun required.

Do not rerun unrelated expensive proof for ceremony.

## 12. Claim rule

**CLAIM WITHOUT INDEPENDENT EVIDENCE = UNPROVEN.**

This applies to executor, reviewer, auditor, CI, ChatGPT, Codex and Antigravity.

A report describes evidence; it does not replace evidence.

## 13. Executor closure request

When execution is complete, return a short closure package:

```text
OBJECTIVE_RESULT=
HEAD=
CHANGED_AUTHORITIES=
EVIDENCE=
VERTICAL_RESULT=
KNOWN_DEFERRED_ITEMS=
PROTECTED_SURFACES_CHANGED=NO
READY_FOR_INDEPENDENT_CLOSURE=YES
```

No historical narrative is required unless a blocker or investigation materially changes understanding.

## 14. Independent targeted audit

The auditor starts from:

`Objective -> Contract -> Exact HEAD -> Diff -> Required Evidence`

Only afterwards should the executor narrative be reconciled.

The auditor asks one adversarial question:

**What is the most likely way this implementation could look correct while still failing the objective or authority model?**

Audit depth follows risk. It is not a repository-wide audit by default.

## 15. Closure states

Only three closure results are valid:

- `CLOSED` — every mandatory criterion is independently proven and no contract violation remains.
- `UNPROVEN` — no demonstrated violation, but required evidence is missing or invalid.
- `BLOCKED` — factual violation of the objective, authority/truth contract, security, tenancy or another mandatory invariant.

Avoid ambiguous completion states such as "almost done", "backend done" or "looks good".

## 16. Deferred discovery rule

A new finding blocks closure only if it violates the objective, authority/truth contract, mandatory evidence, security or tenant isolation.

Otherwise it is recorded as `DEFERRED` and does not retroactively redefine DONE.

## 17. Product Owner intervention

The Product Owner is required for product decisions, authority/architecture trade-offs, destructive/external production authorization and Human UAT where the contract requires human acceptance.

The Product Owner is not a router for normal bugs, retries, safe runtime restart, fixture repair, wiring corrections or ordinary implementation choices inside the authorized boundary.

## 18. Execution-envelope template

```text
NEXUS EXECUTION CONTRACT

CAPABILITY=
OBJECTIVE=

ACTOR=
STARTING_STATE=
ACTION=
AUTHORITATIVE_RESULT=
VISIBLE_RESULT=

RISK=R0|R1|R2|R3

DOMAIN_AUTHORITY=
PERSISTENCE_AUTHORITY=
AUTHORIZATION_AUTHORITY=
TENANT_AUTHORITY=
CLIENT_AUTHORITY=

AUTHORIZED_SURFACE=
PROTECTED_SURFACE=

INVARIANTS=
-

VALIDATION_UI=
-

EARLY_VERTICAL_PROOF=
-

REQUIRED_EVIDENCE=
-

AUTONOMY=
Fix and continue for in-scope implementation/integration defects.

ESCALATE_ONLY_IF=
- product decision required
- authority/architecture boundary must change
- protected surface must change
- destructive/external production action required

HARD_STOP_IF=
- tenant/security weakened
- server authority bypassed
- immutable truth rewritten
- success/evidence fabricated

DONE=
Every required criterion independently proven at the exact final HEAD.

CLOSURE=
Independent targeted audit returns CLOSED.
```

## 19. Pilot rule

Finance is the first real pilot of this contract. Documents is intentionally excluded from this pilot and must not be modified or re-governed by Finance execution.

The pilot is successful only if it measurably reduces Product Owner intervention, handoffs and remediation cycles while preserving or improving architectural rigor and real product evidence.

Do not expand this document into a larger manual during the pilot unless repeated evidence proves a missing mechanism.

---

# Pilot 01 — Finance / Authoritative Credit Note

## P01.1 Baseline and objective

```text
CAPABILITY=FINANCE_AUTHORITATIVE_CREDIT_NOTE
SOURCE_PLAN=docs/superpowers/plans/2026-09-12-finance-f7-g02-angola-production-jurisdiction.md
PRIOR_CLOSED_CAPABILITY=Task 7 / Factura-Recibo
PRIOR_FINANCE_BRANCH=codex/finance-case-b-invoice
PRIOR_FINANCE_HEAD=fb241c26f2dddb514e4db22a6986b4ca399b6902
DOCUMENTS_SCOPE=EXCLUDED
```

Before implementation, the executor must verify actual Git/worktree reality. Historical SHA values are baseline references, not permission to ignore newer repository state.

```text
ACTOR=authorized institutional Finance user with document-correction permission
STARTING_STATE=an eligible immutable issued financial document exists in the active institution
ACTION=create a Nota de Crédito through the normal Nexus Finance product flow
AUTHORITATIVE_RESULT=a new immutable credit_note FinancialDocument is persisted and linked to the original without rewriting the original
VISIBLE_RESULT=the user can see the issued credit note, its authoritative number/value and its relationship to the original document
```

## P01.2 Risk and authority

```text
RISK=R2_CRITICAL_STATE
DOMAIN_AUTHORITY=Finance Financial Document correction authority
PERSISTENCE_AUTHORITY=PostgreSQL
AUTHORIZATION_AUTHORITY=backend institutional Membership/capability context
TENANT_AUTHORITY=server-resolved active institution
MONETARY_AUTHORITY=Finance exact-money/domain authority
CLIENT_AUTHORITY=interaction and presentation only
```

A discovery becomes R3/escalation if the smallest correct solution requires changing IAM/tenant architecture, shared legal/fiscal production authority, or another protected cross-domain authority.

## P01.3 Authorized surface

The executor has GREEN autonomy within the smallest implementation surface required for:

- credit-note correction eligibility/composition;
- the existing Financial Document correction path;
- a focused credit-note policy/composition helper if required;
- correction HTTP/client contracts;
- the minimum Validation UI inside Finance Document surfaces;
- focused Finance tests and legitimate NEXUS_TEST UAT fixture support.

Normal in-scope defects in these areas are fixed and verified without Product Owner interruption.

## P01.4 Protected surface

Do not change without YELLOW escalation and explicit decision:

- closed Task 7 Factura-Recibo semantics merely to clean deferred debt;
- receipt issuance authority;
- invoice issuance authority;
- payment, allocation or obligation authority;
- `src/App.tsx` or global application-shell behavior;
- global authentication/IAM/Membership/tenant architecture;
- Finance schema/migrations unless a factual prerequisite is proven;
- shared idempotency/numbering engines beyond the existing extension contract;
- Angola production enablement or AGT integration;
- Documents module.

## P01.5 Invariants

The pilot must preserve:

- the original issued document and historical snapshot are immutable;
- a credit note is a new first-class linked Financial Document, not an UPDATE/DELETE of the original;
- same-institution ownership is resolved and enforced server-side;
- browser input is never authority for institution, original totals, original ownership, policy eligibility, series eligibility or correction-chain truth;
- correction money is exact and currency-consistent;
- duplicate/retry intent does not consume a second authoritative sequence or create a duplicate credit note;
- successful issuance uses the existing transactional audit/outbox authority;
- NEXUS_TEST/UAT authority must never become Angola production authority;
- debit-note semantics remain out of scope.

## P01.6 Authority Core target

The backend must establish a first-class credit-note correction path from an eligible issued original document through authoritative eligibility, exact-money limits, effective credit-note series, immutable correction snapshot, persistence, source/correction linkage, audit and outbox.

The current generic correction behavior must not be accepted as sufficient merely because it can produce a `credit_note` row. Existing receipt/payment-derived shortcuts must be adjudicated against this contract before reuse.

## P01.7 Validation UI target

The Validation UI is intentionally minimal but real. Through normal Finance product navigation, an authorized user must be able to:

1. open an eligible issued financial document;
2. see a truthful `Criar Nota de Crédito` action only when backend capability allows it;
3. see enough authoritative information to understand the original document and correction intent;
4. submit the correction through the real API;
5. observe the issued credit note and its relationship to the original.

This is not authorization for Finance redesign, global navigation changes or final Nexus UX polish.

## P01.8 Early vertical proof

As soon as the thin slice exists, prove before deeper hardening:

```text
REAL_ACTOR=YES
REAL_FINANCE_UI=YES
REAL_API_REQUEST=YES
AUTHORITATIVE_CORRECTION_COMMAND=YES
POSTGRESQL_CREDIT_NOTE=YES
ORIGINAL_UNCHANGED=YES
UI_READBACK=YES
```

If this proof fails, classify the failure and resolve only within GREEN autonomy. Do not deepen unrelated frontend or hardening while the basic vertical path is unproven.

## P01.9 Required evidence — E1 to E8

Only these behavioral evidence classes define pilot closure unless a mandatory security/authority contradiction is discovered:

### E1 — Domain truth

An eligible original is accepted and an explicitly ineligible original is rejected according to the authoritative correction contract.

### E2 — Monetary truth

Correction amount is positive, exact, currency-consistent and does not exceed the authoritative permitted correction bound.

### E3 — Persistence truth

PostgreSQL readback proves one new `credit_note` FinancialDocument, correct correction linkage and persisted immutable correction snapshot/provenance.

### E4 — Original immutability

Readback proves the original document row/snapshot/source truth is not rewritten by credit-note issuance.

### E5 — Tenant/security

Same-tenant authorized behavior succeeds; foreign-tenant/original/series access fails closed or non-discloses according to existing Nexus security semantics.

### E6 — Idempotency/numbering

The same canonical intent/key returns the same credit-note result without consuming a second authoritative number; modified payload under the same key conflicts/fails according to the canonical command contract.

### E7 — Audit/outbox

First successful issuance produces the required durable audit/outbox intent exactly once under the existing Finance transactional authority.

### E8 — Vertical product proof

A real user completes `Finance UI -> API -> authoritative command -> persistence -> UI readback`, and the resulting document remains present after the persistence boundary required by the current Finance runtime (at minimum refresh; relogin/restart only where the delta can invalidate previously proven persistence behavior).

Build/lint/static gates remain normal engineering checks but do not replace E1-E8 behavioral proof.

## P01.10 Evidence reuse rule

Classify each existing Finance proof as `FRESH`, `REUSABLE` or `INVALIDATED` against the final delta. Do not rerun unrelated aggregate proof merely for ceremony. If the credit-note delta changes a shared authority, the affected shared evidence becomes `INVALIDATED` and must be rerun before closure.

## P01.11 Autonomous failure handling

GREEN examples: correction eligibility bug, exact-money validation bug, correction-path query bug, API/client mismatch, Validation UI wiring defect, legitimate NEXUS_TEST fixture issue, focused test defect caused by the delta, safe local UAT recovery.

YELLOW examples: need to change App/IAM, tenant model, unrelated Finance domain authority, shared schema, global numbering/idempotency contract, new Angola legal rule or production AGT authority.

RED examples: browser-authorized tenant, fabricated legal eligibility, destructive rewrite of the original, weakened tenant isolation, synthetic production enablement, weakened tests or fabricated evidence.

## P01.12 Executor closure request

The executor finishes with only:

```text
OBJECTIVE_RESULT=
FINAL_HEAD=
CHANGED_AUTHORITIES=
E1_DOMAIN=
E2_MONEY=
E3_PERSISTENCE=
E4_ORIGINAL_IMMUTABILITY=
E5_TENANT_SECURITY=
E6_IDEMPOTENCY_NUMBERING=
E7_AUDIT_OUTBOX=
E8_VERTICAL_PRODUCT=
EVIDENCE_REUSE=
KNOWN_DEFERRED_ITEMS=
PROTECTED_SURFACES_CHANGED=NO|YES
READY_FOR_INDEPENDENT_CLOSURE=YES|NO
```

A narrative PASS without the underlying evidence is `UNPROVEN`.

## P01.13 Independent closure

The independent auditor binds review to the exact final HEAD, inspects the objective/contract/diff/evidence and asks:

**What is the most likely way this implementation could look like a valid Nota de Crédito while not representing a real authoritative financial correction?**

Minimum adversarial targets:

- credit note is merely receipt/payment semantics renamed;
- original document is mutated;
- correction exceeds permitted monetary basis;
- foreign tenant can discover or correct another institution's document;
- idempotent replay consumes another number or duplicates the document.

Closure output is exactly one of:

`CLOSED | UNPROVEN | BLOCKED`

No new feature, unrelated remediation or Product UX expansion is authorized by the closure audit.
