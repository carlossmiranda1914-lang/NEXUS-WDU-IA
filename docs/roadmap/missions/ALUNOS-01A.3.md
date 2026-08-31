# ALUNOS-01A.3 — Product Integrity & Closure

**Status:** AUTHORISED FOR SDD EXECUTION
**Baseline:** `cd288ccfafaf6a25634ca0d785536586c0cef3ec`
**Parent mission:** `docs/roadmap/missions/ALUNOS-01A.md`
**Design authority:** `docs/superpowers/specs/2026-08-31-alunos-01a-product-integrity-closure-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-08-31-alunos-01a-product-integrity-closure.md`
**Execution branch:** `codex/alunos-01a-design`

## Why this tranche exists

ALUNOS-01A.2 reached an automated engineering gate but failed human product acceptance. A read-only adversarial audit then confirmed that technical GREEN was not sufficient to prove a school can complete the real Enrollment → Student journey safely and without dead ends.

The audited product state is:

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=NO
PRODUCT_GREEN=NO
HUMAN_UAT_GREEN=NO
MISSION_READY_TO_CLOSE=NO
```

## Adjudicated blockers

| ID | Severity | Root cause | Required outcome |
| --- | --- | --- | --- |
| AL-03 | P1 / integrity-first | Generic `active -> cancelled` transition can desynchronise Enrollment and active StudentProfile semantics | Close unsafe generic post-activation transition; do not invent post-activation Student writes |
| AL-05 | P1 / integrity-first | Async reads can retain stale/late data during student/process changes or failures | Authoritative content and error must be mutually coherent; stale responses cannot win |
| AL-01 | P0 | Canonical activation exists server-side but has no reachable Administration/Direção product action | Authorized activation in product using existing authority, idempotency/version rules and opaque `studentRef` handoff |
| AL-02 | P1 | One `/process` failure can erase the whole Journey Rail | Partial-failure-safe Journey composition; valid processes remain usable |
| AL-04 | P1 | Ambiguous/restricted identity outcomes have backend authority but no complete frontend resolution workflow | Safe human review path and return to Enrollment without protected identity leakage |
| AL-06 | P2 | Drawer/dialog accessibility is not fully proven | Focus lifecycle, Escape and semantic states proven |
| AL-07 | P2 | Old local entry implementation remains parallel to canonical flow | Remove only after proving it is unreachable and tests are migrated |

## Frozen implementation order

```text
T1=POST_ACTIVATION_INTEGRITY
T2=ASYNC_STALE_STATE_SAFETY
T3=AUTHORIZED_ACTIVATION_CONTINUITY
T4=JOURNEY_PARTIAL_FAILURE_RESILIENCE
T5=IDENTITY_REVIEW_CONTINUITY
T6=ADVERSARIAL_PRODUCT_GATE_AND_REAL_UAT
```

AL-06/AL-07 are hardening items. They may be folded into the task that naturally owns them only when scope remains bounded; otherwise they are explicitly deferred with evidence.

## Protected completed work

Do not rebuild or weaken:

- canonical Enrollment process projection;
- document-requirement configuration/materialisation and immutable snapshots;
- document status authority (`pending/submitted/verified/rejected` metadata only);
- canonical activation transaction and idempotency ledger;
- activation → opaque `studentRef` correlation;
- Active Students server projection;
- Student Record server read model;
- tenant/auth/privacy boundaries;
- single Journey terminology and Process Drawer information architecture;
- existing Nexus motion/visual work unless a correction is required by a proven product defect.

## Out of scope

- physical document upload/storage/preview/download/versioning;
- general post-activation Student editing/deactivation subsystem;
- Finance, Assessment, Attendance, Communication, AI;
- dashboard redesign;
- broad visual redesign unrelated to a finding;
- schema change unless a task proves no safe existing-authority solution exists and triggers a stop-rule review.

## Execution discipline

Use plan-specific Subagent-Driven Development. Each task gets a fresh implementer and independent reviewer. Completed tasks are recorded in the plan-specific ledger and are never re-dispatched.

Existing tests are evidence, not truth. A reviewer must challenge whether the real product path is reachable and coherent, not merely whether tests pass.

Do not ask the human to approve ordinary implementation/test fixes. Stop only for destructive/security-sensitive actions, shared-branch side effects, or a genuine specification contradiction where every path is guesswork.

## Product acceptance contract

No task or implementer may declare the mission DONE.

The tranche may reach `READY_FOR_HUMAN_UAT` only when all are true:

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=YES
PRODUCT_GREEN=YES
ADVERSARIAL_REVIEW=PASS
HUMAN_UAT_GREEN=PENDING
```

`PRODUCT_GREEN` requires a real school operator to be able to complete the supported Enrollment → Student journey through the product without SQL, scripts, devtools, hidden bootstrap actions or manual identity guessing.

Final human acceptance remains mandatory before mission closeout/merge.