# ENROLLMENT-02 — Canonical Process Authority & Atomic Activation

**Estado:** READY — ENROLLMENT-02.

**Tipo:** hardening arquitetural de Enrollment. Este Mission Pack autoriza planeamento e provas de readiness; não autoriza implementação até receber instrução explícita.

## Objetivo

Garantir que uma matrícula só é `active` quando uma operação canónica, autorizada e transacional confirma todos os invariantes e ativa, no mesmo commit, a relação institucional `StudentProfile`. Na mesma missão, fechar a autoridade do processo administrativo: assignment só para papéis permitidos, audit separa ação humana de reconciliação sistémica e `last_progress_at` passa a ter semântica operacional determinística.

Em linguagem operacional: mudar um texto de estado não cria um aluno ativo; uma Membership ativa por si só não recebe trabalho sensível; uma pessoa que lê uma página não pode aparecer como autora de uma ação automática.

## Autoridade, baseline e AS-IS confirmado

- Baseline: `main @ 445e93b7bcf55c891b811f262ab4cd572a5bc393`; IAM, AUTH-CSP e ENROLLMENT-01 estão integrados.
- O roadmap vNext, Parte 3, manda fechar findings de processo/audit/assignment e preservar state machine, snapshots, contrato de ficheiro físico e ativação atómica antes de Academic Core e Student 360.
- A arquitetura vNext, secções 3, 8, 12 e 13, exige InstitutionalContext no servidor, Activation como use case transacional próprio, evento durável para downstream quando relevante e distinção de ator humano/sistema.
- ENROLLMENT-01 fechou exclusivamente segurança de identidade/concurrency de registration; activation, assignment e storage ficaram expressamente fora do seu scope.
- `enrollment.controller.ts` permite hoje `validated → active` no endpoint genérico de transições e grava apenas `status_changed`; não altera `student_profiles` nem produz uma semântica de ativação dedicada.
- `enrollment-intake.ts` cria ou reutiliza `student_profiles` como `inactive`, o que confirma que `active` precisa de um comando posterior que altere ambos os agregados.
- `enrollment-process-api.ts` aceita para assignee qualquer Membership ativa da instituição, sem filtro de papel; numa alteração de fingerprint durante `GET`, grava `process_reconciled` usando a pessoa leitora como `actor_person_id` e atualiza `last_progress_at`.
- `enrollment_events.actor_person_id` é `NOT NULL`; não há `actor_kind`, `correlation_id`, lifecycle version de Enrollment ou ledger de idempotência para activation. `registration_version` protege registration e `enrollment_processes.version` protege process/assignment; nenhum deles é authority suficiente para lifecycle activation.

## Scope

### IN

- `ActivateEnrollment` como comando/endpoint dedicado.
- Bloqueio explícito de `targetState = active` no endpoint/state machine genérico.
- Ativação atómica de Enrollment + StudentProfile, com expected version, locks, idempotência e rollback.
- Política explícita de assignment para quem atribui e quem pode ser atribuído.
- Modelo factual de audit humano/sistema e estratégia de reconciliação.
- Semântica de `last_progress_at` e testes PostgreSQL/HTTP/tenant/concurrency associados.

### OUT

- Physical object storage, upload/download e evolução do contrato de ficheiro físico; este continua uma missão Documents/Enrollment própria e não pode ser falsificado por `evidence_reference`.
- Finance, capacity/vagas, Academic Core, Student 360, custom roles, redesign UI e limpeza geral de legado.
- Alterar Person Resolution, IAM ou as garantias de ENROLLMENT-01 fora das regressões necessárias.

## Use case canónico: `ActivateEnrollment`

`POST /api/enrollments/:id/activate` é o único contrato capaz de produzir `Enrollment.status = active`. O payload não escolhe institution; a autoridade vem exclusivamente de `InstitutionalContext` resolvido no servidor.

### Autorização

- Permitido: `institution_admin` e `director`, coerente com a autoridade de decisão final hoje usada para `active`.
- Negado: `secretariat`, `financial`, `teacher`, `student`, `parent` e qualquer noção externa de Platform Admin. Platform Admin não é papel institucional canónico e não recebe permissão por omissão.

### Contrato proposto

Payload mínimo:

```json
{
  "expectedLifecycleVersion": 7,
  "expectedRegistrationVersion": 4,
  "idempotencyKey": "uuid-or-canonical-key"
}
```

