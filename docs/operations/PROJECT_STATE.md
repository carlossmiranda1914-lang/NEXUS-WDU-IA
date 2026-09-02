# NEXUS Project State

Updated: 2026-09-03

## Integrated baseline

- `main @ f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e` — PR #87 merged; ALUNOS-01A / ALUNOS-01A.2 / ALUNOS-01A.3 integrated.
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **DONE** and integrated; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment authority: **DONE** and integrated, including canonical activation.
- Academic Core (`ACADEMIC-01`): **DONE** and integrated; migration `0022` provides temporal academic authority.
- Student 360 / Student Experience: **DONE** and integrated; read-only Student Record and opaque `studentRef` continuity are in `main`.
- ALUNOS Product Integrity & Closure (`ALUNOS-01A.3`): **DONE** and integrated through PR #87.

## Active product program

**NONE.**

No product mission is authorized for implementation while this post-ALUNOS closeout is being recorded. The next roadmap program is Finance Core, but Finance remains **NOT STARTED** until discovery/product decision/design authority/Mission Pack/DoR explicitly authorize implementation.

## ALUNOS final integration record

Final validated product/evidence checkpoint: `aa5dc956d82e6ad941377f75f6144a642c64f6a6`.
Final documentation-closeout checkpoint before merge: `136a1f9150ad541a974139aafae9ca6dc0eb5509`.
Integration merge commit: `f3ffb1c73f09f33079fcb34d8cad8bab9f5dfe4e`.

Final gate state:

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

Final hardening evidence:

- **F2 — State continuity:** PASS — registration save refreshes server-authoritative versions and same-drawer activation submits current lifecycle/registration versions without `STALE_VERSION`.
- **F3 — Lifecycle continuity:** PASS — activation → `active` retains the reachable Student Record handoff and uses the exact server-returned opaque `studentRef`.
- **F4 — Document policy continuity:** PASS — supported ad-hoc documents do not block canonical policy capture; matching evidence is preserved, unrelated ad-hoc material remains intact, snapshot immutability/idempotency remain enforced.
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

The canonical engineering operating model is active. Risk → Proof → Tool → DONE, single-writer ownership, SHA-bound handoffs, independent review and review-thread adjudication remain mandatory for future missions.

## Deferred / next domains

- **Finance Core:** NEXT ROADMAP PRIORITY, **NOT STARTED**.
- Assessment: NOT STARTED.
- Attendance: NOT STARTED.
- Physical document storage/upload: separate future work.

These domains must not be represented as implemented authority merely because UI placeholders, legacy fields, metadata contracts or plans exist.

## Canonical versus supporting work

- Only merged `main` commits are integrated capability.
- Mission branches contain work but are non-integrated until merged through their product gates.
- Chat history, Codex sessions and Antigravity sessions are not canonical project memory.
- Drive is source authority for business/external material; implementation authority derived from it must be promoted into canonical repository documentation.

## Recovery entrypoint

A human or agent resuming work reads, in order:

1. `AGENTS.md`;
2. `docs/README.md`;
3. this `PROJECT_STATE.md`;
4. `docs/operations/NEXUS_ENGINEERING_CONFIG.yaml`;
5. the active Mission Pack/spec/plan and referenced contracts, when one exists;
6. the applicable Codex or Antigravity adapter.

Then verify Git reality before editing.

## Next authorised action

Complete this documentation/governance-only post-merge truth reconciliation. After it is integrated, begin **Finance Core PREPARATION/DISCOVERY only**: inspect AS-IS financial authority, legacy writes/data/contracts and operational requirements, then make an explicit product/design decision before creating or implementing `FINANCE-01`. No Finance production code is authorized by this state document.