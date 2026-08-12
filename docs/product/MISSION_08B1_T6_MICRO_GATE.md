# MISSÃO 08B.1 — T6 Micro-gate

Estado: IMPLEMENTADA / AGUARDA REEXECUÇÃO COMPLETA DOS GATES

## Objetivo
Integrar Person Resolution, restricted match, intake transacional/idempotente e decisões D-05 em uma API institucional única, eliminando os bypasses legados de criação direta de `Person` e de linking por UUID global vindo do browser.

## Contrato de autoridade
- Firebase autentica; `requireAuth` resolve Identity → Membership → Institution.
- `req.institutionalContext` é a única fonte de `institutionId`, `personId` do ator e role.
- `institutionId`, `role`, `approved`, `academicYearId` e `studentPersonId` no body são rejeitados.
- `student.personId` no body é rejeitado.
- o browser pode indicar `candidatePersonId` somente numa proposta D-05 de reutilização local; o backend rederiva os candidatos e só aceita o UUID se ele estiver no conjunto local plausível do caso atual.
- possible match restrito nunca devolve Person ID/origem ao browser.

## Fluxo
1. `POST /api/enrollments/person-resolution` — read-only.
2. Caso normal:
   - `NO_MATCH` → `/api/enrollments/intake` cria Person/Profile/Enrollment em T4;
   - `LOCAL_MATCH` → `/api/enrollments/intake` reutiliza o Person ID calculado novamente pelo backend.
3. Caso ambíguo/restrito:
   - não cria automaticamente;
   - `/api/enrollments/identity-decisions` rederiva candidatos e cria proposta T5;
   - `/api/enrollments/identity-decisions/:id/outcome` aplica D-05 com Membership real;
   - `/api/enrollments/intake` com `decisionId` só consome decisão `approved` da mesma instituição + `caseKey` derivado pelo servidor.
4. T4 revalida a decisão aprovada dentro da mesma transação que cria/reutiliza StudentProfile e Enrollment.

## Bypasses fechados
- `POST /api/enrollments/drafts` → 410;
- POST legado `/api/enrollments` → 410.

GETs, configuração de ofertas/ano letivo e transições de status permanecem no controller atual.

## Correções encontradas pela validação real
- regressão T4: tentativa de reuse cross-institution sem autorização volta a falhar fechado com `PERSON_NOT_FOUND`, sem consultar existência global de Person;
- PostgreSQL T5: parâmetros UUID do `UPDATE identity_resolution_decisions` são tipados explicitamente (`::uuid`) para eliminar inferência incompatível `text versus uuid` (`42P08`).

Estas correções não alteram privilégios nem expandem o domínio funcional; restauram o contrato T4 e tornam o contrato T5 executável em PostgreSQL real.

## Restart/persistência
`test:enrollment-intake-api:postgres` usa `TEST_DATABASE_URL`, cria schema descartável, aplica migrations 0001→0009, executa intake, fecha o pool, abre um novo pool e repete a mesma idempotency key. O resultado deve ser o mesmo Enrollment com `replayed=true`.

O mesmo teste cobre Escola A/B, restricted match, fail-closed T4 e reutilização cross-institution somente após proposta T5 + aprovação independente.

## Gates
- regressões T2/T3/T4/T5;
- `test:enrollment-intake-api`;
- `test:enrollment-intake-api:postgres`;
- `test:migrations:isolated`;
- lint;
- build;
- diff controlado: 10 ficheiros. Os dois ficheiros adicionais ao escopo T6 original são `identity-resolution-decision.ts` (correção PostgreSQL real T5) e `tests/enrollment-intake.test.ts` (regressão T4 fail-closed explícita).

## Fora do escopo
- UI T7;
- guardian 08B.2;
- merge de Person;
- OCR/fuzzy/IA;
- redesign geral de matrículas.
