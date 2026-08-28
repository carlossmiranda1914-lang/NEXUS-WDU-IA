# ACADEMIC-01 — Canonical Temporal Academic Structure & Teacher Assignment

**Estado:** DONE — ACADEMIC-01.

## Objetivo

Criar a autoridade institucional e temporal que responde, no servidor, quem ensina que disciplina, a que turma e em que ano académico. Esta missão consome `Enrollment.active` + `StudentProfile.active`; não recria activation, Attendance, Assessment, horário ou Student 360.

## AS-IS e decisão

- `academic_years` e `enrollment_offers` já são institution-scoped e o ano ativo é único por instituição (`0006`, `0010`).
- `teachers.subjects/classes` e a estrutura `students.class/grades` em `0017`/`schema.ts` são legados JSON/texto; não são authority para Academic Core.
- Não existem Class/Cohort, Subject, placement ou TeacherAssignment vNext temporal, versionados e auditáveis.

ACADEMIC-01 introduz agregados vNext sem migrar/reutilizar arrays legados: `AcademicProgram` (curso/programa), `AcademicLevel`, `AcademicClass`, `AcademicSubject`, `TeacherAssignment` e `StudentAcademicPlacement`.

## Modelo canónico

| Agregado | Ownership / temporalidade | identidade e lifecycle |
| --- | --- | --- |
| AcademicYear | instituição; datas já canónicas | UUID; draft/active/closed; um active por instituição |
| AcademicProgram | instituição; catálogo com vigência | UUID + code institucional; active/retired; version |
| AcademicLevel | instituição + Program; vigência por ano | UUID + code por Program; active/retired; version |
| AcademicClass | instituição + AcademicYear + Level/Program | UUID + code único no ano; planned/active/closed; version |
| AcademicSubject | instituição; associação explícita Program/Level/Year | UUID + code no âmbito confirmado pelo AS-IS; active/retired; version |
| TeacherAssignment | instituição + AcademicYear + Class + Subject + teacher Person | UUID; planned/active/replaced/ended; effective dates, version e audit |
| StudentAcademicPlacement | instituição + AcademicYear + StudentProfile + Class | UUID; active/ended; version e audit |

Relações académicas nunca são atemporais: Class, subject availability, assignment e placement referenciam AcademicYear. Professor atual é assignment `active` cuja data efetiva contém hoje; histórico lê assignments `replaced/ended`, sem apagar linhas. Substituição termina a assignment anterior e cria a seguinte na mesma transação; sobreposição para Class × Subject × período é rejeitada. Encerrar turma termina novos placements/assignments conforme policy explícita; reabertura é comando versionado, nunca update livre. Novo ano cria novos Class/availability/assignment records.

## Autoridade e segurança

- Todo comando deriva Institution de `InstitutionalContext`; payload nunca escolhe tenant.
- Teacher elegível: Person com Membership `teacher` ativa na mesma instituição; TeacherProfile só será requerido se o AS-IS provar que já é authority canónica — a tabela legacy `teachers` não conta.
- Student placement requer, no mesmo client/transaction, `Enrollment.status='active'` e `StudentProfile.status='active'` da instituição e ano da placement. Enrollment não é alterada.
- Cada mutation exige `expectedVersion`; stale retorna `409 STALE_VERSION`, sem auto-retry. Locks ordenados: AcademicYear → Class → Subject → Teacher Membership → active Assignment/Placement.
- Queries e FKs usam institution_id/composite ownership quando aplicável; A→B para year/class/subject/teacher/assignment responde fail-closed, sem PII.
- Audit factual grava institution, aggregate, operation, human actor ou system cause, correlation/request ID quando presente e metadata allowlisted sem nomes/contactos/payloads.

## Migration decision

Necessária migration **0022** aditiva e forward-only após confirmar nomenclaturas/constraints no preflight. Não reescrever `0001–0021`. Incluir FKs institution-safe, checks de lifecycle/datas, uniqueness por âmbito temporal, version `BIGINT CHECK (>0)`, índices de current/history, audit/event mínimo e exclusão/validação equivalente para períodos sobrepostos. Rollback operacional é deploy compatível; teste de migration isolada prova upgrade e constraints.

## HTTP e read contracts

Commands canónicos: create/update/close academic structure; assign/replace/end teacher; place/end student. Responses são safe projections. Reads mínimos: roster de Class, agenda/assignments de Teacher, Subject-by-Class, placement de Student e `current` versus `historical`. UI recebe 409 e deve fazer refresh explícito antes de nova decisão.

## Acceptance criteria

1. AC01 estrutura é institution-scoped.
2. AC02 Class e Subject têm authority temporal explícita.
3. AC03 TeacherAssignment é versionada e auditável.
4. AC04 assignment A→B falha fechada.
5. AC05 teacher elegível é validado server-side por Membership ativa/papel permitido.
6. AC06 A/B concorrente não cria assignment ambígua/overlap.
7. AC07 stale assignment devolve 409 seguro.
8. AC08 assignment histórica é consultável.
9. AC09 replacement preserva histórico.
10. AC10 placement exige Enrollment e StudentProfile ativos.
11. AC11 reads distinguem current/historical.
12. AC12 audit factual não persiste PII desnecessária.

## Matriz obrigatória

PostgreSQL/HTTP real: year/class/subject; assignment válida; papel proibido; Membership inativa; A→B de cada referência; stale; concorrência; replacement/history; placement activa/inativa; rollback após escrita intermédia; audit seguro. Regressões: Enrollment-01/02, AcademicYear, IAM/context, Person Resolution, tenant/context, migration isolation, lint/build/secret/diff/quality gate.

## OUT

Attendance, Assessment/grades, timetable engine, Student 360, Finance, object storage Documents, messaging, automations e redesign UI.

## Downstream contract

Attendance e Assessment poderão autorizar docentes somente por TeacherAssignment ativa; Student 360 poderá ler placements, class/subject e histórico sem criar writes; Finance não recebe authority académica. Nenhum consumidor pode criar `Enrollment.active` ou assignment por tabela/JSON legado.

**READY — ACADEMIC-01.**

## Closeout evidence

| AC | requisito exato | teste/comando | resultado | evidência |
| --- | --- | --- | --- | --- |
| AC01–02 | estrutura e temporalidade institution-scoped | migration + class/subject PostgreSQL/HTTP | PASS | `0022`, `academic-temporal-migration-postgres.test.ts` |
| AC03–09 | assignment versionada, auditável, temporal, replacement/history | TeacherAssignment PostgreSQL/HTTP | PASS | `teacher-assignment-*.test.ts` |
| AC10–11 | placement exige handoff ativo e separa current/historical | Placement PostgreSQL/HTTP | PASS | `student-academic-placement-*.test.ts` |
| AC12 | audit factual sem payload PII | audit trigger rollback contracts | PASS | PostgreSQL placement/assignment tests |

Final validation executes migration isolation, target PostgreSQL/HTTP regressions, lint, build, secret scan, diff and the repository quality gate. No Attendance, Assessment, Student 360, Finance or ACADEMIC-02 scope was introduced.
