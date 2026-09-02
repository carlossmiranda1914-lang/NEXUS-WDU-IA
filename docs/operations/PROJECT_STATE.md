# NEXUS Project State

Updated: 2026-09-03

## Integrated baseline

- `main @ f945fe43d72e9f86078a184d557691e1c32d4b63` (PR #85 merged).
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **integrated**; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment authority: **integrated**, including canonical activation.
- Academic Core (`ACADEMIC-01`): **integrated**; migration `0022` provides temporal academic authority.
- Student Context / Student Experience: **integrated** through PR #85; read-only Student Record and opaque `studentRef` continuity are in `main`.

## Active product program

**ALUNOS-01A.3 — Product Integrity & Closure** is **DONE — READY FOR INTEGRATION** on `codex/alunos-01a-design`.

Final validated product checkpoint: `aa5dc956d82e6ad941377f75f6144a642c64f6a6`.

The earlier accepted checkpoint remains historical evidence. Pre-merge hardening subsequently closed the bounded F2–F5 continuity/integrity findings and added the missing runtime interaction proof for F2/F3.

Final gate state:

```text
ENGINEERING_GREEN=YES
INTEGRITY_GREEN=YES
PRODUCT_GREEN=YES
ADVERSARIAL_REVIEW=PASS
HUMAN_UAT_GREEN=YES
MISSION_STATUS=DONE
MERGE_SAFE=YES
P0=0
P1=0
P2=0
REVIEW_THREADS=5/5_RESOLVED
REMOTE_CI=PASS
```

Final hardening evidence:

- **F2 — State continuity:** PASS — registration save refreshes server-authoritative versions and same-drawer activation submits current lifecycle/registration versions without `STALE_VERSION`.
- **F3 — Lifecycle continuity:** PASS — activation → `active` retains the reachable Student Record handoff and uses the exact server-returned opaque `studentRef`.
- **F4 — Document policy continuity:** PASS — supported ad-hoc documents no longer block canonical policy capture; matching evidence is preserved, unrelated ad-hoc material remains intact, snapshot immutability/idempotency remain enforced.
- **F5 — Identity contract continuity:** PASS — resolver producer reasons and decision allowlist are aligned, including `national_id_number`; authorized opaque review queue and tenant non-disclosure remain intact.
- Same-class variants audited: **YES**.
- Historical applied migrations changed by hardening: **NO**.
- Workflow weakening: **NO**.
- Affected UAT: **GREEN**; F4/F5 manual scenarios were not manufactured and reused their passing PostgreSQL/HTTP proofs.

## Non-blocking visual/product debt (Backlog / Polish)

1. Nexus visual identity/palette can continue future Aurora design-system refinement.
2. Motion language can become more distinctive across state transitions.
3. Future visual polish must not reopen established domain/schema authority without a new mission.
4. Optional operational partial-failure messaging can mature in later UX work.

## Engineering governance

The canonical engineering operating model is active. Codex was the single writer for the bounded hardening; Antigravity independently reviewed the exact final product/evidence checkpoint. Risk → Proof → Tool → DONE, SHA-bound handoff and review-thread adjudication were applied before integration eligibility.

## Deferred domains

Finance is **NOT STARTED**. Assessment, Attendance and physical document storage/upload remain separate work. They must not be represented as implemented Student/Enrollment authority merely because UI placeholders, metadata contracts or plans exist.

## Canonical versus supporting work

- Only merged `main` commits are integrated capability.
- Mission branches contain proven work, but remain non-integrated until merged through their product gates.
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

Integrate PR #87 (`codex/alunos-01a-design`) into `main` after the documentation-only closeout commit itself passes the applicable remote CI. No further ALUNOS product changes are authorized in this tranche.