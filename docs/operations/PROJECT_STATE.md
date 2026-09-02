# NEXUS Project State

Updated: 2026-09-01

## Integrated baseline

- `main @ f945fe43d72e9f86078a184d557691e1c32d4b63` (PR #85 merged).
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **integrated**; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment authority: **integrated**, including canonical activation.
- Academic Core (`ACADEMIC-01`): **integrated**; migration `0022` provides temporal academic authority.
- Student Context / Student Experience: **integrated** through PR #85; read-only Student Record and opaque `studentRef` continuity are in `main`.

## Active product program

**ALUNOS-01A.3 — Product Integrity & Closure** is the active non-merged product mission on `codex/alunos-01a-design`.

Durable remote checkpoint: `1a5392ba04e8a0db317ff2791478839726c11026`.

Proven on that branch:

- Task 1 — Post-Activation Integrity: **GREEN**.
- Task 2 — Async and Stale-State Safety: **GREEN**.
- Task 3 — Authorized Activation Continuity: **GREEN**.
- Task 4 — Journey Partial-Failure Resilience: **GREEN**.
- Task 5A — Public Identity Decision Boundary: **GREEN**.

Current dependency chain:

- **T5B — Identity Evidence Revision & Server Re-resolution:** approved prerequisite; implementation is paused while the repository-wide engineering governance is reconciled.
- **Task 5 — Identity Review Continuity:** depends on T5B.
- **Task 6 — Adversarial Product Gate and Real UAT:** not started; depends on Task 5.

ALUNOS-01A.3 is **not PRODUCT_GREEN, not HUMAN_UAT_GREEN and not DONE**. Non-merged branch capability is not integrated `main` capability.

## Engineering governance transition

Repository-wide engineering governance is being materialized on `codex/nexus-engineering-governance` from the integrated `main` baseline. Its purpose is to establish one durable operating model for Product Owner/ChatGPT coordination, Codex + Antigravity ownership/review, resource discipline, handoffs and integration.

Canonical operational selector after governance integration: `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`.

The governance change must not rewrite, cherry-pick over, reset or discard ALUNOS-01A.3 product work. After governance reconciliation, T5B resumes from the existing ALUNOS branch/worktree and reuses Tasks 1–4/T5A evidence unless T5B actually invalidates it.

## Deferred domains

Finance is **NOT STARTED**. Assessment, Attendance and physical document storage/upload remain separate work. They must not be represented as implemented Student/Enrollment authority merely because UI placeholders, metadata contracts or plans exist.

## Canonical versus supporting work

- Only merged `main` commits are integrated capability.
- Mission branches may contain proven work, but remain non-integrated until reviewed/merged through their product gates.
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

After governance reconciliation, resume **ALUNOS-01A.3 T5B only**. Do not start Task 5 before T5B is independently GREEN. Do not start Task 6 before Task 5 is independently GREEN. Do not start Finance while the current ALUNOS product-blocking mission remains open.
