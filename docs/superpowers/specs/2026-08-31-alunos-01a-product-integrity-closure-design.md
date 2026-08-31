# ALUNOS-01A.3 Product Integrity & Closure — Design

## Objective

Close the product-integrity gaps discovered by adversarial audit without changing domain ownership or expanding into new modules.

The design optimizes for one property: a real institutional operator must be able to complete the supported Enrollment → Student journey without dead ends, stale truth, hidden scripts or unsafe authority shortcuts.

## Current truth

The existing architecture already provides the core authorities:

- Enrollment process projection is server-owned;
- document requirements and document metadata states are server-owned;
- activation is canonical, transactional and idempotent;
- activation resolves an opaque `studentRef`;
- Active Students and Student Record are server projections;
- tenant/auth/privacy contracts already exist.

The remaining defects are continuity/integrity defects between these authorities.

## Design decisions

### 1. Post-activation integrity comes before activation UI

The generic Enrollment transition graph must not allow a post-activation transition that can leave Enrollment and StudentProfile semantically inconsistent.

For ALUNOS-01A.3, the safe design is to close the generic `active -> cancelled` transition. A future explicit post-activation withdrawal/deactivation capability must own StudentProfile and Enrollment effects transactionally; that subsystem is out of scope here.

No hidden or partial StudentProfile write is added in this tranche.

### 2. Authoritative async views cannot preserve stale truth

When a process/student reference changes or an authoritative request is retried, old authoritative content must not remain actionable as if it belonged to the new request.

Required behavior:

- identify the currently authoritative request;
- stale/late responses cannot replace newer state;
- an error for request B cannot leave request A rendered as B;
- actions are unavailable while authoritative state is unresolved;
- refresh after a write consumes server truth instead of optimistic domain advancement.

Implementation may use request sequencing/abort semantics consistent with the existing codebase. No client cache authority is introduced.

### 3. Activation is reachable only through the existing authority

Administration and Direção must be able to perform activation from the product when the canonical server state declares the Enrollment eligible.

The UI does not calculate eligibility independently. It invokes the existing activation endpoint with the required version/idempotency contract, waits for server confirmation, then consumes the returned opaque `studentRef`.

Successful product path:

```text
Pronta para decisão
→ Ativar aluno
→ server-confirmed activation
→ exactly one Active Student
→ Abrir Registo do Aluno(studentRef)
```

Secretaria must not gain activation authority.

### 4. Journey degrades safely on partial process failure

The current client performs one process request per Enrollment. A failure of one process must not erase all valid Journey evidence.

Preferred design is the smallest safe solution supported by current APIs:

- preserve fulfilled process projections;
- represent unresolved process projections separately;
- Journey counts/selection use only confirmed process facts;
- show a bounded partial-data warning;
- never infer the failed process stage;
- retry can recover unresolved processes.

A new aggregate backend endpoint is not required unless evidence proves client-side partial composition cannot meet authority/performance constraints.

### 5. Ambiguous identity resolution gets an explicit operational path

`LOCAL_MATCH` and `NO_MATCH` already have usable outcomes. Ambiguous/restricted outcomes must not end in an informational dead end.

The product must expose only a safe review/decision surface supported by the existing backend authority. It must never reveal protected candidates or allow the browser to choose an internal person ID.

The workflow must end in one of:

- approved reuse of a server-selected safe identity outcome;
- confirmed creation of a new person where policy permits;
- explicit unresolved/rejected state with a human next step.

If the backend lacks a legitimate adjudication command for a required outcome, Task 5 stops and records that exact prerequisite rather than fabricating client behavior.

### 6. Accessibility/legacy cleanup cannot mask product work

Dialog focus lifecycle, Escape handling, focus restoration and semantic selected-state behavior should be corrected where the changed surfaces are touched.

The old parallel entry implementation may be removed only after repository evidence proves it is unreachable and tests have been migrated to the canonical drawer. No deletion merely for cleanliness.

## Security and privacy invariants

- Institution authority is resolved server-side.
- No internal Person/StudentProfile IDs enter human navigation.
- Activation uses opaque `studentRef` only for handoff.
- Cross-tenant references fail closed.
- Ambiguous identity review does not reveal protected candidate data.
- Failed/late requests cannot make stale data appear authoritative.
- No generic post-activation mutation may desynchronise Enrollment and StudentProfile.

## User experience contract

The user should understand:

- where the Enrollment is now;
- what blocks it;
- what legitimate action they can perform;
- who owns an action they cannot perform;
- whether displayed information is complete or partially unavailable;
- when activation has actually succeeded;
- how to open the resulting Student Record without another search.

No fake success, no disabled dead-end without explanation, no technical IDs, no backend enum leakage.

## Green definitions

### ENGINEERING_GREEN

Targeted contracts, affected regressions, security/privacy, lint, build, secret scan, diff check and canonical quality gate pass.

### INTEGRITY_GREEN

No known state transition or asynchronous path can make two canonical authorities contradict each other or present stale authoritative content.

### PRODUCT_GREEN

The supported journey is reachable through the UI by the appropriate roles using real server commands and persisted data. No SQL/scripts/devtools are required.

### HUMAN_UAT_GREEN

A human validates the real portal path after adversarial engineering review.

## Stop rules

Stop rather than guess if:

- a required identity-review outcome has no safe backend authority;
- fixing post-activation semantics requires inventing a new Student write subsystem;
- a schema change is required to preserve authority/integrity;
- any implementation would expose internal/protected identity data;
- the product can only be made to pass by weakening an existing security/integrity contract.