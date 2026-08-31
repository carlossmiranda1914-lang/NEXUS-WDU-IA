# Active Mission

- Mission: ALUNOS-01A — Enrollment-to-Student Continuity & Interaction
- Canonical branch: `codex/alunos-01a-design`
- Canonical worktree path: `D:\Soft\NEXUS-WDU-IA-alunos-01a`
- Baseline: `a858fa47b6393cabd600dc69151ebed90951939e`
- Status: VALIDATING
- Current tranche: ALUNOS-01A.2 Task 6 validates the server-owned Enrollment-to-Student Journey after Tasks 1–5 and the document-requirements P0. The engineering fence is green and the mission is ready for Human UAT; it is not DONE or merged.
- UAT data: administrative identity and local PostgreSQL target remain external/ignored; no physical upload/storage is claimed.
- Deferred: physical document lifecycle/storage, Finance, Assessment, Attendance, Communication, guardian writes, photograph/identity media, cross-domain timeline and AI remain outside this P0.
- Evidence: document gate in the live drawer, activation/opaque-`studentRef` PostgreSQL+HTTP proof, Active Students and Student Context regressions, lint, build, secret scan, diff check and aggregate quality gate are PASS. The read-only drawer no longer exposes the internal student number; independent review found no P0/P1.
- Next gate: Human UAT of the full Journey on `http://localhost:3000`: **Alunos & Matrículas → Visão Operacional → processo → documentos → authorized activation owner → Alunos ativos → Registo do Aluno**. The existing Drawer does not invent an activation action; the canonical owner and its tested handoff remain server-side.
