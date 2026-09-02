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

**ALUNOS-01A.3 — Product Integrity & Closure** is **DONE** on `codex/alunos-01a-design` and ready for integration into `main`.

Accepted checkpoint: `c6aa28c0a0b799642960daec9abdc0b77269b680`.

Final Gates:

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=YES
PRODUCT_GREEN=YES
ADVERSARIAL_REVIEW=PASS
HUMAN_UAT_GREEN=YES
MISSION_STATUS=DONE
```

Proven and accepted:

- Task 1 — Post-Activation Integrity: **GREEN**.
- Task 2 — Async and Stale-State Safety: **GREEN**.
- Task 3 — Authorized Activation Continuity: **GREEN**.
- Task 4 — Journey Partial-Failure Resilience: **GREEN**.
- Task 5A — Public Identity Decision Boundary: **GREEN** (Migration `0025`).
- Task 5B — Identity Evidence Revision & Server Re-resolution: **GREEN** (Migration `0026`).
- Task 5 — Identity Review Continuity: **GREEN**.
- Task 6 — Adversarial Product Gate & Real UAT: **GREEN** (Human UAT accepted by Product Owner).

## Non-blocking visual/product debt (Backlog / Polish)

1. Nexus visual identity/palette still feels somewhat generic; further Aurora design-system token refinement is scheduled.
2. Motion language can become more distinctive and intentional across state transitions.
3. Continue future visual refinement in subsequent UX tracks without reopening domain/schema authority.
4. Operational partial-failure messaging should continue to mature where applicable.

## Engineering governance transition

Repository-wide engineering governance is materialized on `codex/nexus-engineering-governance` from the integrated `main` baseline. Its purpose is to establish one durable operating model for Product Owner/ChatGPT coordination, Codex + Antigravity ownership/review, resource discipline, handoffs and integration.

Canonical operational selector after governance integration: `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`.

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

Merge `codex/alunos-01a-design` into `main` upon Human Approval for Integration.
