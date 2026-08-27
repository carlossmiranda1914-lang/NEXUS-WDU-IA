# ENROLLMENT-01 — Identity Mutation Safety & Registration Concurrency

**Estado:** DONE — ENROLLMENT-01 IDENTITY MUTATION SAFETY PROVEN.

**Tipo:** hardening arquitetural de Enrollment. Este documento é a autoridade de planeamento; não autoriza alterações nesta etapa.

## Objetivo e risco

`saveEnrollmentRegistration` bloqueia a `enrollment_application` institucional, mas atualiza linhas de `people` globais para Student e Guardian sem uma versão monotónica nem re-resolução de identidade. Uma segunda edição concorrente pode sobrescrever uma alteração já confirmada (lost update). Uma alteração de identificador pode também fazer uma pessoa global colidir com uma identidade que pertence a outro contexto, sem que o browser possa saber ou pesquisar essa pessoa.

Enrollment permanece institution-scoped; `Person` não é um agregado local de Enrollment. A solução deve preservar a separação: o contexto autoriza a operação no Enrollment da instituição corrente; a resolução de identidade decide, de modo fail-closed, se uma mutação global de Person é admissível.

## Autoridade e baseline lida

- `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md`: fechar concurrency de identity mutation e preservar intake idempotente, state machine, snapshots, contrato de dossier físico e activation atómica.
- `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` e ADRs de Person/Identity/Institutional Context: Person é global; contexto e autorização são derivados no servidor; match ambíguo não pode ser resolvido pelo cliente.
- `src/modules/enrollments/enrollment-registration-api.ts`: bloqueia a Application, mas atualiza Student/Guardian em `people` sem expected version; cria/reutiliza Guardian localmente.
- Migrations `0001`, `0002`, `0006`, `0009`, `0016`: `people` e `enrollment_applications` não têm versão; `enrollment_processes` e decisões de identity resolution têm versão, mas são agregados diferentes e não são authority reutilizável para esta escrita.

## Alternativas avaliadas e decisão

| Modelo | Vantagem | Insuficiência / decisão |
| --- | --- | --- |
| Só `SELECT … FOR UPDATE` | serializa a mesma linha durante uma transação | não informa o utilizador de que editou uma representação desatualizada; rejeitado isoladamente. |
| Só optimistic concurrency | devolve conflito determinístico ao cliente | não ordena nem protege as múltiplas linhas Student, Guardian, relationships e Application durante a operação; rejeitado isoladamente. |
| Híbrido: versões explícitas + locks + re-resolução | protege estado lido, atomicidade multi-row e colisões de identidade | **recomendado**, sujeito à decisão de schema abaixo. |

### Modelo canónico proposto

Usar uma versão monotónica explícita para a composição de registo e para cada Person global que possa ser mutada:

- `enrollment_applications.registration_version` é a authority da representação de registo e protege a ligação Student/Guardian e os campos próprios de Enrollment.
- `people.version` protege cada Person global mutada (Student e Guardian, quando existente).
- o `GET registration` devolve `registrationVersion`, `student.personVersion` e, quando aplicável, `guardian.personVersion`; nunca deriva versões de `updated_at`.
- o `PUT registration` recebe todos os expected versions das entidades que afirma alterar. A ausência, valor inválido ou divergência devolve `409 STALE_VERSION`, sem qualquer write.

Não reutilizar `enrollment_processes.version`: essa versão é authority apenas do processo/assignment, não da representação nem da Person global.

## Matriz de campos

As categorias derivam do resolvedor de Person e das decisões D01–D06: identificadores oficiais têm efeito material; evidência contextual pode apoiar resolução, mas não prova sozinha uma identidade; os campos de perfil não descobrem nem apropriam uma Person.

