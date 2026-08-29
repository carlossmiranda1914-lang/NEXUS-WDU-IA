# NEXUS Project State

Updated: 2026-08-29

## Canonical baseline

- Repository baseline: `main @ f413d61381a6f9edb54a0ce1138e9c49fb49dd9b` (PR #84 merge).
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **integrated**; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment: **integrated**, including canonical activation.
- Academic Core (`ACADEMIC-01`): **integrated**; migration `0022` provides temporal academic authority.
- Student Context backend (`STUDENT-360-01`): **integrated**; migration `0023` provides read indexes and the projection remains read-only.

## Current priority

**NEXUS-RECOVERY-01 is DONE.** The ignored external UAT administrative identity was reconciled with the disposable local PostgreSQL target; bootstrap passed idempotently and real browser authentication resolved the canonical UID, Identity, Person, active Membership, Institution and InstitutionalContext with `/api/profile` 200, including a repeat login and post-runtime-restart resolution. Student visual UAT is still not accepted and requires its separately authorised UI/UAT path; this recovery did not implement it.

Finance is **NOT STARTED**. Assessment, Attendance and physical Documents remain non-authoritative for Student Context and must not be presented as completed facts.

## Canonical versus supporting work

- Canonical facts are commits merged into `main` and migrations `0001`–`0023`.
- PR #76 (agent skills) and PR #77 (IAM visual specification) are **OPEN** and supporting only; they are not authority for implementation.
- Non-merged branches, including historical Foundation/Enrollment worktrees and the Student-360 UI/auth branch, are not integrated capability until merged into `main`.

## Operational recovery

Run `npm run uat:bootstrap` from a named branch. It links ignored external local configuration, validates the approved disposable PostgreSQL target, verifies migrations and canonical IAM/UAT fixture facts. It never copies secrets or uses legacy `users.role` authority. A real Firebase login remains the final UAT proof.

## Next authorised action

`STUDENT-EXPERIENCE-01` Objective 1 is accepted as the navigation foundation: Active Students is separate from Enrollment processes, resolves one active StudentProfile per person through server-owned context and opens via opaque `studentRef`. It is not the final student-record UX.

Objectives 2.1 — Dedicated Student Record Workspace + Resumo —, 2.2 — Percurso académico — and 2.3 — Matrículas — have passed their Human UAT gates. Execute only the explicitly authorised `STUDENT-EXPERIENCE-01` Objective 2.4 — Documentos — on `codex/student-experience-01-active-students`. Finance is not authorised.
