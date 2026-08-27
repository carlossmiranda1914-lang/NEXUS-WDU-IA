# ENROLLMENT-01 — DoR Evidence

**Estado:** READY — ENROLLMENT-01. A implementação está autorizada apenas no scope do Mission Pack.

| DoR | Evidência factual | Estado |
| --- | --- | --- |
| Problema reproduzível | `saveEnrollmentRegistration` bloqueia Application e atualiza `people` Student/Guardian; não recebe expected version. | Confirmado |
| Authority de versão existente | `people` e `enrollment_applications` não têm coluna version; `enrollment_processes.version` não governa a escrita de registration. | Lacuna confirmada |
| Authority de identidade | Person global, resolução fail-closed e decisões de identidade existem; browser não é authority de match. | Confirmado |
| Contrato de concorrência | Híbrido definido e aprovado na missão: versões explícitas + locks determinísticos + re-resolução. | Confirmado |
| Schema/migration | Preflight read-only passou no alvo PostgreSQL descartável aprovado em 2026-08-27; schema atual não tem authority reutilizável. Migration aditiva é necessária e autorizada. | Confirmado |
| Regressões a preservar | Intake idempotency, state machine, snapshots/policy de documentos, dossier físico e activation atómica. | Confirmado |
| IAM baseline | #78 OPEN; #79 OPEN/draft e dependente; `PROJECT_STATE.md` não reconcilia integração em main. A branch atual contém IAM/Auth fechado. | MERGE AUTHORIZATION REQUIRED para `main`; não bloqueia esta branch |
| Test matrix | AC01–AC10 e matriz PostgreSQL/HTTP definidos em `ENROLLMENT-01.md`. | Pronto para revisão |

## Evidência de ficheiros

- `src/modules/enrollments/enrollment-registration-api.ts`: boundary atual e mutações globais de Person.
- `src/modules/enrollments/enrollment-registration-policy.ts`: estados editáveis e campos de registration.
- `src/db/migrations/0001_vnext_identity_membership.sql`: Person global sem version.
- `src/db/migrations/0002_vnext_student_guardian_relationships.sql`: profile e relationship institution-scoped.
- `src/db/migrations/0006_vnext_enrollment_student360.sql`: Application institution-scoped sem version.
- `src/db/migrations/0009_vnext_identity_resolution_decisions.sql` e `0016_s03_enrollment_process_persistence.sql`: versões existentes em agregados distintos, não reutilizáveis por inferência.

## Decisão factual

**READY — ENROLLMENT-01.** A authority atual foi verificada como insuficiente, a migration aditiva está autorizada e o preflight PostgreSQL read-only passou no alvo descartável. A integração IAM em `main` continua a exigir autorização de merge, sem impedir execução e prova locais nesta branch.

O planeamento e readiness estão completos. Até este commit de documentação, não foram alterados código, schema, migrations, APIs, UI, fixtures ou comportamento de Enrollment.
