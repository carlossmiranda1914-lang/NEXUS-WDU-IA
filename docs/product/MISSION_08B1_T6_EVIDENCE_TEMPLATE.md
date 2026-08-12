# MISSÃO 08B.1 — T6 Evidence Template

Preencher somente com execução real dos gates.

- E01 branch/HEAD:
- E02 diff contra `main`:
- E03 regressões T2/T3/T4/T5:
- E03 `test:enrollment-intake-api`:
- E03 `test:enrollment-intake-api:postgres`:
- E04 lint:
- E04 build:
- E05 contexto/role derivados de Membership:
- E06 Escola A → B restricted:
- E06 UUID/candidate manipulado:
- E07 restart + replay idempotente:
- E08 migrations 0001→0009:
- E11 auditoria sem dados sensíveis:
- E12 contratos API / legacy 410:
- E15 riscos P0–P3:

## Critérios mínimos de PASS
- nenhum endpoint T6 aceita `institutionId`, `role`, `approved`, `academicYearId` ou `studentPersonId` do browser como autoridade;
- `POST /api/enrollments/drafts` e POST legado `/api/enrollments` não escrevem mais;
- `NO_MATCH` normal cria uma única Person/Profile/Enrollment;
- `LOCAL_MATCH` reutiliza Person existente;
- nome sozinho não cria automaticamente; pode avançar somente por decisão excepcional aprovada conforme D-06/D-05;
- restricted match não expõe Person ID/origem;
- candidate local enviado pelo browser é revalidado contra o conjunto derivado no servidor;
- decisão aprovada de outra instituição/case não é consumida;
- T4 revalida decisão dentro da transação;
- retry após novo pool/restart devolve o mesmo Enrollment;
- cross-institution reuse somente ocorre após decisão T5 aprovada;
- nenhuma regressão T2–T5.
