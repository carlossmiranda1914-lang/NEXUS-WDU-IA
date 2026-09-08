# DOCUMENTS-FOUNDATION-I1 — Core Authority

**Estado oficial:** READY  
**Programa:** Documents Foundation  
**Mission owner:** ANTIGRAVITY  
**Analyst/reviewer:** DOCUMENTS_ANALYST  
**Implementação autorizada:** SIM — apenas dentro deste Mission Pack  
**Baseline de partida:** `main @ 02b7f0a454df922598b56660ce10216956539939`

## Objetivo

Preparar uma primeira fatia de implementação que introduza a autoridade documental genérica por instituição, sem alterar Finance, Matrícula ou a superfície transitória `uploaded_documents`.

## Limite de autoridade

Documents será autoridade futura para identidade documental, metadados, classes, versões, proveniência, referência opaca de armazenamento, autorização documental e auditoria genérica.

Finance mantém integralmente a autoridade de pagamento, obrigação, alocação, emissão fiscal, numeração, correção e proveniência financeira. Documents poderá apenas referenciar um artefacto financeiro emitido por Finance numa missão futura formal.

`enrollment_documents` mantém os metadados e a decisão de negócio de Matrícula. Não é convertido nesta missão em armazenamento físico nem é migrado.

## I1 — Document Core Authority

A implementação autorizada limita-se a:

1. persistência PostgreSQL institution-scoped para documento, versão/proveniência e referência de armazenamento opaca;
2. serviços/repositórios em `src/modules/documents/**`;
3. autorização server-side por `InstitutionalContext`;
4. auditoria factual mínima e idempotência para comandos retryable;\n5. testes unitários e PostgreSQL, incluindo negativos cross-tenant.\n\nNenhuma rota HTTP ou UI faz parte de I1.

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

## Preflight obrigatório do executor antes do primeiro ficheiro de código

- [ ] SHA remoto e worktree Documents confirmados limpos e isolados de Finance;
- [ ] número seguinte de migração confirmado no SHA de execução; sem rota nesta missão;
- [ ] matriz OWNED/SHARED/FORBIDDEN aprovada;
- [ ] contrato de dados I1 com chaves, constraints e compatibilidade definido;
- [x] matriz RED/GREEN com PostgreSQL real e negativos cross-tenant definida;
- [x] autorização mínima deriva do InstitutionalContext existente; nenhuma capability/IAM paralela;
- [x] nenhum P0/P1 de planeamento aberto;
- [x] Product Owner autorizou `IMPLEMENTATION_AUTHORIZED=YES` no escopo I1.

## Stop rules

Parar e pedir decisão formal se a implementação exigir alterar Finance, Enrollment, `uploaded_documents`, `server.ts`, contexto institucional ou qualquer ficheiro SHARED não aprovado.

## Definition of Ready

```text
MISSION=DOCUMENTS-FOUNDATION-I1
STATE=READY\nBASELINE_RECONCILED=PASS\nDOCUMENTS_WORKTREE_ISOLATED=PRE-FLIGHT_REQUIRED
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
