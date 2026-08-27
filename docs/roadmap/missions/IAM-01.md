# IAM-01 — Ciclo de Acesso Institucional

**State:** RECOVERED AND PROVEN — a implementação não commitada foi recuperada sobre `8c0a0239a0786c2561ef1ef94e1fb869555bf714` para `codex/iam-01-recovered`, incluindo migration, command core, audit factual, rotas HTTP e read API. Os testes IAM direcionados passaram no PostgreSQL local descartável autorizado. Isto não autoriza UI, deploy, alteração de configuração Firebase ou merge automático.

## Problema, valor e prioridade

Uma identidade Firebase autenticada não é, por si só, uma pessoa autorizada a atuar numa instituição. O sistema precisa de um ciclo institucional verificável para provisão, pedido de acesso, aprovação, ativação, suspensão, revogação e alteração de papel, sem restaurar a autoridade legada de `users` nem aceitar instituição/papel fornecidos pelo browser.

**Valor:** controlo operacional seguro de acesso institucional, redução de contas inutilizáveis e rastreabilidade factual das decisões.

**Prioridade:** P0. Esta é a primeira missão da tranche IAM, anterior ao hardening de Enrollment/08B.

## Rastreabilidade canónica

- Produto: `docs/product/NEXUS_MASTER_PLAN_V2.md` — `Identity & Access → Institution → Enrollment`; backend como autoridade e uma Pessoa com uma história.
- Arquitetura: `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` §§ 4–6 — Identity/IAM possui identidade, login binding e Membership; Authentication e Membership são distintos; Person Resolution é fail-closed.
- ADR: `docs/architecture/ADR-001-institutional-context.md` — Firebase prova identidade; o backend resolve `Identity → Person → Membership → Institution`; sem Membership ativa não há contexto institucional.
- Audit: `AUD-IAM-001`, `AUD-IAM-002`, `AUD-IAM-003` em `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` — criação legada não cria a cadeia canónica, request-access pode ficar sem saída e estados de `users`/Membership competem.
- Replacement map: `docs/audit/LEGACY_REPLACEMENT_MAP.md` — `users` role/status administration é `REPLACE` por Person + Identity + Membership + onboarding/provisioning explícito.
- Roadmap: `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` §7 — IAM sucede Foundation e precede Enrollment hardening.
- Foundation: FND-02 preserva Person/Identity/Membership e cerca administração legada; FND-03 exige contexto derivado no servidor e falha fechada; FND-05 exige audit factual, ator correto e instituição correta.

## Objetivo humano

Permitir que cada instituição controle, de forma segura e auditável, quem pode entrar, que papel possui e quando fica ativo, suspenso ou revogado — sem permitir que Firebase Identity, browser ou rotas legacy atribuam instituição, papel ou privilégios.

## Invariantes não negociáveis

1. Firebase autentica uma identidade global; não concede papel institucional.
2. PostgreSQL é a autoridade para Person, Identity, Institution, Membership e estado de acesso institucional.
3. O papel pertence à Membership, nunca ao browser, token Firebase nem identidade global.
4. O contexto institucional é resolvido no backend a partir de Membership ativa; um ID de instituição enviado pelo cliente apenas pode selecionar uma Membership já autorizada.
5. Signup, convite, pedido de acesso e login nunca criam uma Membership ativa automaticamente.
6. Uma Person pode possuir Memberships/papéis distintos em instituições distintas; não existe “papel global” institucional.
7. Suspensão ou revogação impede imediatamente nova resolução de contexto e novos acessos institucionais.
8. Cada mutação crítica produz evidência factual com ator, instituição, alvo, ação e resultado; rejeições não podem ser apresentadas como sucesso.
9. ID manipulado, papel manipulado e instituição estrangeira falham fechados e sem revelar dados de outro tenant.
10. Nenhuma rota legacy é reativada sem autoridade canónica, tratamento explícito e testes de regressão.

## AS-IS verificado (somente evidência)

