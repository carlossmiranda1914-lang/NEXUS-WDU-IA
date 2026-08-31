# NEXUS Project State

Updated: 2026-08-30

## Canonical baseline

- Repository baseline: `main @ f413d61381a6f9edb54a0ce1138e9c49fb49dd9b` (PR #84 merge).
- Foundation Authority Convergence: **DONE** and integrated.
- IAM / institutional access: **integrated**; canonical access is Firebase Identity → Person → active Membership → server-derived InstitutionalContext.
- Enrollment: **integrated**, including canonical activation.
- Academic Core (`ACADEMIC-01`): **integrated**; migration `0022` provides temporal academic authority.
- Student Context backend (`STUDENT-360-01`): **integrated**; migration `0023` provides read indexes and the projection remains read-only.

## Current priority

**ALUNOS-01A is VALIDATING on `codex/alunos-01a-design`.** Its document-requirements P0 and ALUNOS-01A.2 Tasks 1–6 preserve a single server-derived Enrollment Journey through the existing Process Drawer, document gate, canonical activation and opaque Student Record handoff. No schema migration or physical document storage was added. PostgreSQL/HTTP, security, static/build and aggregate quality gates are green; Human UAT remains pending and is the only next acceptance gate. Student Experience 02 remains historically DONE (Human UAT accepted) on its own branch/closeout evidence.

Finance is **NOT STARTED**. Assessment, Attendance and physical Documents remain non-authoritative for Student Context and must not be presented as completed facts.

## Canonical versus supporting work

- Canonical facts are commits merged into `main` and migrations `0001`–`0023`.
- PR #76 (agent skills) and PR #77 (IAM visual specification) are **OPEN** and supporting only; they are not authority for implementation.
- Non-merged branches, including historical Foundation/Enrollment worktrees and the Student-360 UI/auth branch, are not integrated capability until merged into `main`.

## Operational recovery

Run `npm run uat:bootstrap` from a named branch. It links ignored external local configuration, validates the approved disposable PostgreSQL target, verifies migrations and canonical IAM/UAT fixture facts. It never copies secrets or uses legacy `users.role` authority. A real Firebase login remains the final UAT proof.

## Next authorised action

The active gate is Human UAT of the complete ALUNOS-01A Journey on `codex/alunos-01a-design`; do not advance the mission before explicit acceptance. Higher-fidelity Nexus visual polish, physical document lifecycle, Enrollment/Document owner-action routing, attention semantics, Finance, Assessment, Attendance, Communication, guardian writes, photograph/identity media, cross-domain timeline and AI/predictive capability remain separate prerequisites or deferred domains.
