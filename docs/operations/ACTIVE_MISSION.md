# Active Mission

- Mission: ALUNOS-01A — Enrollment-to-Student Continuity & Interaction
- Canonical branch: `codex/alunos-01a-design`
- Canonical worktree path: `D:\Soft\NEXUS-WDU-IA-alunos-01a`
- Baseline: `a858fa47b6393cabd600dc69151ebed90951939e`
- Status: VALIDATING
- Current P0: make canonical Enrollment document requirements configurable and explicitly materialized for an uncaptured mutable enrollment, preserving immutable historical snapshots and the existing document-status authority.
- UAT data: administrative identity and local PostgreSQL target remain external/ignored; no physical upload/storage is claimed.
- Deferred: physical document lifecycle/storage, Finance, Assessment, Attendance, Communication, guardian writes, photograph/identity media, cross-domain timeline and AI remain outside this P0.
- Evidence: focused PostgreSQL/HTTP, affected regressions, lint, build, secret scan, diff check and aggregate quality gate are PASS; independent review found no P0/P1.
- Next gate: Human UAT of the preserved Process Drawer document stage on `http://localhost:3000`.