| Área | Estado observado | Consequência IAM-01 |
|---|---|---|
| Modelo vNext | `0001_vnext_identity_membership.sql` cria a base Person/Identity/Membership. `0019_iam_access_integrity.sql`, aplicada uma vez no CP4 local descartável, acrescenta `memberships.version`, unicidade parcial ativa Person × Institution, Intent, ledger e eventos IAM imutáveis. A busca CP0 não encontrou mutação atual de `memberships` no código. | Preservar; a implementação posterior usa esta base e nunca muta migrations aplicadas. |
| Resolução de contexto | `src/auth/institutional-context.ts` só lê Memberships `active` de instituição ativa; sem Membership devolve `missing_membership`; múltiplas instituições exigem seleção validada. | É a autoridade de acesso a preservar e a regressar. |
| Middleware | `src/middleware/auth.ts` verifica Firebase token e resolve contexto no PostgreSQL; traduz Membership ausente em 403, seleção necessária em 409 e instituição não autorizada em 403. | Suspensão/revogação deve permanecer eficaz neste ponto em novas requisições. |
| Compatibilidade legada | O middleware mapeia temporariamente `institution_admin` para `admin` apenas para endpoints legacy; `users` ainda existe em `0017_fnd01_legacy_compatibility_schema.sql` e `src/db/users.ts` contém helper legado de create/update por Firebase UID. | Não usar `users.role`/`users.status` como autoridade; mapear e remover dependências por capability, sem reativar escrita. |
| Cercos Foundation | `POST /api/profile/request-access` e `POST /api/profile/role` respondem 503 `CANONICAL_TENANT_AUTHORITY_REQUIRED`; POST/PUT/DELETE `/api/users` respondem 503 `CANONICAL_IAM_PROVISIONING_REQUIRED` antes de persistir. | Estes cercos são regressões obrigatórias; IAM-01 não delega para o código morto após o `return`. |
| Auditoria existente | FND-05 preserva eventos factuais por domínio e request observability minimizada; `/api/logs` legado está cercado. | IAM deve definir o seu próprio produtor factual e não usar apresentação/observability como substituto de audit de decisão. |

O inventário detalhado de rotas/caminhos, chamadas e tabela está em `IAM-01_DOR_EVIDENCE.md`. A busca estática não encontrou consumidor ativo de `getOrCreateUser` fora da sua própria definição; isto deve ser revalidado antes de qualquer alteração.

## IN scope

- provisão/convite institucional e o respetivo estado, sem envio ou entrega real de e-mail;
- pedido de acesso institucional;
- resolução Identity → Person para o ciclo IAM, sem criar automaticamente Person/Identity/Membership ativa;
- criação, ativação, suspensão e revogação de Membership;
- atribuição/alteração de papel institucional dentro de uma política aprovada;
- autorização backend para estes comandos e para o acesso resultante;
- eventos/audit factuais de decisões IAM;
- UX futura mínima de administrador institucional, sujeita a evidência visual.

## OUT scope

- password reset, configuração Firebase Auth, SSO empresarial ou troca de conta Firebase;
- Platform Admin completo e administração global entre instituições;
- Enrollment 08B, Finance, Academic/Teachers, Documents gerais, IA e redesign global;
- reativar request-access, role switching ou administração de utilizadores legacy;
- e-mail e entrega real;
- migração destrutiva, reescrita de histórico ou alteração de migrations aplicadas.

## Máquina de estados de Membership

Os estados persistidos existentes são `pending`, `active`, `suspended` e `revoked`. As políticas IAM-01 v1–v3 fixam as transições abaixo; a implementação deve provar a condição de último administrador dentro da transação.