`idempotencyKey` é obrigatório. Um replay com a mesma chave, mesmo Enrollment/instituição e sem alteração de identidade do comando devolve a representação persistida com `replayed: true`; não cria outro event/outbox. Uma nova chave para uma matrícula já ativa devolve um erro público seguro `ALREADY_ACTIVE`/409, nunca sucesso implícito. Uma chave reutilizada para outro comando ou outro Enrollment falha fechada.

### Boundary transacional e ordem de locks

Dentro de uma única transação PostgreSQL, por ordem estável:

1. autenticar e resolver `InstitutionalContext`; autorizar o papel;
2. validar formato de id, versões e idempotency key, sem consultar outro tenant;
3. procurar/lockar o ledger de idempotência por `institution_id + operation + idempotency_key`; replay concluído termina sem novas escritas;
4. carregar `enrollment_applications` por `id + institution_id FOR UPDATE`; ausência é `NOT_FOUND` seguro;
5. confirmar `status = validated`, `expectedLifecycleVersion` e `expectedRegistrationVersion` antes de qualquer mutação;
6. carregar/lockar `student_profiles` por `institution_id + student_person_id FOR UPDATE`; tem de existir e estar num estado ativável;
7. revalidar os invariantes de readiness atuais no mesmo client: registration completa, policy documental capturada e documentos obrigatórios verificados, academic year/oferta existentes e consistentes com a instituição;
8. marcar a Enrollment `active`, incrementar lifecycle version e preservar a version de registration; marcar StudentProfile `active` na mesma transação;
9. gravar event/audit factual `enrollment_activated` sem PII, o ledger concluído e, se a arquitetura de outbox existente for a autoridade aplicável, um único handoff event durável para consumidores downstream;
10. `COMMIT`.

Qualquer falha de autorização, readiness, stale version, profile, constraint, audit, ledger ou event executa `ROLLBACK`. Não existe `active` parcial, StudentProfile parcial, ledger concluído ou evento de sucesso isolado.

### Invariantes classificados

| Facto atual | Classificação para activation | Fundamentação |
| --- | --- | --- |
| Enrollment pertence à institution atual e está `validated` | Hard invariant | Estado e tenant são a authority da transição. |
| `expectedLifecycleVersion` e `expectedRegistrationVersion` atuais | Hard invariant | Evita ativar uma representação/processo que mudou entretanto. |
| Registration completa pela policy atual | Hard invariant | Já bloqueia `validated`; deve ser revalidada no comando que produz `active`. |
| Policy documental capturada e documentos obrigatórios verificados | Hard invariant | O controller atual já trata isto como gate de validação; activation não pode relaxá-lo. |
| StudentProfile institucional existente e ativável | Hard invariant | Intake cria-o `inactive`; activation deve sincronizá-lo, não inventar relação. |
| academic year e oferta da mesma instituição, ainda válidos | Hard invariant | Impede ativação contra contexto académico inexistente/inconsistente. |
| Ativação anterior | Hard invariant | Só replay idempotente da mesma chave é aceite; não há efeito duplicado. |
| Finance, capacity/vagas, turma, disciplinas, Student 360 | Future/downstream concern | Não são authority atual de Enrollment e não entram nesta missão. |
| Upload/download de ficheiro físico | Future dependency | O snapshot e estados documentais atuais são gate lógico; o contrato de objeto físico é missão própria. |

### Concurrency e erros públicos

- Dois comandos simultâneos lockam Enrollment antes de StudentProfile. Só o primeiro pode concluir; o segundo observa `active`, ledger replay ou divergência e nunca duplica eventos.
- Registration, documento, assignment/reconciliation ou transition concorrentes devem atualizar a lifecycle authority definida nesta missão quando alterarem um facto de activation; o comando stale responde `409 STALE_VERSION`.
- `409 STALE_VERSION` devolve somente código estável e mensagem segura: `A matrícula foi alterada entretanto. Recarregue e reveja antes de ativar.` Sem SQL, stack, IDs externos, PII ou retry automático.
- Cliente: `409 → refresh autoritativo → decisão humana explícita`; nunca substitui versão nem reenvia sozinho.

## Endpoint e state machine genéricos

O endpoint genérico de transições deve rejeitar `targetState = active` antes de qualquer write com `409 ACTIVE_REQUIRES_CANONICAL_ACTIVATION` e mensagem pública segura. A policy genérica deixa de listar `active` como destino. Permanecem permitidas, sob a policy atual, `draft → under_review → awaiting_documents → validated` e as transições de bloqueio/cancelamento já autorizadas. Somente `ActivateEnrollment` escreve `active`.