| Superfície | Campo | Categoria | Regra de escrita |
| --- | --- | --- | --- |
| Student / Guardian | `nationalIdNumber` | identity-material | expected Person version; lock Person; re-resolução e verificação de colisão/ambiguidade antes de update. |
| Student / Guardian | `name`, `birthDate` | identity-supporting | expected Person version; lock Person; re-resolução quando alterados juntamente com, ou quando usados pelo resolvedor para validar, um identificador material; ambiguidade falha fechada. |
| Student / Guardian | `email`, `phone`, `whatsapp` | identity-supporting | expected Person version; lock Person; passam pelo resolvedor apenas se as regras existentes os usarem como evidência contextual; não são prova isolada nem base para revelar candidato. |
| Student / Guardian | `gender`, `nationality`, `addressLine`, `municipality`, `province` | profile-only | expected Person version e lock Person; update simples após a validação concorrencial; não desencadeiam procura/merge/appropriation. |
| Student | `studentNumber` | profile-only institucional (`student_profiles`) | expected registration version; lock profile; update simples, preservando unicidade e escopo institucional existentes. |
| Guardian | `relationship`, troca de Guardian, primary/financial flags | profile-only institucional (`guardian_relationships` / Application) | expected registration version; lock Application e relationships; re-resolução obrigatória se a troca introduzir ou alterar Person Guardian. |
| Enrollment | `previousSchool`, `notes` | profile-only de Enrollment | expected registration version; lock Application; update simples. |

Se o resolvedor atual não suportar uma evidência acima, ENROLLMENT-01 não inventa um algoritmo alternativo: a alteração fica rejeitada/pendente pela policy existente, sem fallback por payload ou pesquisa do browser.

## Contrato HTTP e conflito

O endpoint de leitura deve expor apenas a projeção segura da instituição corrente e as versões explícitas necessárias à edição. O endpoint de escrita aceita o payload de registo e os expected versions acima; os nomes finais podem seguir o adapter existente, mas os três valores e a sua semântica são obrigatórios.

Erro público de concorrência:

```json
{ "code": "STALE_VERSION", "message": "O registo foi alterado entretanto. Recarregue e reveja antes de submeter novamente." }
```

`STALE_VERSION` responde HTTP 409 para Application, Student ou Guardian stale. Não inclui id, nome, instituição, causa de match ou qualquer PII de terceiros. O frontend faz apenas `refresh authoritative registration → revisão humana → resubmissão explícita`; nunca auto-retry, troca silenciosamente a versão, ou escolhe/resolve colisões.

Outros erros de identidade devem ter códigos estáveis e seguros (`IDENTITY_AMBIGUOUS`, `IDENTITY_COLLISION`, conforme o contrato já existente), sem expor candidatos. Falha de autorização ou scope continua indistinguível de inexistência quando essa for a convenção do controller.

## Boundary transacional obrigatório

Ordem concreta dentro de uma única transação PostgreSQL:

1. autenticar e autorizar através de `InstitutionalContext`; obter actor, institution e request/correlation IDs no servidor;
2. carregar `enrollment_applications` por `id + institution_id` com `FOR UPDATE`; se não existir, falhar sem revelar outro tenant;
3. confirmar estado editável pela policy de registration;
4. validar `expectedRegistrationVersion` antes de qualquer mutação;
5. carregar e bloquear `student_profiles`, relationships ativas relevantes e Persons mutáveis em ordem determinística por UUID; validar expected Person versions;
6. para Guardian novo, executar resolução institucional fail-closed antes de criar ou associar; para Guardian substituído, bloquear a relação antiga e a Person reutilizada/candidata que a policy autorize;
7. re-executar Person Resolution para toda alteração material e para os casos supporting exigidos pela policy; em colisão/ambiguidade, abortar;
8. aplicar atomica e exclusivamente os updates Student Person, Guardian Person/relationship, student profile e Enrollment;
9. inserir audit factual e `enrollment_event` de sucesso sem valores PII; incrementar versões de todas as entidades mutadas;
10. `COMMIT`.

Qualquer erro — stale, identidade, constraint, audit ou write intermédio — executa `ROLLBACK`. Não existe resposta de sucesso, versão incrementada, event de sucesso ou estado parcialmente persistido.

## Cross-tenant e Guardian

O browser A não recebe endpoint de pesquisa global nem qualquer candidato de B. Um payload que sugira UUID, telefone, e-mail ou documento pertencente a pessoa fora do contexto não pode ligar/alterar essa Person apenas por esse valor. O resolvedor devolve apenas resultado autorizado e seguro: match inequivocamente permitido, necessidade de decisão humana já canónica, ou falha fechada; nunca detalhes do outro tenant.

Para Guardian:

- **reutilização:** lock da Person e relationship existentes, expected Guardian Person version, policy de re-resolução se identidade material/supporting variar;
- **substituição:** lock da Application e relationship anterior; resolver novo Guardian antes de alterar a referência; criar somente se o resolvedor autorizar ausência de match; relationship anterior recebe a transição de estado definida pela policy na mesma transação;
- **atualização:** igual ao Student para versão/re-resolução; relationship não é prova de identidade.