| De | Para | Regra canónica preparada | Estado da decisão |
|---|---|---|---|
| inexistente | `pending` | Pedido autenticado ou convite institucional cria apenas intenção/Membership pending; nunca acesso ativo. | Aprovada; schema/command idempotente ainda por provar. |
| `pending` | `active` | Só `institution_admin` com Membership ativa na mesma instituição ativa o alvo; audit factual obrigatório. | Aprovada. |
| `active` | `suspended` | Só `institution_admin` da mesma instituição; proibido se o alvo for o último `institution_admin` ativo. | Aprovada. |
| `suspended` | `active` | Só `institution_admin` da mesma instituição pode reativar; login nunca reativa. | Aprovada. |
| `pending`/`active`/`suspended` | `revoked` | Só `institution_admin` da mesma instituição; proibido se o alvo for o último `institution_admin` ativo; preserva histórico. | Aprovada. |
| `active` | alteração de papel | Só `institution_admin` da mesma instituição; proibido remover/alterar o papel do último `institution_admin` ativo. | Aprovada. |
| `revoked` | qualquer estado | Terminal; não existe reativação implícita. | Aprovada. |

`institution.status != active` continua a negar contexto, independentemente do estado da Membership.

## Matriz ator → ação aprovada

| Ator/contexto | Pode | Não pode |
|---|---|---|
| Firebase autenticado sem Membership ativa | Autenticar; submeter pedido canónico que cria apenas `pending`, sem revelar existência de instituição/identidade. | Selecionar instituição, criar/ativar Membership, atribuir papel ou obter contexto institucional. |
| Membership `active` não gestora | Usar apenas autorizações do seu próprio papel e instituição. | Alterar a própria Membership/papel, administrar outra pessoa, agir noutra instituição. |
| `institution_admin` ativo na mesma instituição | Criar convite/pedido pending, ativar, suspender, reativar, revogar e atribuir/alterar papéis, respeitando o último administrador. | Assumir poder global, gerir outra instituição, alterar/remover o último administrador ativo ou contornar audit. |
| `director`, `secretariat`, `financial`, `teacher`, `student`, `parent` ativos | Usar apenas autorizações do respetivo domínio. | Criar convite, aprovar pedido, ativar/suspender/reativar/revogar ou atribuir/alterar papel. |
| Browser/token/payload | Pode pedir uma operação e informar uma seleção de contexto já existente. | Ser fonte de pessoa, instituição, papel, estado, aprovador ou resultado de autorização. |
| Rotas/tabela legadas `users` | Permanecem leitura/compatibilidade apenas quando já montadas e autorizadas. | Recuperar escrita ou tornar `role/status` legados autoridade. |

## Regras técnicas preparadas

- Cada comando crítico tem fronteira transacional: verificar contexto/autoridade atual, carregar alvo por `membership_id` **e** `institution_id`, verificar transição e versão/condição, mutar estado e persistir audit factual antes de `COMMIT`.
- Convite/pedido/retry precisa de chave idempotente e constraint/índice que represente a intenção institucional; o pedido não devolve existência de instituição/identidade e o convite não ativa Membership.
- Alterações concorrentes ao mesmo alvo exigem lock ou optimistic version/condição de estado. O resultado deve distinguir sucesso idempotente, conflito e proibição, sem parcialidade.
- Revogação/suspensão não pode depender de cache/browser. A prova deve fazer requisição subsequente e provar ausência de contexto ativo.
- Dados de audit mínimos: `actor_person_id` (ou tipo system quando aplicável), `institution_id`, `membership_id` alvo, ação, estado anterior/novo, resultado, request/correlation ID quando disponível e motivo minimizado. Nunca password, token Firebase, convite secreto ou PII não necessário.

## Critérios de aceitação para implementação futura

- **AC01 — cadeia canónica:** Firebase UID é resolvido para Identity → Person → Membership; nenhum endpoint IAM lê `users.role/status` como autoridade.
- **AC02 — provisão segura:** criação por convite/provisão/pedido nunca produz Membership ativa sem a transição autorizada definida.
- **AC03 — autorização de gestão:** apenas ator/papel aprovado, com Membership ativa na mesma instituição, pode executar cada comando IAM permitido.
- **AC04 — isolamento:** instituição/papel/ID enviados pelo cliente não concedem nem trocam autoridade; A → B falha fechado e não divulga alvo.
- **AC05 — ciclo de vida:** transições aprovadas de `pending`, `active`, `suspended` e `revoked` obedecem à máquina aprovada, inclusive tentativa inválida.
- **AC06 — efeito imediato:** após suspensão/revogação, nova requisição/WebSocket/contexto institucional é recusado antes de qualquer efeito institucional.
- **AC07 — idempotência e concorrência:** convite/pedido repetido e retry devolvem resultado seguro sem Membership duplicada; decisões concorrentes não deixam estado/audit parcial.
- **AC08 — audit factual:** cada decisão crítica tem ator, instituição, alvo, ação, resultado e correlação/minimização corretos; falha/rejeição não aparece como sucesso.
- **AC09 — cercos preservados:** rotas legacy request-access, role switch e escrita `/api/users` permanecem cercadas antes de persistência até substituição canónica aprovada.
- **AC10 — UX operacional:** a futura UI mostra estados pending/active/suspended/revoked, erro/forbidden/conflito/sucesso e não promete envio/ativação sem confirmação real backend.

