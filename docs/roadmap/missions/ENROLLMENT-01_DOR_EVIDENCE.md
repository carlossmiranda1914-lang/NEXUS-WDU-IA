# ENROLLMENT-01 — DoR Evidence

**Estado:** DONE — ENROLLMENT-01 IDENTITY MUTATION SAFETY PROVEN.

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

## Closeout AC01–AC10 — 2026-08-27

| AC | Requisito | Teste/prova e comando | Resultado | Commit/evidência |
| --- | --- | --- | --- | --- |
| AC01 | Concorrência sem lost update | `secretariat-s02-final-registration-postgres`; alvo PostgreSQL isolado | PASS: A v2, B v1 rejeitado | `11e6121` |
| AC02 | Stale 409 e zero parcial | PostgreSQL S02 + `enrollment-registration-http-operational` | PASS | `11e6121`, `b4970ad` |
| AC03 | Identificador material re-resolvido | `test:person-resolution`, access e S02 collision | PASS | `8373204`, `b32087e` |
| AC04 | Colisão/ambiguidade fail-closed | resolver unitário + S02 collision | PASS | `8373204`, `89ffb2` |
| AC05 | Sem exposição/appropriation cross-tenant | access resolver + S02 A→B | PASS | `8373204`, `b32087e` |
| AC06 | Student/Guardian/Enrollment atómicos | S02 PostgreSQL transaction proof | PASS | `20b9706`, `89ffb2` |
| AC07 | Rollback integral | S02 stale/collision audit and version assertions | PASS | `89ffb2` |
| AC08 | Audit factual sem PII | S02 event metadata assertions | PASS | `e954e7a`, `89ffb2` |
| AC09 | Intake/state/snapshot sem regressão | `test:enrollment-intake`, intake API, S03 PostgreSQL | PASS | fresh gate output 2026-08-27 |
| AC10 | Sem auto-retry | caller real envia uma vez e HTTP operational confirma write A/409 B | PASS | `b4970ad`, `3762a16` |

### Fresh final gates

- PostgreSQL: `enrollment-registration-concurrency-postgres`, S02 registration e HTTP operational PASS.
- Person Resolution/access, intake, intake API, identity decisions, S03 PostgreSQL e FND-03 tenant/context PASS.
- Lint, build, secret scan e `git diff --check` PASS.
- Build residuals: bundle >500 kB e direct `eval` em `server.ts`; ambos preexistentes e não introduzidos por ENROLLMENT-01.

### Quality gate autoritativo final — 2026-08-28

- Comando: `TEST_DATABASE_LOCAL_AUTHORIZED=true npm run quality-gate`, executado por wrapper local temporário com stdout/stderr redirecionados e exit code gravado após o processo filho terminar.
- Resultado: `exit=0`; conclusão agregada `quality-gate: PASS`; `postgres-foundation: PASS`; `committed-diff: PASS`; artifact/secret scan PASS (402 ficheiros tracked/staged).
- O CP4 FND-01 passou com o ledger canónico `0001–0020`. A correção mínima `ca6106c` apenas atualiza a expectativa histórica de 18 para 20, mantendo os controlos de ordenação, checksum, rollback e ledger.
- As duas tentativas anteriores foram recusas de precondição do harness (`TEST_DATABASE_LOCAL_AUTHORIZED=true` não chegou ao processo filho); não são regressões do produto. A tentativa seguinte revelou a expectativa CP4 obsoleta, corrigida e comprovada isoladamente antes deste run autoritativo.
- Os avisos/erros PostgreSQL de `changed_by` no stderr são os negative paths intencionais do CP4; o próprio subgate terminou PASS.
