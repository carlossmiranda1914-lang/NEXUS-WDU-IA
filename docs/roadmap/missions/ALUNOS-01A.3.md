# ALUNOS-01A.3 — Product Integrity & Closure

**Status:** IMPLEMENTING — BOUNDED FINAL HARDENING
**Baseline:** `cd288ccfafaf6a25634ca0d785536586c0cef3ec`
**Parent mission:** `docs/roadmap/missions/ALUNOS-01A.md`
**Design authority:** `docs/superpowers/specs/2026-08-31-alunos-01a-product-integrity-closure-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-08-31-alunos-01a-product-integrity-closure.md`
**Execution branch:** `codex/alunos-01a-design`
**Historical Accepted Checkpoint:** `c6aa28c0a0b799642960daec9abdc0b77269b680`
**Final-hardening authority checkpoint:** `068dbcbd8b43eca8ae37ef96d6e008185fb67bd7`

## Current Gate Summary

The previous Product Owner acceptance and UAT remain historical evidence. Pre-merge review subsequently found bounded continuity/integrity defects in affected paths, so the final DONE/merge-safe claim is withdrawn until those paths are revalidated.

```text
ENGINEERING_GREEN=REVALIDATING_AFFECTED_EVIDENCE
INTEGRITY_GREEN=REVALIDATING_AFFECTED_EVIDENCE
PRODUCT_GREEN=REVALIDATING_AFFECTED_EVIDENCE
ADVERSARIAL_REVIEW=PENDING_CURRENT_HEAD
HUMAN_UAT_GREEN=REUSE_UNAFFECTED; RERUN_AFFECTED_FLOWS
MISSION_STATUS=IMPLEMENTING_FINAL_HARDENING
MERGE_SAFE=NO
```

## Historical completed work

Tasks 1–6 remain historical completed work and are not reopened wholesale. Their evidence is reusable unless the final-hardening delta invalidates it.

- Task 1 — Post-Activation Integrity: historical GREEN.
- Task 2 — Async & Stale-State Safety: historical GREEN.
- Task 3 — Authorized Activation Continuity: historical GREEN.
- Task 4 — Journey Partial-Failure Resilience: historical GREEN.
- Task 5A — Public Identity Decision Boundary: historical GREEN (Migration `0025`).
- Task 5B — Identity Evidence Revision & Server Re-resolution: historical GREEN (Migration `0026`).
- Task 5 — Identity Review Continuity: historical GREEN.
- Task 6 — Adversarial Product Gate & Real UAT: historical GREEN; affected flows require current-head revalidation.

## Final-hardening authority — F2–F5 only

Codex is the single writer. Antigravity is the independent read-only reviewer until explicit transfer. The current product correction scope is exactly these four risk classes:

### F2 — State continuity

Prove and close the complete class for registration save → refreshed lifecycle/registration versions → same-drawer activation. A static source contract is not sufficient. The required proof executes the ordered state transition and confirms activation uses current server-authoritative versions after a mutation.

### F3 — Lifecycle continuity

Prove and close activation → active → reachable Student Record handoff using the returned opaque `studentRef`. The active-state handoff must remain reachable even when no generic lifecycle transition targets remain. Behavioral/render-state proof is required.

### F4 — Document policy continuity

Prove and close supported pre-existing ad-hoc/unsourced enrollment documents → canonical requirement policy capture/materialization. Policy-backed immutable snapshots must remain immutable; arbitrary historical documents must not be deleted; canonical requirements must not be duplicated; validation must continue to use sourced canonical requirements. Real PostgreSQL proof is required.

### F5 — Identity contract continuity

Compare the complete producer set of canonical resolver-generated match reasons with the decision-boundary consumer allowlist and close every genuine contract mismatch in that producer/consumer class. At minimum, prove the `national_id_number` conflict/review path reaches an authorized opaque decision queue without `INVALID_DECISION_INPUT`, without exposing internal candidate/Person IDs, and with foreign-tenant non-disclosure preserved. PostgreSQL/HTTP boundary proof is required.

## Required execution method

For F2–F5:

1. reproduce the defect/current contract gap;
2. record root cause and affected class;
3. create a focused executable regression and prove RED for the correct reason;
4. implement the smallest complete architecture-preserving correction;
5. prove GREEN;
6. audit same-class variants;
7. run directly affected regression/security/idempotency/migration evidence;
8. run aggregate required gates once focused evidence is green;
9. push one coherent final-hardening checkpoint;
10. stop writes and obtain independent Antigravity review of the exact resulting HEAD.

No product correction may be declared closed solely because a source string/regex exists.

## Protected invariants

- Canonical Enrollment process projection and Single Process Truth;
- Journey Rail and Process Drawer information architecture;
- document-requirement policy-backed snapshot immutability;
- document status authority (`pending/submitted/verified/rejected` metadata only);
- canonical activation transaction and idempotency ledger;
- activation → opaque `studentRef` correlation;
- Active Students server projection;
- Student Record server read model;
- Firebase Identity → Person → active Membership → server-derived institutional authority;
- tenant/auth/privacy boundaries and foreign-tenant non-disclosure;
- browser never owns Person, institution, role, decision or candidate authority;
- exactly one active StudentProfile per canonical student context;
- no duplicate Person/StudentProfile/Enrollment creation;
- historical applied migrations remain byte-immutable.

## Forbidden scope

- new module or Finance work;
- unrelated refactor or broad UI redesign;
- historical migration modification;
- CI/workflow weakening;
- parallel writer over the same authority;
- automatic scope expansion after a new unrelated finding;
- new branch, new PR or force push for this correction unit.

A newly discovered P0/P1 or architecture/security/data-authority issue outside F2–F5 must stop implementation and be adjudicated before any scope expansion.

## Final exit criteria

ALUNOS-01A.3 may return to `DONE` and become merge-safe only when:

- F2, F3, F4 and F5 root causes are closed with risk-appropriate executable proof;
- same-class variants are audited;
- historical migrations remain unchanged;
- affected tenant/auth/privacy/idempotency evidence is green;
- local aggregate quality gate is green;
- exact resulting HEAD receives independent review;
- unresolved P0 = 0 and unresolved P1 = 0;
- P2 findings are adjudicated;
- applicable GitHub review threads are adjudicated/resolved with evidence;
- remote CI for the exact reviewed HEAD is green;
- Human UAT is rerun for flows invalidated by the correction delta;
- `PROJECT_STATE.md`, this Mission Pack and `NEXUS_ENGINEERING_CONFIG.yaml` are reconciled to the same final truth.

## Non-blocking product/visual debt

Existing visual identity, motion-language and optional operational-polish debt remains backlog. It is not authorized by this hardening and must not reopen the mission.