## PostgreSQL e migrations

O modelo base de `memberships` era insuficiente para provar pedido/convite idempotente, decisão concorrente, último administrador e audit IAM factual. A migration aditiva `0019_iam_access_integrity.sql` foi aplicada uma vez no CP4 local descartável após preflight vazio e criou:

- uma entidade institucional de intenção de acesso (pedido/convite) com estado, instituição, ligação de identidade/pessoa apenas quando provada, idempotency key e metadados mínimos sem segredo em claro;
- versão/condição de concorrência para a decisão de Membership, ou lock transacional equivalente documentado;
- um evento IAM factual, tenant-scoped, para ator, alvo Membership, ação, estado anterior/novo, resultado, motivo minimizado e request/correlation ID;
- índices/constraints para impedir duplicação/retry segundo a intenção institucional e permitir a guarda do último `institution_admin` ativo dentro da mesma transação.

O CP4 confirmou `memberships.version`, o índice único parcial ativo, as três tabelas IAM, FKs/constraints tenant-safe e o trigger de imutabilidade. O teste PostgreSQL comprovou unicidade ativa, TTL 72h, idempotência, isolamento A→B e imutabilidade; os comandos que os usam ainda não existem. Firebase UID liga-se uma única vez à Identity canónica; colisão ou ambiguidade exige revisão humana e falha fechada.

Qualquer schema change precisa de preflight PostgreSQL, migration-only bootstrap, checksum/ledger, rollback e testes de isolamento A/B. Nunca alterar `0001` ou `0017` aplicadas.

## UX futura e evidência visual

A superfície futura deve ser institucional e contextual: administrador autorizado vê apenas Memberships da sua instituição, estado e ação permitida; a pessoa sem Membership vê estado pendente/indisponível factual, não uma promessa de acesso. A UI não calcula permissão, não mostra dados cross-tenant e não representa e-mail como enviado sem prova de entrega.

E09/E10 futuros: desktop/tablet/mobile; loading, empty, pending, active, suspended, revoked, forbidden, conflict e confirmed; fluxo administrador e conta sem Membership em instituições A/B.

## Política IAM-01 aprovada (v1–v3)

- Só `institution_admin` ativo gere acesso na própria instituição.
- O último `institution_admin` ativo não perde papel, não é suspenso e não é revogado.
- Pedido autenticado cria apenas estado `pending` e não revela existência de instituição/identidade.
- Convite nunca ativa Membership automaticamente; só `institution_admin` ativa Membership.
- Só `institution_admin` atribui/altera papéis no âmbito da própria instituição.
- `suspended` pode ser reativado; `revoked` é terminal e preserva histórico.
- Firebase UID liga-se uma única vez; colisão/ambiguidade exige revisão humana.
- E-mail/entrega real não é requisito IAM-01.
- Toda mutação IAM crítica exige audit factual e minimizado.
- Uma Person tem no máximo uma Membership `active` por instituição; cada Membership `active` tem exatamente um papel institucional ativo. Papéis paralelos na mesma instituição ficam fora de IAM-01.
- Dados existentes ambíguos nunca são corrigidos automaticamente.
- Pedido e convite usam código opaco de alta entropia, validade curta e apenas o respetivo hash persistido; o código é entregue fora do Nexus, sem alegação de e-mail entregue.
- Pedido autenticado cria apenas Intent/Membership `pending`; respostas são genéricas, as tentativas são limitadas e o código nunca entra em logs.
- A validade do código é 72 horas; após cinco tentativas falhadas fica bloqueado por 15 minutos. A rotação cria código novo e invalida imediatamente o código anterior.
- O primeiro `institution_admin` só pode ser criado por bootstrap administrativo backend/PostgreSQL, transacional e auditado; não é um poder do browser, Firebase ou de uma rota legacy.

