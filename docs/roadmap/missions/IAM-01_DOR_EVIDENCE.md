# IAM-01 — Definition of Ready Evidence

**Mission:** IAM-01 — Ciclo de Acesso Institucional

**State:** RECOVERED AND PROVEN — o working tree IAM não commitado sobre `8c0a0239a0786c2561ef1ef94e1fb869555bf714` foi preservado e commitado em `codex/iam-01-recovered`. Migration, command core, audit factual, rotas HTTP e leitura institucional foram exercitados contra o PostgreSQL local descartável autorizado. UI, deploy e merge permanecem fora desta evidência.

**Base inspected:** `main` merge `8c0a0239a0786c2561ef1ef94e1fb869555bf714` (PR #75).

## Evidência AS-IS

| ID | Caminho/objeto | Facto observado | Tratamento IAM-01 |
|---|---|---|---|
| AS-01 | `0001_vnext_identity_membership.sql` + `0019_iam_access_integrity.sql` | A base mantém `UNIQUE(person_id,institution_id,role)`; `0019` acrescenta `memberships.version`, o índice parcial **único** ativo Person×Institution, Intent, ledger, eventos imutáveis e FKs compostas tenant-safe. | Prova CP4/schema/isolada PASS; não altera a constraint legada. |
| AS-02 | `src/auth/institutional-context.ts` | Consulta apenas Membership/instituição `active`; sem Membership retorna `missing_membership`; seleção de instituição é validada contra Membership ativa. | Preservar e testar em todos os comandos IAM. |
| AS-03 | `src/middleware/auth.ts` | Firebase token é verificado e o contexto PostgreSQL é resolvido antes de `next()`; header `x-institution-id` não cria contexto. | Não substituir por claims/browser; provar suspensão/revogação em nova requisição. |
| AS-04 | `server.ts` `/api/profile/request-access`, `/api/profile/role` | Ambos retornam 503 `CANONICAL_TENANT_AUTHORITY_REQUIRED` antes de código legado. | Regressão obrigatória; não reativar. |
| AS-05 | `server.ts` POST/PUT/DELETE `/api/users` | Retornam 503 `CANONICAL_IAM_PROVISIONING_REQUIRED` antes de persistência; FND-02 tem contrato dedicado. | Substituição só por command canónico novo, nunca desvio para `users`. |
| AS-06 | `src/db/schema.ts`, `0017_fnd01_legacy_compatibility_schema.sql`, `src/db/users.ts` | Tabela/helper `users` persistem UID, role e status legados; helper contém create/update por UID/e-mail. | Legado competitivo; não é fonte de autorização. Busca estática não encontrou caller fora da definição; revalidar antes de código. |
| AS-07 | `tests/institutional-context.test.ts` | Prova ausência de acesso sem Membership ativa, seleção exigida para múltiplas instituições e rejeição de instituição estrangeira. | Regressão canónica obrigatória. |
| AS-08 | `tests/fnd02-legacy-user-administration-fence.test.ts`, `tests/fnd03-teacher-profile-tenant-fence.test.ts` | Provam retorno 503 pré-persistência nas rotas IAM/profile legadas. | Regressões obrigatórias. |
| AS-09 | FND-05 / `server.ts` observability | Há request/correlation IDs e audit factual por domínio; `/api/logs` legado é fenced; observability não é audit de decisão IAM. | Definir produtor IAM factual, mínimo e tenant-scoped. |

## CP0 — resultado somente leitura

| Item | Resultado | Evidência / consequência |
|---|---|---|
| 1. caller graph `requireAuth` e Identity → Person → Membership → Institution | PASS | `requireAuth` verifica Firebase e chama `resolveInstitutionalContext`; a query usa `identities → people → memberships → institutions`, filtrando Membership/instituição `active`. |
| 2. rotas legacy fenced | PASS | `/api/profile/request-access`, `/api/profile/role` e POST/PUT/DELETE `/api/users` retornam 503 antes do código de persistência; contratos FND-02/FND-03 cobrem os cercos. |
| 3. contratos de audit reutilizáveis | PASS (base), BLOCKED (IAM) | FND-05 fornece regra factual/minimizada e request/correlation IDs; não existe produtor/evento específico para decisão IAM. |
| 4. tabelas/constraints Membership | PASS | AS-01 confirma estados, unicidade Person × Institution × Role, timestamps de decisão e índice de contexto ativo. |
| 5. migration mínima | PASS | `0019` aplicada uma vez no CP4 após preflight vazio; schema público, cadeia isolada e teste IAM PostgreSQL PASS. |
| 6. ativação sem ação explícita de `institution_admin` | PASS | Não há mutação de `memberships` encontrada no código pesquisado; contexto apenas lê `active`; rotas legacy estão fenced. A implementação futura precisa de teste negativo explícito. |

## CP1 — contrato canónico de comando e audit

| Item | Resultado | Evidência / decisão |
|---|---|---|
| Entidade única de intenção para pedido + convite | PASS | `Access Intent` é workflow único com `kind`; Membership continua a única autoridade institucional. |
| Estados/transições de Intent e Membership | PASS | Contrato em `IAM-01.md`; Intent terminal não autoriza acesso e Membership `active` continua única fonte de contexto. |
| Comandos backend e matriz de autoridade | PASS | Políticas v2/v3 resolvem D-07–D-10: papel único ativo, código opaco/hash fora do Nexus, 72h/5 tentativas/15min/rotação e bootstrap administrativo auditado. |
| Idempotência e concorrência | PASS (contrato) | Reutiliza padrão vNext transaction + command ledger + fingerprint + lock; execução/testes permanecem NOT RUN. |
| Último `institution_admin` | PASS (contrato) | Requer lock do conjunto de admins ativos; dois comandos concorrentes não podem deixar zero. |
| Audit IAM | PASS (schema/contrato) | `iam_membership_events` tenant-safe e imutável existe; o produtor transacional é trabalho CP3–CP6. |
| Dados mínimos/anti-enumeração | PASS (contrato) | Sem e-mail obrigatório, PII excessiva, diretório global ou código em logs; TTL 72h, cinco tentativas, bloqueio 15min e rotação estão aprovados. |
| Catálogo migration CP2 | PASS | `0019`, schema ORM, verificadores e teste PostgreSQL foram aplicados/validados no CP4. |

### Catálogo de migration proposto para CP2 (sem SQL)

| Estrutura | Colunas/índices/constraints necessários | Motivo |
|---|---|---|
| `iam_access_intents` | ID, `institution_id`, `kind`, estado, Person/Identity alvo nullable e controlado, `code_hash`, expiração/aceitação/consumo, contador/janela/bloqueio de tentativas, criador, `idempotency_key`, fingerprint, timestamps; índice por instituição/estado; unicidade de idempotência. | Pedido e convite numa única autoridade de workflow, sem ativação automática nem código em claro. |
| command ledger IAM (ou extensão equivalente provada) | instituição, operação, idempotency key, fingerprint, estado, resultado e referências ao alvo/Intent. | Retry seguro e prevenção de dupla mutação. |
| `iam_membership_events` | instituição, Membership/Intent alvo, ator, ação, estado anterior/novo, resultado, códigos mínimos, request/correlation ID e timestamp; índices tenant/target/timeline. | Facto IAM transacional separado de observability. |
| `memberships` extensão mínima | `version`, unicidade parcial ativa Person×Institution e índice do conjunto admin ativo; papel da própria Membership, nunca `users.role`. | Stale detection, papel único ativo e guarda do último administrador. |

## CP2 — migration, integridade e testes (sem SQL)

| Item CP2 | Resultado | Facto, decisão ou bloqueio |
|---|---|---|
| 1. Schema, chaves, índices e migrations Membership | PASS | AS-01: `0001` é a única migration que cria/altera Membership; role/status são `NOT NULL` com checks, FKs são `RESTRICT`, unicidade é Person×Institution×Role e o índice `active` não é único. Runner transacional/checksum confirmado. |
| 2. Uma Membership ativa por Person+Institution | PASS | Índice único parcial `(person_id,institution_id) WHERE status='active'` aplicado e testado; CP4 não tinha Memberships/duplicados. Alvo futuro com dados continua a exigir preflight/reconciliação sem auto-correção. |
| 3. Papel único sem `users.role` | PASS (schema) | A Membership ativa única tem `role NOT NULL`; `users` continua fenced/sem autoridade. O comando `ChangeMembershipRole` é CP4 posterior. |
| 4. `iam_access_intents` mínimo | PASS | Estrutura aplicada com hash, TTL 72h, consumo, contador/bloqueio, rotação, idempotência/fingerprint e timestamps; teste de TTL PASS. |
| 5. Command ledger/retry | PASS | Ledger tenant-scoped e unicidade de idempotência aplicados; teste de colisão de chave PASS. |
| 6. Evento IAM factual/transacional | PASS (schema) | Evento tenant-scoped e trigger de imutabilidade aplicados; teste de alteração rejeitada PASS. |
| 7. Lock/versão e último admin | PASS (desenho) | `FOR UPDATE` do alvo e conjunto de admins ativos, ordem estável, recontagem pós-lock e `version`; primeiro admin é bootstrap backend/PostgreSQL auditado. |
| 8. Constraints, índices, FKs e rollback | PASS | Checks, FKs `RESTRICT`, referências compostas tenant-safe e índice parcial aplicados; runner/isolated test comprovam comportamento transacional. Recovery pós-commit exige migration corretiva, nunca down destrutivo. |
| 9. Duplicados/ambiguidade | PASS (CP4 vazio) | Safety gate CP4 PASS e transação `READ ONLY` concluída. `memberships` tem zero linhas; grupos duplicados `active`/não terminais e incompatibilidades de timestamps/papel foram zero. A migration continua a falhar fechada e exige preflight/reconciliação humana em qualquer alvo futuro com dados. |
| 10. Plano PostgreSQL de testes | PASS | `test:migrations:isolated`, teste IAM PostgreSQL, schema verifier, lint e contexto institucional PASS. |

### Matriz de constraints e testes CP2

| Proteção | Prova PostgreSQL exigida | Estado |
|---|---|---|
| índice único ativo Person×Institution | segunda Membership `active` no mesmo par falha; migration e schema verifier confirmam índice | PASS |
| papel único ativo | tentativa de papel paralelo `active` falha; `users.role` não participa no schema IAM | PASS (schema) |
| Intent/código | hash e TTL 72h; expiração diferente falha no teste | PASS (schema) |
| Intent/ledger idempotente | colisão de chave no mesmo escopo falha; producer/retry funcional é CP3 | PASS (schema) |
| tenant integrity A→B | FK composta rejeita referência A em B | PASS |
| concorrência/versionamento | `version` e constraints existem; comandos concorrentes são CP4 | PASS (schema) |
| último administrador | lock/guarda exigidos pelo contrato; comando é CP4 | PASS (DoR) |
| migration/recovery | runner, ledger/checksum e chain isolada PASS; sem down destrutivo | PASS |

## Autoridades e dependências

| Autoridade | Regra aplicável | Estado |
|---|---|---|
| Firebase | Autentica UID global; não cria contexto nem papel institucional. | PASS — ADR-001 e AS-03. |
| PostgreSQL Identity/Person/Membership | Dono de ligação de identidade, contexto e acesso institucional. | PASS como fundação; mutações IAM ainda inexistentes. |
| Contexto institucional | Apenas Membership/instituição ativa no backend; seleção é restrita ao conjunto ativo. | PASS — AS-02/03/07. |
| Legacy `users` | Não pode voltar a ser fonte de acesso; criação/administração cercadas. | PASS para fence; REPLACE pendente em IAM-01. |
| Audit | Factual, ator/instituição/alvo/resultado; sem inventar evento de negócio. | PASS como contrato FND-05; produtor IAM específico é pendente. |
| Foundation | FND-02/03/05 DONE e cercos/tenancy/audit aplicáveis preservados. | PASS. |
| Produto IAM | Política v3: papel único ativo, código opaco com hash, 72h/5 tentativas/15min/rotação, bootstrap administrativo auditado, pending explícito e respostas genéricas. | PASS. |

## Checkpoints de preparação/implementação futura

| CP | Objetivo | Áreas permitidas após READY | Prova/stop rule |
|---|---|---|---|
| CP0 | Congelar base, revalidar caller graph, cercos, audit e schema. | Concluído somente leitura. | PASS; migration/audit IAM seguem para CP1/CP2. |
| CP1 | Definir policy pura e command contract: atores, papéis, máquina de estados e erros não divulgadores. | Concluído documentalmente; não autoriza módulo/código. | PASS; v2 resolve D-07/D-08. |
| CP2 | Schema aditivo mínimo para intenção convite/pedido/idempotência/audit/versionamento. | Migration nova, schema e testes PostgreSQL. | PASS: `0019` persistida no CP4, verificada e testada. |
| CP3 | Provisão/pedido/resolução Identity→Person com transação e idempotência. | Serviço/repositório/controller IAM canónicos. | Stop em criação automática de Membership ativa ou identidade ambígua. |
| CP4 | Aprovação/ativação, alteração de papel, suspensão/revogação e efeitos imediatos de contexto. | Commands/policy/middleware regressions. | Stop se invalidar contexto não puder ser provado na próxima requisição. |
| CP5 | Audit factual, API e UX mínima. | Audit IAM, rotas canónicas, UI estritamente necessária. | Stop se o comando exigir integração externa não autorizada; e-mail está fora do scope. |
| CP6 | Matriz completa, PostgreSQL A/B, concorrência, regressão, CI, visual/manual e DoD. | Apenas correções dentro do scope. | Nenhum AC FAIL/BLOCKED/NOT RUN para DONE. |

## Matriz AC → evidência

| ID | Critério | Evidência exigida | Estado | Referência |
|---|---|---|---|---|
| AC01 | cadeia canónica sem `users` como autoridade | E03, E05, E08, E12 | NOT RUN | AS-01–06 |
| AC02 | provisão/pedido não ativa automaticamente | E03, E07, E08, E12, E16 | NOT RUN | Política IAM-01 v1 |
| AC03 | gestão apenas por ator aprovado mesma instituição | E03, E05, E06, E12 | NOT RUN | Política IAM-01 v1 |
| AC04 | client role/ID/institution sem autoridade; A→B deny | E05, E06, E12 | NOT RUN | ADR-001, AS-02/03 |
| AC05 | transições Membership válidas e inválidas | E03, E07, E08, E12 | NOT RUN | Política IAM-01 v1 |
| AC06 | suspensão/revogação bloqueia novo acesso/contexto | E03, E05, E06, E07, E12 | NOT RUN | AS-02/03 |
| AC07 | retry/concorrência sem duplicado/parcial | E03, E07, E08, E16, E17 | NOT RUN | Política IAM-01 v1 |
| AC08 | audit factual minimizado | E03, E05, E06, E08, E11, E12 | NOT RUN | FND-05 |
| AC09 | cercos legacy preservados | E03, E05, E07, E12 | NOT RUN | AS-04/05/08 |
| AC10 | UX não simula acesso/entrega | E09, E10, E12 | NOT RUN | Política IAM-01 v1 |

## DoR

| Item DoR | Estado | Evidência / lacuna |
|---|---|---|
| Identificador, problema, valor, prioridade e scope | PASS | `IAM-01.md`. |
| Ordem/dependência Foundation → IAM → Enrollment | PASS | Roadmap; Foundation concluída em `PROJECT_STATE`. |
| Produto, autoridade, ciclo de vida e identidade | PASS | Políticas IAM-01 v1–v3. |
| Multiplicidade de papéis e referência/entrega de Intent | PASS | V2 fixa uma Membership/papel ativo e código opaco com hash, entregue fora do Nexus. |
| AS-IS e caminhos legacy/canónicos | PASS | AS-01…AS-09; caller graph deve ser repetido no CP0. |
| Critérios, negativos, tenancy, transaction/idempotency e rollback | PASS (planeado) | AC matrix e checkpoints; execução ainda NOT RUN. |
| Plano PostgreSQL/migration | PASS | `0019` e verificadores/testes CP4 PASS. |
| Plano audit/privacidade | PASS (schema/contrato) | Evento IAM imutável/minimizado aplicado; produtor é implementação CP3–CP6. |
| Plano UX/visual | PASS (planeado) | AC10; implementação/evidência NOT RUN. |
| Conflitos canónicos | PASS | Nenhum conflito resolvido por conveniência; lacunas convertidas em decisões. |

**Resultado DoR:** `READY`. Política, AS-IS, constraints, migration CP4, verificadores, testes e recovery estão provados. A prontidão não equivale a comandos IAM implementados; estes exigem autorização de CP3 em diante.

## Riscos

| Nível | Risco | Mitigação/gate |
|---|---|---|
| P0 | Escalação de privilégio por role/instituição do browser, Firebase claim ou `users` legado. | Contexto backend, policy, A/B/ID tampering e cercos legacy. |
| P0 | Convite/pedido cria acesso ativo sem decisão humana/autorizada. | Política v1, estado `pending`, transição explícita, transaction/audit. |
| P0 | Suspensão/revogação não bloqueia novo acesso institucional. | Re-resolução por requisição, testes de contexto/WebSocket e sem cache autorizador. |
| P1 | Duplicação/estado parcial por retry ou concorrência, inclusive múltiplos admins. | Idempotency, constraints, lock/version, preflight, rollback e E16/E17. |
| P1 | Código opaco enumerado, reutilizado ou exposto. | Hash persistido, 72h, cinco tentativas/15min, rotação, consumo, resposta genérica e nenhuma escrita do código em logs. |
| P1 | Audit atribui aprovador/instituição errados ou expõe dados/segredos. | FND-05, campos mínimos, testes de tamper/redaction. |
| P2 | UX afirma convite/e-mail/acesso antes de confirmação real. | E09/E10 e product truth. |
| P3 | Compatibilidade temporária `institution_admin → admin` mascara dependências legacy. | Inventário CP0 e regressões FND-02/03; não ampliar. |

## Próximo micro-gate recomendado

**Próximo micro-gate:** autorização explícita para CP3 — provisão/pedido/resolução Identity→Person com transação, idempotência e produtor factual. Qualquer ambiente futuro com dados requer preflight agregado próprio antes de migration.

## Addendum de recuperação IAM-01

| Checkpoint | Resultado | Evidência executada |
|---|---|---|
| CP2 — migration/integridade | PASS | `tests/iam-membership-integrity-postgres.test.ts` passou no alvo PostgreSQL descartável aprovado; prova unicidade ativa, TTL, idempotência, isolamento tenant e imutabilidade de eventos. |
| CP3 — command core/audit | PASS | `tests/iam-command-policy.test.ts`, `tests/iam-command-service.test.ts`, `tests/iam-command-postgres.test.ts` e `tests/iam-audit-postgres.test.ts` passaram. |
| CP3.1 — mutações HTTP | PASS | `tests/iam-http-adapter.test.ts` e `tests/iam-http-controller.test.ts` passaram para grant, alteração de papel e revogação. |
| CP3.2 — Express/auth/context | PASS | `tests/iam-http-operational.test.ts` passou com listener loopback, `requireAuth`, contexto institucional e schema PostgreSQL isolado. |
| IAM-UX-02 — leitura Membership | PASS | `tests/iam-read-api.test.ts` e `tests/iam-read-postgres.test.ts` passaram; a resposta é institution-scoped, requer `institution_admin`, aceita somente filtros autorizados/cursor e devolve apenas display seguro da Person. |

O finding de recuperação de `person.id` no read model foi corrigido antes do commit: as ações referenciam `membership.id`; a projeção pública de Person contém apenas `displayName`.
