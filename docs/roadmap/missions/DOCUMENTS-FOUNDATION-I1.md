# DOCUMENTS-FOUNDATION-I1 — Core Authority Preparation

**Estado oficial:** PREPARATION  
**Programa:** Documents Foundation  
**Owner de preparação:** DOCUMENTS_ANALYST  
**Executor futuro:** ANTIGRAVITY  
**Implementação autorizada:** NÃO  
**Baseline de partida:** `main @ 02b7f0a454df922598b56660ce10216956539939`

## Objetivo

Preparar uma primeira fatia de implementação que introduza a autoridade documental genérica por instituição, sem alterar Finance, Matrícula ou a superfície transitória `uploaded_documents`.

## Limite de autoridade

Documents será autoridade futura para identidade documental, metadados, classes, versões, proveniência, referência opaca de armazenamento, autorização documental e auditoria genérica.

Finance mantém integralmente a autoridade de pagamento, obrigação, alocação, emissão fiscal, numeração, correção e proveniência financeira. Documents poderá apenas referenciar um artefacto financeiro emitido por Finance numa missão futura formal.

`enrollment_documents` mantém os metadados e a decisão de negócio de Matrícula. Não é convertido nesta missão em armazenamento físico nem é migrado.

## I1 candidato — Document Core Authority

Quando esta missão passar a `READY`, a implementação proposta limitar-se-á a:

1. persistência PostgreSQL institution-scoped para documento, versão/proveniência e referência de armazenamento opaca;
2. serviços/repositórios em `src/modules/documents/**`;
3. autorização server-side por `InstitutionalContext`;
4. endpoints mínimos de leitura/criação de metadados, somente se o caminho de composição for explicitamente aprovado;
5. auditoria factual mínima e idempotência para comandos retryable;
6. testes unitários, HTTP e PostgreSQL, incluindo negativos cross-tenant.

## Exclusões absolutas

- Finance e qualquer ficheiro/tabela/migração sob `src/modules/finance/**`;
- `enrollment_documents` e `src/modules/enrollments/**`;
- `uploaded_documents`, `server.ts` e as rotas genéricas transitórias hoje fechadas;
- upload binário, GCS, malware, quarentena, preview/renderização, partilha externa, eliminação/restauro;
- SharePoint, Office na Web, Microsoft 365 e sincronização de versões;
- UI de dossiê e redesign visual.

## Matriz de ficheiros

| Classe | Área | Estado |
|---|---|---|
| OWNED | novo `src/modules/documents/**` | permitido apenas depois de READY + autorização |
| OWNED | novos `tests/documents-*.test.ts` | permitido apenas depois de READY + autorização |
| OWNED | nova migração Documents | permitido apenas depois de READY + autorização |
| SHARED | `src/db/schema.ts`, infraestrura de migração, composição de rotas | caminho exato e alteração mínima precisam aprovação I1 |
| SHARED | `InstitutionalContext` / middleware auth | consumir sem mudar; qualquer alteração é STOP |
| FORBIDDEN | Finance, Enrollment, `uploaded_documents`, rotas transitórias `/api/documents` | nenhuma alteração nesta missão |

## Invariantes

- contexto institucional é resolvido no servidor; um ID, URL ou referência não concede acesso;
- todo read/write é institution-scoped e tem negativo A→B;
- documentos e versões não são reescritos destrutivamente;
- uma referência de armazenamento não é uma URL pública nem autorização;
- repetição idempotente devolve o resultado canónico; chave com conteúdo diferente falha fechada;
- nenhuma operação Documents altera verdade Finance ou estado de Matrícula;
- estados/evidência técnicos não simulam upload, preview, anti-malware ou integração externa.

## Evidência obrigatória antes de READY

- [ ] SHA remoto e worktree Documents confirmados limpos e isolados de Finance;
- [ ] caminho de migração atual e composição de rotas confirmados no SHA de execução;
- [ ] matriz OWNED/SHARED/FORBIDDEN aprovada;
- [ ] contrato de dados I1 com chaves, constraints e compatibilidade definido;
- [ ] matriz RED/GREEN com PostgreSQL real, HTTP e negativos cross-tenant definida;
- [ ] decisão explícita sobre capability/papéis mínimos sem criar IAM paralelo;
- [ ] nenhum P0/P1 aberto;
- [ ] aprovação explícita do Product Owner para `IMPLEMENTATION_AUTHORIZED=YES`.

## Stop rules

Parar e pedir decisão formal se a implementação exigir alterar Finance, Enrollment, `uploaded_documents`, `server.ts`, contexto institucional ou qualquer ficheiro SHARED não aprovado.

## Definition of Ready

```text
MISSION=DOCUMENTS-FOUNDATION-I1
STATE=READY
BASELINE_RECONFIRMED=PASS
DOCUMENTS_WORKTREE_ISOLATED=PASS
OWNED_SHARED_FORBIDDEN=APPROVED
DATA_CONTRACT=APPROVED
AUTHORIZATION_CONTRACT=APPROVED
POSTGRESQL_TEST_MATRIX=APPROVED
CROSS_TENANT_NEGATIVES=REQUIRED
FINANCE_BOUNDARY=PASS
ENROLLMENT_BOUNDARY=PASS
P0_OPEN=0
P1_OPEN=0
IMPLEMENTATION_AUTHORIZED=YES
```