## Assignment policy

Papéis institucionais canónicos verificados: `institution_admin`, `director`, `secretariat`, `financial`, `teacher`, `student`, `parent`. A matriz abaixo é uma decisão explícita para a missão; não decorre da mera existência de Membership.

| Papel | Pode atribuir/revogar atribuição? | Pode receber assignment? | Motivo |
| --- | ---: | ---: | --- |
| `institution_admin` | Sim | Sim | Responsabilidade institucional plena. |
| `director` | Sim | Sim | Liderança e decisão operacional. |
| `secretariat` | Sim | Sim | Operação administrativa de Enrollment. |
| `financial` | Não | Não | Finance está fora da authority/processo desta missão. |
| `teacher` | Não | Não | Não é proprietário administrativo de Enrollment. |
| `student` | Não | Não | Sem papel administrativo. |
| `parent` | Não | Não | Sem papel administrativo. |

O comando exige: InstitutionalContext autorizado para o ator; assignee existente; Membership ativa **na mesma institution** e com papel elegível; lock da Application e do Process; `expectedVersion`; e resposta `INVALID_ASSIGNEE`/`FORBIDDEN` segura sem revelar Membership de outro tenant. O payload nunca fornece authority de instituição. `platform_admin` não é acrescentado nem reconhecido neste contrato.

## Audit, reconciliação e progresso

### Modelo mínimo de evento

`enrollment_events` precisa suportar, por migration aditiva, pelo menos:

- `actor_kind`: `human | system`;
- `actor_person_id`: obrigatório apenas para `human`, nulo para `system`;
- `operation`/event type estável;
- `institution_id` e `enrollment_application_id` existentes;
- `correlation_id`/request ID opcional, fornecido pelo servidor quando disponível;
- `metadata` minimizada, sem nomes, contactos, documentos ou payloads PII.

Resultado e causa distinguem sucesso, rejeição, conflito e reconciliação; um conflito jamais é apresentado como sucesso.

### Estratégias avaliadas para reconciliação

| Opção | Vantagem | Risco | Decisão |
| --- | --- | --- | --- |
| A. Remover toda escrita de leitura | Queries tornam-se puras e evitam lock/write inesperado | Exige ponto explícito para materializar a projeção e pode deixar dados derivados temporariamente desatualizados | Não escolher como primeira alteração sem prova de que todos os produtores publicam projeção. |
| B. Reconciliação explícita como ação de sistema | Mantém consistência da projeção atual, mas torna side effect, actor e causa verificáveis | Continua a exigir transação e não pode ser disparada silenciosamente pelo browser | **Recomendado.** Extrair para comando/worker/handler explícito com `actor_kind=system`, `system_cause` e idempotência por fingerprint. |

O `GET process` deve ser uma leitura sem side effect humano; se a materialização ainda for necessária no ciclo atual, ela ocorre por invocação explícita de sistema, nunca usando o leitor como ator.

### Semântica de `last_progress_at`

Atualizam `last_progress_at`:

- criação do processo/intake;
- transition efetiva de Enrollment que altera fase operacional;
- alteração documental efetiva que muda a readiness/process stage;
- assignment ou unassignment efetiva;
- ação/nota operacional futura quando for modelada explicitamente como workflow progress;
- `ActivateEnrollment` concluído.

Não atualizam `last_progress_at`:

- plain read;
- replay idempotente sem nova mudança;
- cálculo de projeção sem alteração de facto;
- reconciliação de fingerprint que apenas corrige/materializa derivação;
- tentativa rejeitada, stale ou conflito.

`updated_at` continua a representar alteração técnica da linha; não substitui a semântica de progresso.

## Migration decision

**Migration aditiva necessária, próxima numeração canónica.** Não reescrever migrations anteriores nem aplicar runtime DDL.

O preflight de implementação deve confirmar o ledger/capacidade de outbox já existente antes de escolher tabela final. A migration deve introduzir, no mínimo:

1. lifecycle version monotónica de `enrollment_applications`, `NOT NULL`, default seguro, `CHECK (> 0)` e backfill forward-only;
2. ledger de idempotência de activation com unicidade institucional/operação/chave, estado e resultado mínimo sem PII;
3. `actor_kind`, nulabilidade condicional de `actor_person_id`, `correlation_id` e constraints de consistência em `enrollment_events`;
4. qualquer FK/índice necessário para locks, lookup de ledger e event ordering.