A missão está `READY`: o preflight CP4 não encontrou dados a reconciliar; `0019` foi aplicada com checksum/ledger, o schema público e a cadeia isolada passaram, e os testes IAM/contexto passaram. O produtor de audit e os comandos IAM permanecem trabalho de implementação CP3–CP6, não prova ausente de DoR.

## CP1 — contrato canónico de comando e audit

### Separação de autoridades

| Entidade/limite | É autoridade para | Não é autoridade para |
|---|---|---|
| Firebase UID | autenticar uma identidade global | instituição, papel ou ativação institucional |
| Identity → Person | ligação única de UID a Person após resolução humana quando houver colisão/ambiguidade | ativar Membership ou escolher instituição |
| Access Intent | workflow de pedido ou convite, sem efeito de acesso | permissão institucional, papel ativo ou contexto |
| Membership | papel e estado institucional usados por `resolveInstitutionalContext` | autenticar Firebase ou representar convite entregue |
| IAM Membership Event | facto imutável/minimizado da decisão IAM | projeção UI, autorização ou segredo de convite |

`Access Intent` é a única entidade de workflow para os dois iniciadores: `access_request` e `institution_invitation`. Não substitui Membership nem cria uma segunda autoridade de acesso.

### Estados e transições

| Objeto | Estados | Transições permitidas | Nota |
|---|---|---|---|
| Access Intent — pedido | `pending`, `approved`, `cancelled`, `expired` | `pending → approved/cancelled/expired` | `approved` não ativa Membership; a decisão/efeito deve ser auditado. |
| Access Intent — convite | `pending`, `accepted`, `cancelled`, `expired`, `consumed` | `pending → accepted/cancelled/expired`; `accepted → consumed` | `accepted` nunca ativa Membership; código opaco é validado sem ser persistido em claro. |
| Membership | `pending`, `active`, `suspended`, `revoked` | conforme máquina de estados IAM-01 v1 | Só Membership `active` autoriza contexto. |

Estados terminais de Intent não podem regressar a `pending`. `revoked` é terminal para Membership. Um Intent expirado/cancelado/consumido não contém nem expõe um segredo em claro.

### Matriz de comandos backend

