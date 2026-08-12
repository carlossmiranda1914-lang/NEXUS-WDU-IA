# MISSÃO 08B.1 — T4 Micro-gate

Estado: IMPLEMENTAÇÃO EM VALIDAÇÃO

## Objetivo
Introduzir intake transacional e idempotente para matrícula, sem ainda expor rota/API nova.

## Invariantes
- `institutionId` e `actorPersonId` são inputs de backend confiável; T6 será responsável por derivá-los de `institutionalContext`.
- `reuse_person` nesta tarefa só aceita Person já ligada à instituição atual por `student_profiles`.
- Reutilização cross-institution permanece bloqueada até o fluxo de autoridade/prova de T5/T6.
- `new_person` cria Person + StudentProfile + Enrollment + EnrollmentEvent + command record na mesma transação.
- retry com mesma chave + mesmo fingerprint devolve o resultado anterior sem duplicar recursos.
- mesma chave + fingerprint diferente falha fechado.
- falha em qualquer etapa executa rollback integral.
- concorrência da mesma chave é serializada via PostgreSQL transaction advisory lock.
- nenhum estado idempotente fica apenas em memória de processo.

## Migration
`0008_vnext_enrollment_intake_idempotency.sql` cria `enrollment_intake_commands` com unicidade por `(institution_id, operation, idempotency_key)` e fingerprint SHA-256.

## Fora do escopo
- rota HTTP/API real;
- UI;
- guardian;
- fuzzy/IA;
- aprovação D-05;
- reutilização cross-institution;
- merge de Persons.

## Evidência requerida antes de merge
- `npm run test:person-resolution`
- `npm run test:person-resolution-access`
- `npm run test:enrollment-intake`
- `npm run lint`
- `npm run build`
- migration `0008` aplicada com sucesso em schema/base descartável PostgreSQL.