Plano de rollback: migration forward-only preserva linhas/eventos existentes como `human`; a aplicação nova só depende das colunas após a migration estar presente. Rollback operacional é deploy da aplicação anterior compatível, não `DROP` destrutivo. Testes de migration isolada devem provar upgrade a partir do ledger canónico e constraints.

## Critérios de aceitação

1. **AC01:** endpoint genérico não produz `active`; devolve erro seguro estável.
2. **AC02:** apenas `ActivateEnrollment` produz Enrollment `active`.
3. **AC03:** Enrollment e StudentProfile passam a `active` atomicamente.
4. **AC04:** falha intermédia, incluindo update de StudentProfile/audit/outbox, faz rollback integral.
5. **AC05:** ativação dupla/concorrente não duplica estado, event, ledger ou downstream handoff.
6. **AC06:** versão stale produz `409 STALE_VERSION`, sem auto-retry.
7. **AC07:** assignment rejeita ator ou assignee com papel não permitido.
8. **AC08:** assignment cross-tenant, Membership inativa e alvo inexistente falham fechados, sem leakage.
9. **AC09:** reconciliação automática é auditada como `system`, nunca como pessoa leitora; plain read não cria falso evento humano.
10. **AC10:** `last_progress_at` muda exclusivamente nos eventos de progresso definidos e não em read/reconciliação/replay.
11. **AC11:** audit de activation/assignment contém institution, operação, actor factual/cause sistémica, resultado e correlation/request ID quando disponível, sem PII desnecessária.
12. **AC12:** snapshots/document gates, intake idempotency, state machine e garantias ENROLLMENT-01 não regressam.

## Matriz mínima de testes

| Área | Provas obrigatórias |
| --- | --- |
| PostgreSQL activation | sucesso; wrong state; profile inexistente/inativável; stale lifecycle/registration; falha após update de profile; dois comandos A/B concorrentes; replay da mesma key; key diferente após active; ausência de duplicate event/handoff. |
| HTTP operational | route Express completa `auth → InstitutionalContext → controller → service → PostgreSQL → mapper`; 200/201 de sucesso; 409 stale; 409 generic-active; body seguro sem stack/SQL/PII/IDs externos; caller não faz auto-retry. |
| Assignment | ator permitido; ator proibido; assignee permitido; assignee proibido; Membership inativa; inexistente; A→B; stale expectedVersion; audit factual. |
| Audit/reconciliation | comando humano com actor humano; reconciliação `system` com causa; plain read sem event humano; metadados minimizados; conflitos/rejeições não criam sucesso. |
| Progress | transition/document/assignment/activation atualizam conforme regra; reconciliation/read/replay não atualizam; `updated_at` não é usado como sinónimo. |
| Regressões | ENROLLMENT-01 registration/identity concurrency; intake idempotency; documents/snapshots; process projection; tenant/context; IAM/context; migration isolation; lint/build/secret scan/diff check/quality gate. |

## Riscos e stop conditions

- Se não existir primitiva de outbox reutilizável, a missão pode introduzir apenas o ledger/evento durável mínimo, mas não uma arquitetura paralela de mensageria; a decisão deve ser documentada antes do código.
- Se a matriz de papéis receber objeção de produto/operacional, parar antes de implementação: não expandir `teacher`, `financial` ou Platform Admin por conveniência.
- Se a migration de actor factual não conseguir preservar eventos humanos históricos sem perda, parar para decisão de compatibilidade.
- Physical-file contract mantém-se fora do scope: não transformar `evidence_reference` em pretensa prova de upload.

## Contrato downstream de handoff

Depois desta missão, `Enrollment.status = active` significa exatamente: a ativação canónica foi autorizada e concluída, a Enrollment e o StudentProfile da mesma instituição foram persistidos como ativos no mesmo commit, o event/audit factual foi gravado e o handoff durável previsto foi registado uma única vez. Academic Core e Student 360 poderão confiar nesse facto; não receberão autorização para criar ou simular a ativação.

## Definition of Ready

**READY — ENROLLMENT-02.** Estão definidos activation invariants, boundary transacional, expected versions, idempotência, concorrência, matriz de assignment, modelo human/system audit, estratégia de reconciliação, semântica de progresso, decisão de migration, ACs e matriz de testes. A implementação exige autorização explícita e começa por migration/testes de falha, nunca pelo endpoint/UI.
