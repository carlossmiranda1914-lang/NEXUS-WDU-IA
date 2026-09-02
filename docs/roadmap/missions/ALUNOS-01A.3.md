# ALUNOS-01A.3 — Product Integrity & Closure

**Status:** DONE — INTEGRATED
**Baseline:** `cd288ccfafaf6a25634ca0d785536586c0cef3ec`
**Parent mission:** `docs/roadmap/missions/ALUNOS-01A.md`
**Design authority:** `docs/superpowers/specs/2026-08-31-alunos-01a-product-integrity-closure-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-08-31-alunos-01a-product-integrity-closure.md`
**Execution branch:** `codex/alunos-01a-design`
**Historical Accepted Checkpoint:** `c6aa28c0a0b799642960daec9abdc0b77269b680`
**Final Product/Evidence Checkpoint:** `aa5dc956d82e6ad941377f75f6144a642c64f6a6`
**Final Documentation Closeout Checkpoint:** `136a1f9150ad541a974139aafae9ca6dc0eb5509`
**Integration PR:** `#87`
**Integration Commit:** `f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e`

## Final Gate Summary

Pre-merge review reopened only bounded F2–F5 continuity/integrity risks. Those risk classes were closed with risk-appropriate executable evidence and independent review. The additional F2/F3 evidence-only tranche changed no product files and proved the real same-drawer interaction path. PR #87 subsequently passed its final exact-head CI and was merged into `main`.

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=YES
PRODUCT_GREEN=YES
ADVERSARIAL_REVIEW=PASS
HUMAN_UAT_GREEN=YES
MISSION_STATUS=DONE
P0=0
P1=0
P2=0
REVIEW_THREADS=5/5_RESOLVED
FINAL_PR_CI=SUCCESS
PR_87=MERGED
MAIN_INTEGRATION=COMPLETE
```

## Final hardening results

### F2 — State continuity — PASS

Registration save refreshes the canonical enrollment versions while the process drawer remains open. Runtime/component interaction proof confirms activation then submits the refreshed lifecycle and registration versions and does not regress to stale V1 values.

### F3 — Lifecycle continuity — PASS

After activation, terminal `active` state retains the reachable `Abrir Registo do Aluno` handoff even without generic lifecycle transitions. Runtime proof confirms the handoff uses exactly the server-returned opaque `studentRef`.

### F4 — Document policy continuity — PASS

Supported pre-existing ad-hoc documents do not block canonical policy capture. Matching evidence is preserved, unrelated ad-hoc material remains intact, canonical sourced requirements are not duplicated, policy-backed snapshots remain immutable and replay remains idempotent. PostgreSQL/HTTP proof is green.

### F5 — Identity contract continuity — PASS

The complete canonical resolver producer reason set and decision-boundary allowlist are aligned, including `national_id_number`. Conflicting national-ID evidence reaches the authorized opaque review queue without `INVALID_DECISION_INPUT`, duplicate Person creation or cross-tenant disclosure. PostgreSQL/HTTP proof is green.

## Independent review and UAT

Independent Antigravity review of `aa5dc956d82e6ad941377f75f6144a642c64f6a6` confirmed the F2/F3 runtime proof is real, regression-sensitive and non-circular; `react-test-renderer` is test/dev-only; F4/F5 evidence was not invalidated; P0/P1/P2 are zero.

Affected UAT is green:

- F2 same-drawer registration save → activation: PASS.
- F3 activation → active → Student Record: PASS.
- F4 manual scenario: not manufactured; existing PostgreSQL proof reused and PASS.
- F5 manual scenario: not manufactured; existing PostgreSQL/HTTP proof reused and PASS.
- Console errors: none.
- Dead ends: none.
- Duplicate side effects: none.

All five material PR review threads were adjudicated and resolved before merge.

## Protected invariants preserved

- Single Process Truth and Journey Rail remain canonical;
- document policy-backed snapshots remain immutable;
- activation remains server-authorized, transactional and idempotent;
- activation → opaque `studentRef` continuity remains intact;
- Firebase Identity → Person → active Membership → server-derived institutional authority remains canonical;
- tenant/privacy boundaries remain fail-closed and non-disclosing;
- browser does not own Person, institution, role, decision or candidate authority;
- exactly one active StudentProfile invariant remains intact;
- no duplicate Person/StudentProfile/Enrollment creation path introduced;
- historical applied migrations remain unchanged.

## Closure rule

ALUNOS-01A.3 is closed and integrated. No further ALUNOS product implementation is authorized under this mission. Any future ALUNOS change requires a new explicit mission/task and must not mutate this historical completion record into an active implementation authority.

## Non-blocking product/visual debt

Existing visual identity, motion-language and optional operational-polish debt remains backlog. It is not part of ALUNOS-01A.3 closure and must not reopen the mission without a new authorized task.