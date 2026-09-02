# NEXUS Project State

Updated: 2026-09-02

## Integrated baseline

- `main @ f945fe43d72e9f86078a184d557691e1c32d4b63` (PR #85 merged).
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **integrated**; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment authority: **integrated**, including canonical activation.
- Academic Core (`ACADEMIC-01`): **integrated**; migration `0022` provides temporal academic authority.
- Student Context / Student Experience: **integrated** through PR #85; read-only Student Record and opaque `studentRef` continuity are in `main`.

## Active product program

**ALUNOS-01A.3 — Product Integrity & Closure** is **IMPLEMENTING — FINAL HARDENING** on `codex/alunos-01a-design`.

The mission was previously accepted as DONE at checkpoint `c6aa28c0a0b799642960daec9abdc0b77269b680`. Pre-merge review subsequently identified bounded continuity/integrity findings that invalidate the earlier final-closeout claim for the affected paths only. The accepted historical evidence remains evidence; it is not rewritten as if it never occurred.

Current final-hardening authority checkpoint: `068dbcbd8b43eca8ae37ef96d6e008185fb67bd7`.

Current gate state:

```text
ENGINEERING_GREEN=REVALIDATING_AFFECTED_EVIDENCE
INTEGRITY_GREEN=REVALIDATING_AFFECTED_EVIDENCE
PRODUCT_GREEN=REVALIDATING_AFFECTED_EVIDENCE
ADVERSARIAL_REVIEW=PENDING_CURRENT_HEAD
HUMAN_UAT_GREEN=REUSE_UNAFFECTED; RERUN_AFFECTED_FLOWS
MISSION_STATUS=IMPLEMENTING_FINAL_HARDENING
MERGE_SAFE=NO
```

Historical tasks remain completed. This final hardening does not reopen their full scope. It is bounded to four accepted risk classes:

- **F2 — State continuity:** registration save → refreshed lifecycle/registration versions → same-drawer activation.
- **F3 — Lifecycle continuity:** activation → active → reachable Student Record handoff using the returned opaque `studentRef`.
- **F4 — Document policy continuity:** supported pre-existing ad-hoc document → canonical policy capture/materialization without weakening immutable policy-backed snapshots.
- **F5 — Identity contract continuity:** all canonical resolver-generated match reasons, including `national_id_number`, can cross the decision boundary into the authorized opaque review queue without leaking internal candidate/Person IDs.

Required method for F2–F5: reproduce → root cause → behavioral/integration RED → minimal architecture-preserving correction → GREEN → affected regression proof → exact-current-HEAD independent review.

Historical applied migrations remain immutable. No unrelated module, broad redesign, opportunistic refactor or automatic scope expansion is authorized.

## Non-blocking visual/product debt (Backlog / Polish)

1. Nexus visual identity/palette still feels somewhat generic; further Aurora design-system token refinement is scheduled.
2. Motion language can become more distinctive and intentional across state transitions.
3. Continue future visual refinement in subsequent UX tracks without reopening domain/schema authority.
4. Operational partial-failure messaging should continue to mature where applicable.

## Engineering governance

The canonical engineering operating model is active on this mission. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml` is the operational selector. Codex is the single writer for the bounded final-hardening unit; Antigravity is the independent read-only reviewer until an explicit write transfer is recorded.

## Deferred domains

Finance is **NOT STARTED**. Assessment, Attendance and physical document storage/upload remain separate work. They must not be represented as implemented Student/Enrollment authority merely because UI placeholders, metadata contracts or plans exist.

## Canonical versus supporting work

- Only merged `main` commits are integrated capability.
- Mission branches contain proven work, but remain non-integrated until reviewed/merged through their product gates.
- Chat history, Codex sessions and Antigravity sessions are not canonical project memory.
- Drive is source authority for business/external material; implementation authority derived from it must be promoted into canonical repository documentation.

## Recovery entrypoint

A human or agent resuming work reads, in order:

1. `AGENTS.md`;
2. `docs/README.md`;
3. this `PROJECT_STATE.md`;
4. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`;
5. the active Mission Pack/spec/plan and referenced contracts;
6. the applicable Codex or Antigravity adapter.

Then verify Git reality before editing.

## Next authorised product action

Execute the bounded ALUNOS-01A.3 F2–F5 final hardening on `codex/alunos-01a-design` under the canonical RED → root-cause → minimal correction → GREEN protocol. Do not merge until the resulting exact HEAD has independent review, applicable remote CI is green, affected UAT is revalidated and review findings are adjudicated.