| Comando | Ator autorizado / contexto | Pré-condições e transação | Resultado e falha fechada | Audit factual |
|---|---|---|---|---|
| `RequestInstitutionAccess` | Firebase autenticado; sem contexto institucional exigido. | Cria/reutiliza Intent `access_request:pending` com idempotência; não cria Membership ativa. O destino institucional público/seguro permanece BLOCKED. | Resposta genérica e não enumeradora; nunca devolve existência de instituição, Identity ou Membership. | `IAM_ACCESS_REQUEST_RECORDED` ou resultado de retry, sem dados civis/segredo. |
| `CreateInstitutionInvitation` | `institution_admin` ativo da instituição resolvida no servidor. | Bloquear/validar ator, alvo e política; gerar código opaco de alta entropia, persistir somente hash/expiração e criar Intent `institution_invitation:pending`, nunca Membership ativa. | 403/404 não divulgador fora do tenant; 409 para duplicação/conflito. Entrega ocorre fora do Nexus, sem alegação de entrega. | `IAM_INVITATION_CREATED` com alvo minimizado, nunca o código. |
| `AcceptInstitutionInvitation` | Firebase autenticado; sem confiar em papel/instituição do payload. | Hash do código apresentado, lock do Intent, verificar expiração/consumo/limite de tentativas e ligação UID única; colisão/ambiguidade vai a revisão humana. | Não ativa Membership; falha genérica igual para código inválido/estrangeiro/expirado/consumido. | `IAM_INVITATION_ACCEPTED` ou rejeição factual minimizada, nunca o código. |
| `ApproveAccessRequest` | `institution_admin` ativo da instituição do Intent. | Lock do Intent; confirmar target institucional e resolução Identity→Person; criar/reutilizar apenas Membership `pending`. | 403/404/409 fail-closed; aprovação nunca vira `active`. | `IAM_ACCESS_REQUEST_APPROVED`. |
| `ActivateMembership` | `institution_admin` ativo da mesma instituição. | Lock Membership e conjunto de admins ativos relevante; `pending → active`; verificar política de papéis. | 409 para transição stale/inválida; sem parcialidade entre Membership e evento. | `IAM_MEMBERSHIP_ACTIVATED`. |
| `SuspendMembership` | `institution_admin` ativo da mesma instituição. | Lock Membership e contagem de `institution_admin` ativos; negar o último administrador. | 403/404/409 sem revelar Membership estrangeira; próxima requisição perde contexto. | `IAM_MEMBERSHIP_SUSPENDED`. |
| `ReactivateMembership` | `institution_admin` ativo da mesma instituição. | Lock; só `suspended → active`; `revoked` não reativa. | 409 para estado inválido/stale. | `IAM_MEMBERSHIP_REACTIVATED`. |
| `RevokeMembership` | `institution_admin` ativo da mesma instituição. | Lock Membership e conjunto admin; negar o último administrador; preservar histórico. | 409 para estado terminal/stale; próxima requisição perde contexto. | `IAM_MEMBERSHIP_REVOKED`. |
| `BootstrapInstitutionAdmin` | Processo administrativo backend/PostgreSQL auditado; não exposto a browser/Firebase nem a rota legacy. | Só para instituição sem `institution_admin` ativo; resolve Identity→Person, cria/ativa a Membership de administrador numa transação e persiste evento factual. | Falha fechada se existir administrador ativo, identidade ambígua ou instituição estrangeira/inativa. | `IAM_INSTITUTION_ADMIN_BOOTSTRAPPED`. |
| `ChangeMembershipRole` | `institution_admin` ativo da mesma instituição. | Lock Membership e conjunto admin; atualiza o único papel da mesma Membership e nega mudança que deixe zero admins ativos. | 409 para versão/estado stale; nunca aceita papel do browser como autoridade. | `IAM_MEMBERSHIP_ROLE_CHANGED`. |

### Idempotência e concorrência

- Todo comando mutador requer `Idempotency-Key` (8–160 caracteres, padrão vNext) com âmbito `institution_id + operation + actor/target/intention` e fingerprint do pedido canónico. Retry igual devolve o resultado lógico já concluído; a mesma chave com fingerprint distinto falha 409.
- O command ledger e a mutação/evidência IAM são gravados na mesma transação. Não há sucesso visual se o evento factual ou a mutação fizer rollback.
- `RequestInstitutionAccess` pode usar referência não autorizadora da instituição, mas a resposta pública é sempre genérica.
- Para ativar/suspender/revogar/alterar papel, a transação bloqueia a Membership alvo e as Memberships `institution_admin:active` da instituição com `FOR UPDATE` (ou mecanismo equivalente provado). Duas ações concorrentes que tentem retirar o último admin: uma pode concluir; a outra recebe conflito/negação, e nunca ficam zero admins ativos.
- `expectedVersion` pode ser exposto para UX/conflito, mas não substitui o lock/conjunto de admins no backend.

### Contrato de audit IAM

FND-05 é reutilizado para os princípios: facto antes de apresentação, ator real, instituição server-side, resultado de commit/rollback, request/correlation ID e minimização. `operational_logs`/request observability não satisfazem o facto IAM durável: é metadata operacional e o leitor legado está fenced.