## Audit factual

Cada sucesso persiste actor humano real, `institution_id`, `enrollment_application_id`, alvo(s) Person/Guardian quando permitido pela retenção, categorias de campo alteradas (`identity_material`, `identity_supporting`, `profile_only`), resultado, request ID e correlation ID. Valores antigos/novos, documentos e contactos não entram em metadata de audit.

Conflitos, colisões e rejeições não criam event de sucesso. Se a política requerer audit de tentativa rejeitada, esse registo deve dizer explicitamente `result: rejected|conflict`, não inferir alteração, e continuar sem PII/candidatos.

## Scope

**IN:** segurança de mutação Student/Guardian Person; concorrência de registration; re-resolução; rollback; audit factual; 409; testes PostgreSQL e HTTP.

**OUT:** activation, storage/documentos, process assignment, finance, capacity/vagas, Student 360, Academic Core, Person admin global, limpeza ampla de legado e redesign visual.

Invariantes a preservar: intake idempotente, state machine, snapshots de documento/policy, contrato de dossier físico e activation atómica.

## Critérios de aceitação

1. AC01: duas edições concorrentes não causam lost update.
2. AC02: versão stale produz `409 STALE_VERSION` e zero write parcial.
3. AC03: alteração de identificador material volta a executar Person Resolution.
4. AC04: colisão ou ambiguidade falha fechada.
5. AC05: probe cross-institution não expõe nem apropria Person.
6. AC06: Student, Guardian e Enrollment ficam coerentes atomicamente.
7. AC07: falha intermédia deixa zero mudança parcial.
8. AC08: audit tem actor, institution, alvo e resultado factuais, sem PII desnecessária.
9. AC09: intake, snapshots documentais e state machine não regressam.
10. AC10: 409 nunca provoca retry automático no frontend.

## Matriz mínima de testes para implementação

- happy path e atualização profile-only sem re-resolução indevida;
- A/B concorrentes da mesma registration;
- Student stale e Guardian stale;
- colisão de identificador nacional/documental e identidade ambígua;
- probe cross-institution sem leakage;
- rollback após falha entre Student, Guardian e Application;
- audit de sucesso e semântica de audit para conflict/rejeição;
- Guardian reutilizado, substituído e atualizado;
- contratos HTTP para 409 e ausência de auto-retry no cliente;
- regressões de intake idempotency, policy/state machine e snapshots.

Os testes de concorrência e rollback são PostgreSQL reais, não mocks do pool. HTTP prova o mapeamento público; testes unitários cobrem policy de campos e orquestração. Gates incluem lint, build, `git diff --check`, secret scan e suites Enrollment/Identity/tenant relevantes.

## Decisão de migration e preflight

Não há authority de versão reutilizável nas tabelas que esta operação muta. O preflight read-only do alvo PostgreSQL descartável autorizado passou em 2026-08-27 sob `TEST_DATABASE_LOCAL_AUTHORIZED=true`; a migration aditiva está autorizada para implementação. Ela deve introduzir `people.version` e `enrollment_applications.registration_version`, `NOT NULL`, default seguro para linhas existentes, `CHECK (> 0)`, índices necessários e plano de rollback compatível com a policy de migrations. Não fazer destructive rewrite, não usar timestamps como CAS nem runtime DDL.

## Dependências e stop conditions

- PR/issue #78 permanece OPEN e #79 OPEN/draft e dependente de #78; `PROJECT_STATE.md` ainda descreve a integração IAM como não concluída em `main`. A branch atual contém os commits IAM/Auth necessários; a integração em `main` requer autorização explícita: **MERGE AUTHORIZATION REQUIRED**. Isto não bloqueia testes locais nem a implementação nesta branch.
- Antes de começar código: manter a migration aditiva dentro do scope, usar exclusivamente o alvo PostgreSQL descartável aprovado e não declarar integração em `main`.
- Se Person Resolution não suportar resolver a mutação pretendida sem leakage, parar; não introduzir lookup global ad hoc.

## Definition of Ready

**READY — ENROLLMENT-01.** A evidence adjacente comprova a lacuna de versões, o preflight do alvo autorizado e a decisão híbrida/version contract. A implementação começa por testes PostgreSQL de conflito e pela migration aditiva, sem expandir scope.
