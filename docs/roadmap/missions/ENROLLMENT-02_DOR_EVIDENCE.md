# ENROLLMENT-02 — Definition of Ready Evidence

**Estado:** DONE — ENROLLMENT-02, 2026-08-28.

## Baseline e autoridade consultada

| Fonte | Evidência factual | Estado |
| --- | --- | --- |
| `main @ 445e93b7bcf55c891b811f262ab4cd572a5bc393` | IAM, AUTH-CSP e ENROLLMENT-01 integrados; baseline indicado para esta preparação. | Confirmado |
| `IMPLEMENTATION_PLAN_VNEXT_V2.md` | Parte 3 exige fechar process/audit/assignment e preservar atomic activation antes de Academic Core/Student 360. | Confirmado |
| `NEXUS_ARCHITECTURE_TO_BE_V2.md` | Activation é use case transacional, generic status mutation não pode contornar; eventos downstream duráveis e audit humano/sistema são requisitos. | Confirmado |
| `PROJECT_STATE.md` | Estado integrado é factual; não cria autorização implícita para nova implementação. | Confirmado |
| `ENROLLMENT-01.md` e evidence | ENROLLMENT-01 fechou identity mutation/registration concurrency; activation/process assignment/storage ficaram fora do scope. | Confirmado |

## AS-IS executável confirmado

| Finding | Evidência | Classificação |
| --- | --- | --- |
| Generic active | `enrollment.controller.ts` chama `canTransitionEnrollment` e faz `UPDATE enrollment_applications SET status=$1`; a policy permite `validated → active` para liderança. Não há update de StudentProfile nesse boundary. | P0 |
| Student lifecycle | `enrollment-intake.ts` cria `student_profiles` como `inactive`. O schema aceita `active`, mas não há `ActivateEnrollment` canónico. | P0 |
| Assignment role | `assignEnrollmentProcess` exige só `memberships.status='active'` para assignee; `canManageEnrollment` permite ator admin/director/secretariat sem separar eligibility do destinatário. | P1 |
| Audit truth | `persistProjection` grava `process_reconciled` durante `loadEnrollmentProcess` com `context.personId`; logo o leitor humano pode surgir como ator de uma reconciliação automática. | P1 |
| Progress semantics | A mesma reconciliação atualiza `last_progress_at`; assignment só atualiza `updated_at`. O timestamp não tem semântica operacional estável. | P2 |
| Schema | `enrollment_events.actor_person_id NOT NULL`; não há actor kind/correlation id, activation ledger ou lifecycle version em `enrollment_applications`. | Prerequisite de migration |
| Physical file | Documents guardam metadata/evidence reference e snapshots, mas não objeto autorizado/hash/MIME/tamanho/upload/download. | Future dependency, P1 de hardening global |

## Alternativas avaliadas

| Tema | Alternativa rejeitada | Razão | Decisão READY |
| --- | --- | --- |
| Ativação | Manter `active` no endpoint genérico e acrescentar checks pontuais | Não sincroniza StudentProfile nem fornece idempotência/audit/downstream atómico. | Comando `ActivateEnrollment` exclusivo. |
| Concurrency | Reutilizar `registration_version` ou `process.version` como lifecycle authority | Protegem agregados distintos; não cobrem todo o facto de activation. | Lifecycle version explícita, migration aditiva. |
| Idempotência | Confiar só em lock/status | Retry de rede não tem replay determinístico e downstream pode duplicar. | Ledger + idempotency key obrigatória. |
| Assignment | Qualquer Membership ativa | Confunde vínculo com responsabilidade operacional. | Matriz explícita de actor/assignee. |
| Reconciliação | Manter write em GET atribuído ao leitor | Viola audit truth. | Ação explícita de sistema; GET sem side effect humano. |
| Documento físico | Tratar `evidence_reference` como storage | Não fornece integridade, autorização ou estado de objeto. | Fora de ENROLLMENT-02; missão própria. |

## Migration readiness