Cada `iam_membership_event` proposto contém apenas: ID, instituição, Membership/Intent alvo quando existente, tipo de ator (`person`/`system`), ator Person quando aplicável, ação, estado anterior/novo, resultado (`succeeded`/`rejected`/`conflict`), request/correlation ID, motivo/código minimizado e timestamp. Não guarda token de convite, Firebase token, password, e-mail obrigatório, payload bruto ou PII desnecessária. O evento de sucesso é inserido na mesma transação da mudança; rejeições auditáveis seguem a decisão FND-05 e não podem fingir sucesso.

## CP2 — blueprint de migration e integridade (sem SQL)

### Facto AS-IS comprovado

- `0001_vnext_identity_membership.sql` cria `memberships(id, person_id, institution_id, role, status, approved_by, approved_at, suspended_at, revoked_at, created_at, updated_at)`. `role` é `NOT NULL` e limitado aos sete papéis; `status` é `NOT NULL` limitado a `pending/active/suspended/revoked`.
- A única unicidade é `(person_id, institution_id, role)`; logo permite duas Memberships `active` para a mesma Person/instituição se os papéis forem distintos. `memberships_active_context_idx(person_id, institution_id) WHERE status='active'` é índice não único. Nenhuma migration posterior altera esta tabela.
- Não existe versão, Intent, command ledger nem evento IAM; tampouco constraint/trigger que guarde o último `institution_admin`. `resolveInstitutionalContext` só filtra Membership/instituição `active`, pelo que a duplicação ativa não é eliminada pelo schema.
- O runner vNext aplica cada migration nova numa transação e grava checksum em `nexus_schema_migrations`; uma migration já aplicada não pode ser reescrita. O conteúdo real da base de dados não foi lido neste CP e é desconhecido.

### Proposta CP2 — migration aditiva futura

1. Antes de DDL, executar preflight PostgreSQL somente leitura e falhar fechada na migration se existir ambiguidade: mais de uma Membership `active` por `(person_id, institution_id)`, mais de uma Membership não terminal (`pending/active/suspended`) no mesmo par, estado/timestamp incoerente ou papel fora do enum. A migration não atualiza, apaga, funde nem escolhe linhas; reconciliação humana explícita precede nova tentativa.
2. Estender `memberships` com `version integer NOT NULL DEFAULT 1 CHECK (version > 0)` e adicionar unicidade parcial `UNIQUE (person_id, institution_id) WHERE status = 'active'`. A aplicação muda papel por `UPDATE` da Membership alvo, nunca por `users.role`. A eventual substituição da unicidade histórica Person×Institution×Role só pode ocorrer depois do preflight demonstrar que não cria ambiguidade de histórico/retry; não é assumida nesta etapa.
3. Criar `iam_access_intents`: UUID, `institution_id` FK, `kind` (`access_request`/`institution_invitation`), `status`, alvo autorizado `person_id` e/ou `identity_id` apenas quando resolvido, criador minimizado, `code_hash` (nunca código), `code_expires_at` (72 horas), `accepted_at`, `consumed_at`, contagem/janela/bloqueio de tentativas (cinco falhas/15 minutos), `idempotency_key`, `request_fingerprint`, timestamps e versão. Checks obrigam hash/expiração nos fluxos que usam código, expiração futura, consumo único, contadores não negativos e invalidação do hash anterior na rotação; FKs e índices tenant/estado/expiração suportam lookup sem diretório global.
4. Criar command ledger IAM: UUID, `institution_id`, `operation`, `actor_scope`, `idempotency_key`, fingerprint, estado (`pending/completed`), resultado serializável mínimo e referências ao Intent/Membership; `UNIQUE(institution_id, operation, actor_scope, idempotency_key)`. Retry com mesma fingerprint devolve resultado concluído; chave repetida com fingerprint diferente devolve conflito.
5. Criar `iam_membership_events` imutável: UUID, `institution_id`, Membership/Intent alvo quando existir, ator (`person` ou `system`), ação, estado anterior/novo, resultado, código/motivo minimizado, request/correlation ID e timestamp. Inserção do evento de sucesso e mutação pertencem à mesma transação. Este é o produtor FND-05; `operational_logs` não o substitui.
6. Para referências tenant-scoped, adicionar as chaves/índices compostos necessários (por exemplo, `(institution_id,id)` na Membership antes de FKs compostas de eventos/ledger) e FKs `ON DELETE RESTRICT`; cada índice/constraint novo é aditivo e validado no preflight. Não há FK que permita uma referência de instituição A apontar a Membership de B.

