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