| Necessidade | Schema atual | Decisão |
| --- | --- | --- |
| Lifecycle CAS | Sem lifecycle version em Enrollment; `registration_version` é específico de registration. | Nova coluna aditiva `lifecycle_version`, default/backfill seguro e `CHECK (> 0)`. |
| Replay de activation | Sem command ledger de activation. | Ledger aditivo institucional por operação/chave; mesma chave retorna replay seguro. |
| Actor system | `actor_person_id` obrigatório e sem kind/correlation. | Adicionar `actor_kind`, nulabilidade condicional, correlation/request ID e checks. |
| Event downstream | Arquitetura requer event no mesmo commit quando downstream importa; capacidade concreta deve ser descoberta no preflight. | Reutilizar outbox se existir; caso contrário definir evento/ledger mínimo sem nova plataforma paralela. |

Toda migration será forward-only, próxima numeração canónica, isoladamente testada e sem alteração de migrations históricas. Nenhuma migration foi criada nesta preparação.

## ACs e provas planeadas

| AC | Prova executável obrigatória |
| --- | --- |
| AC01 | HTTP/PostgreSQL: transition genérica para `active` devolve erro estável e não escreve. |
| AC02 | Apenas `POST /activate` transforma validated em active. |
| AC03 | PostgreSQL comprova Enrollment + StudentProfile ativos no mesmo commit. |
| AC04 | Falha injetada após StudentProfile/audit/outbox deixa ambos e ledger inalterados. |
| AC05 | A/B concorrentes e replay de mesma chave não duplicam event/handoff. |
| AC06 | expected lifecycle/registration stale devolve HTTP 409 seguro; cliente não auto-retry. |
| AC07 | Matriz de papéis prova ator e assignee permitidos/proibidos. |
| AC08 | Membership inativa, alvo inexistente e A→B falham fechados sem leakage. |
| AC09 | Reconcile é `system`; plain GET não cria action humana fictícia. |
| AC10 | Timestamps só avançam em progress events definidos; read/reconcile/replay não avançam. |
| AC11 | Audit tem actor/cause factual, institution, operação, resultado e correlação quando disponível, sem PII. |
| AC12 | Suites de intake, snapshots/documents, process, ENROLLMENT-01 identity/concurrency, IAM/context e tenant mantêm-se verdes. |

## Dependências e riscos

- **Dependência de schema:** indispensável; a implementação não pode simular actor system ou activation ledger no payload/metadata.
- **Dependência de produto:** a matriz de assignment acima é a decisão proposta. Qualquer alteração de papel exige confirmação antes de código.
- **Dependência de infraestrutura:** preflight deve localizar a autoridade de outbox; não é autorizado criar bus/worker paralelo por conveniência.
- **Risco de tenant:** application, profile, ledger, assignee e eventos devem ser sempre carregados pela instituição do contexto; payload não seleciona tenant.
- **Risco de concorrência:** lock ordering Enrollment → StudentProfile → ledger/event evita double activation; os testes têm de usar PostgreSQL real.
- **Risco de auditoria:** eventos históricos humanos devem continuar legíveis após a migration; sistema não recebe person ID artificial.
- **Não blocker desta missão:** physical storage é um gap real, mas não deve atrasar a correção P0 de activation nem ser absorvido sem a authority Documents.

## Handoff e gates previstos

Antes do primeiro código: confirmar migration number, outbox/ledger reutilizável, contract HTTP existente e ambiente PostgreSQL descartável autorizado. Durante implementação: TDD de AC01–AC10 primeiro, migrations isoladas, PostgreSQL real, HTTP Express operacional e regressões. Antes de DONE: lint, build, secret scan, `git diff --check`, quality gate e evidence individual para cada AC.

## Estado DoR

**DONE — ENROLLMENT-02 CANONICAL PROCESS AUTHORITY AND ATOMIC ACTIVATION PROVEN.** Quality gate determinístico: `started=2026-08-28T15:39:04.0147085+01:00`, `finished=2026-08-28T15:41:07.7378613+01:00`, `exit=0`, `quality-gate: PASS`. Migration isolation, PostgreSQL/HTTP operational, lint, build, secret/artifact scan e committed diff integraram o gate.