### Concorrência, último administrador e rollback

- Cada comando inicia transação, resolve ator/contexto no servidor, faz `FOR UPDATE` da Membership/Intent alvo e bloqueia, por ordem estável de ID, todas as Memberships `active + institution_admin` da instituição. A mutação usa `version` esperada e incrementa-a. Depois do lock, reconta o conjunto resultante: `SuspendMembership`, `RevokeMembership` e `ChangeMembershipRole` rejeitam se deixarem zero administradores ativos. `ActivateMembership` e `ReactivateMembership` também reavaliam a unicidade ativa antes do update.
- Código repetido/expirado/consumido e tentativa acima do limite não revelam a causa; a tentativa válida identificada atualiza contador/bloqueio no mesmo lock. O código em claro não entra em base, evento, log, resposta nem ledger. Rate-limit geral fora do Intent continua a exigir desenho operacional posterior.
- O runner transacional reverte DDL/DML da própria migration se falhar; não há down migration automática nem recuperação por reativação de rotas legacy. Após `COMMIT`, rollback é uma migration corretiva apenas depois de prova e sem apagar audit/histórico.

### Bloqueios remanescentes para READY

- **B-CP2-DB — PASS local CP4:** sob autorização efémera, listener loopback e safety gate CP4 PASS, uma transação PostgreSQL `READ ONLY` terminou com `COMMIT` sem alterações. PostgreSQL 16, schema `public`, tabela `memberships` e as 11 colunas esperadas estão presentes; há uma PK, três FKs, uma unicidade e dois checks, com a unicidade legada Person×Institution×Role confirmada. Há um índice parcial para `active`, mas não é único. A base descartável não contém Memberships: duplicados `active` e não terminais, timestamps incompatíveis e papéis fora do check foram todos zero. Isto prova somente o alvo local vazio; qualquer alvo futuro com dados exige o mesmo preflight agregado e reconciliação humana antes de migration.

Este bloqueio não reabre D-07/D-08 nem D-09/D-10: v2/v3 resolveram papel único ativo, código opaco entregue fora do Nexus, parâmetros de segredo e bootstrap administrativo auditado. Impede `READY`, não altera a máquina Membership nem os cercos legacy.

## Testes e evidência futura

- política/unit: transições e matriz de autorização;
- PostgreSQL: constraints, transaction rollback, idempotência, concorrência e migration isolation;
- API/integration: token válido/inválido, role deny, ID manipulado, seleção de instituição estrangeira, convite/pedido repetido;
- multi-tenant: administrador A não lê/muta Membership B; mesma Person com papéis diferentes A/B;
- suspensão/revogação: nova requisição e WebSocket/contexto negados;
- regressão: `institutional-context`, FND-02 legacy-user fence, FND-03 profile/request-access fence e FND-05 audit contracts;
- E09/E10 manual/visual quando UI for incluída;
- lint/typecheck/build/CI segundo o Mission Pack pronto.

## Rollback e stop rules

Rollback de código não pode restaurar rotas legacy como mecanismo de recuperação. Uma migration nova deve ter recovery documentado e nunca apagar Membership/audit histórico. Parar imediatamente se:

- a identidade alvo, ownership institucional ou ator real não for provado;
- a solução depender de `users.role/status`, Firebase custom claims ou browser como autoridade;
- convite/e-mail exigir credencial/serviço não autorizado;
- suspensão/revogação não puder bloquear nova resolução de contexto;
- a correção exigir Enrollment 08B, Platform Admin global ou reativar rotas legacy.

## Definition of Done

Além de AC01–AC10 PASS: DoR/DoD completo, P0/P1 = 0 salvo exceção formal, migration/postgres evidence quando aplicável, auditoria factual, testes negativos/tenant/concurrency, UI evidence quando incluída, CI, rollback e `PROJECT_STATE` factual atualizado.
