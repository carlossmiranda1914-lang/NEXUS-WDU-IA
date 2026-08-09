# ADR-001 — Identidade Institucional, Membership e Fronteira de Autorização

**Estado:** Proposed  
**Data:** 2026-08-09  
**Escopo:** Fundação de identidade, multi-instituição, autorização, dados e WebSocket  
**Relaciona-se com:** MISSÃO 01 — Consolidar e validar o estado atual do projeto

---

## 1. Contexto

A auditoria da MISSÃO 01 confirmou que o Nexus Edu IA já autentica utilizadores com Firebase, mas ainda não possui uma fonte de verdade persistida e confiável que permita ao servidor responder, de forma inequívoca, a esta pergunta:

> **A que instituição este utilizador pertence, em que capacidade, e com que estado de acesso?**

Esta lacuna afeta diretamente:

- autorização HTTP;
- isolamento entre instituições;
- acesso a alunos, professores, documentos, faturas e tarefas;
- WebSocket e subscrições em tempo real;
- auditoria;
- relatórios;
- portais por perfil;
- futura IA contextual;
- operações administrativas multi-instituição.

A auditoria também confirmou dois riscos relevantes:

1. o WebSocket aceita ligações sem autenticação;
2. o `tenantId` pode ser fornecido pelo cliente por query string ou `SUBSCRIBE`.

Não é seguro corrigir estes riscos apenas adicionando um token ao WebSocket enquanto o servidor continuar sem uma relação institucional persistida e autorizadora.

A Arquitetura Oficial e os relatórios estratégicos do Nexus já determinam que:

- a instituição/tenant deve ser resolvida no servidor;
- PostgreSQL deve ser a fonte de verdade;
- autorização deve considerar identidade, instituição, recurso e relação;
- o browser nunca é fonte autorizadora do contexto institucional;
- WebSocket deve reutilizar a mesma fronteira de confiança das APIs;
- o sistema deve evoluir para um núcleo institucional composto por Institution, User/Person, Student, Guardian, Staff e contexto.

Este ADR transforma essa direção numa decisão arquitetural executável.

---

# 2. Decisão central

> **Uma identidade autenticada não possui autoridade operacional global no Nexus. Toda autoridade institucional deriva de relações persistidas e verificadas pelo servidor.**

A arquitetura de identidade passa a distinguir explicitamente cinco conceitos:

```text
Identity
   ↓
Person
   ↓
Membership
   ↓
Institution
   ↓
Institution-owned Resources
```

Nenhuma API, WebSocket, job ou serviço interno pode considerar um `tenantId`, `institutionId`, `schoolId`, role ou relação enviado pelo cliente como prova suficiente de autorização.

---

# 3. Modelo conceptual

## 3.1 Identity

**Identity** representa a identidade técnica utilizada para autenticação.

Exemplo atual:

- Firebase UID;
- email verificado;
- estado de autenticação.

### Responsabilidade

Responder apenas:

> **Quem apresentou esta credencial?**

### Não deve representar

- escola;
- cargo institucional;
- turma;
- aluno associado;
- permissões de negócio;
- instituição ativa.

Firebase autentica identidade. **Não autoriza operações institucionais por si só.**

---

## 3.2 Person

**Person** representa a pessoa real dentro do domínio Nexus.

Uma pessoa pode existir antes, durante ou depois de possuir acesso ao sistema.

Exemplos:

- aluno sem login próprio;
- encarregado sem conta criada ainda;
- professor importado antes do primeiro acesso;
- funcionário administrativo;
- utilizador que posteriormente recebe credenciais.

### Regra

`Identity` e `Person` não devem ser tratados como o mesmo conceito.

Uma `Person` pode:

- não possuir Identity;
- possuir uma Identity;
- futuramente possuir identidades federadas adicionais, se necessário.

No MVP, uma Identity ativa deve ligar-se no máximo a uma Person principal.

---

## 3.3 Institution

**Institution** representa uma unidade organizacional que possui dados, processos e políticas próprias no Nexus.

Exemplos:

- escola;
- colégio;
- instituto;
- centro de formação técnico-profissional.

### Institution é a fronteira primária de isolamento de dados.

Cada instituição deve possuir, no mínimo:

- `id` técnico imutável;
- `name`;
- `code`/slug administrativo controlado;
- `status`;
- dados institucionais básicos;
- timestamps;
- metadata de configuração apenas quando necessária.

### Estados sugeridos

```text
pending
active
suspended
archived
```

### Regra

Uma instituição suspensa ou arquivada não concede contexto operacional ativo, salvo fluxos administrativos explicitamente autorizados.

---

## 3.4 Membership

**Membership** representa a relação autorizadora entre uma `Person`/`User` e uma `Institution`.

É a entidade central desta decisão.

Exemplo:

```text
Person Carlos
  └── Membership
      ├── Institution: Escola A
      ├── role: teacher
      ├── status: active
      └── permissions/context
```

A mesma pessoa pode possuir outra membership:

```text
Person Carlos
  └── Membership
      ├── Institution: Escola B
      ├── role: director
      └── status: active
```

### Campos mínimos recomendados

```text
id
personId
institutionId
role
status
createdAt
updatedAt
approvedAt?
approvedBy?
suspendedAt?
revokedAt?
```

### Constraints obrigatórias

1. `personId` referencia uma Person válida.
2. `institutionId` referencia uma Institution válida.
3. Membership inválida/inativa nunca concede acesso.
4. O servidor nunca cria contexto institucional apenas porque o cliente enviou `institutionId`.
5. Toda resolução de contexto consulta membership persistida.

### Unicidade

No modelo inicial:

```text
UNIQUE(personId, institutionId, role)
```

Isto permite que uma pessoa possua mais de um papel na mesma instituição sem obrigar a guardar arrays de roles num único campo.

---

# 4. Roles: decisão arquitetural

## 4.1 O role deixa de ser autoridade global

O campo `users.role` atual é insuficiente como modelo de longo prazo.

O papel operacional deve pertencer à relação institucional.

### Roles institucionais iniciais

```text
institution_admin
director
secretariat
financial
teacher
student
parent
```

### Nota de compatibilidade

Durante a migração, os valores existentes podem ser mapeados:

```text
admin        → avaliar: platform_admin ou institution_admin
director     → director
secretariat  → secretariat
financial    → financial
teacher      → teacher
student      → student
parent       → parent
```

Nenhuma migração automática de `admin` deve acontecer sem decisão explícita, porque o sistema atual mistura administração da plataforma com administração institucional.

---

# 5. Platform Admin vs Institution Admin

Esta separação é obrigatória.

## 5.1 Platform Admin

É um papel excepcional do operador da plataforma Nexus.

Pode executar ações de suporte/plataforma explicitamente autorizadas.

Não deve ser utilizado como papel normal de uma escola.

Regras:

- extremamente limitado;
- auditado;
- preferencialmente MFA quando disponível;
- ações cross-institution explícitas;
- nunca implícito a partir de email, domínio ou frontend;
- nenhuma instituição consegue autoatribuir este papel.

## 5.2 Institution Admin

É administrador apenas dentro de uma instituição específica.

Exemplo:

```text
Person X
Membership:
Institution = Escola A
Role = institution_admin
```

Esta pessoa não possui automaticamente qualquer autoridade sobre Escola B.

---

# 6. Uma pessoa pode ter múltiplos papéis?

**Decisão: sim.**

Não modelar situações humanas reais como uma única role global.

Exemplos válidos:

- professor + encarregado na mesma escola;
- diretor + professor;
- funcionário de duas instituições com funções diferentes;
- encarregado com educandos em instituições diferentes.

### Modelo recomendado

Múltiplas memberships/role assignments, em vez de um array arbitrário dentro de `users.role`.

Isto facilita:

- auditoria;
- revogação individual;
- políticas específicas;
- contexto institucional;
- menor privilégio.

---

# 7. Relações de domínio não são Memberships

Membership define **acesso institucional**.

Relações académicas/pessoais são entidades separadas.

Exemplo:

```text
GuardianRelationship
  guardianPersonId
  studentId
  institutionId
  relationshipType
  status
  permissions/flags quando necessário
```

Um encarregado não pode consultar um aluno apenas porque ambos pertencem à mesma instituição.

Precisa existir uma relação autorizada `Guardian ↔ Student`.

Da mesma forma:

- professor ↔ turma;
- professor ↔ disciplina;
- aluno ↔ matrícula;
- funcionário ↔ unidade/departamento;

devem ser relações próprias.

---

# 8. Student

`Student` representa o registo escolar da pessoa dentro de uma instituição.

### Regra

Um Student pertence explicitamente a uma Institution.

```text
Student
  id
  institutionId
  personId
  studentNumber/IUA quando aplicável
  status
  ...
```

O `personId` permite construir histórico longitudinal sem duplicar identidade humana.

### Importante

Uma transferência entre instituições não deve transformar silenciosamente o mesmo registo institucional.

A arquitetura deve preservar histórico e origem.

---

# 9. Staff

`Staff` representa vínculo operacional/profissional com uma instituição.

Não substitui Membership.

Exemplo:

```text
Membership → diz que pode entrar como teacher
Staff       → guarda informação profissional necessária
TeacherAssignment → liga esse staff às turmas/disciplinas
```

Assim evitamos colocar detalhes pedagógicos dentro do sistema de autorização.

---

# 10. Contexto institucional ativo

Uma pessoa pode pertencer a mais de uma instituição.

Logo, o sistema precisa de um **Active Institutional Context**.

### Regra

O cliente pode solicitar mudança de contexto, mas o servidor decide se a mudança é válida.

Fluxo:

```text
Identity autenticada
        ↓
Person resolvida
        ↓
Memberships ativas carregadas
        ↓
Cliente solicita Institution X
        ↓
Servidor confirma membership ativa
        ↓
Contexto X torna-se válido para aquela operação/sessão
```

### O que NÃO acontece

```text
Client sends institutionId = X
        ↓
Server trusts it
```

### Estratégia recomendada

Para HTTP, cada pedido deve possuir um contexto institucional explicitamente resolvido no servidor.

O identificador solicitado pelo cliente pode funcionar apenas como **seletor**, nunca como autorização.

---

# 11. Modelo de autorização

O Nexus evolui de RBAC simples para uma combinação controlada de RBAC + relações/contexto.

Conceitualmente:

```text
ALLOW if:
  authenticated
  AND accountActive
  AND institutionActive
  AND activeMembership
  AND membershipAllows(action)
  AND resource.institutionId == context.institutionId
  AND relationshipAllows(resource) when required
```

Isto pode ser descrito como:

```text
Subject + Institution + Action + Resource + Relationship
```

### Exemplo — Professor consulta aluno

Não basta:

```text
role == teacher
```

Deve ser algo equivalente a:

```text
teacher membership ativa na instituição
AND student pertence à mesma instituição
AND teacher possui relação pedagógica autorizada com turma/aluno
AND action = view_academic
```

### Exemplo — Encarregado

```text
parent membership ativa
AND student pertence à mesma instituição
AND GuardianRelationship ativa
AND action permitida
```

---

# 12. Data ownership

Toda entidade institucional sensível deve possuir ownership explícito.

### Entidades prioritárias

- students;
- staff/teachers;
- enrollments;
- classes/turmas;
- courses;
- invoices;
- payments;
- documents;
- approvals;
- tasks;
- communications;
- chat/conversations;
- attendance;
- grades;
- reports/snapshots quando persistidos;
- audit records.

### Regra

O servidor nunca deve localizar um recurso apenas por `id` e depois assumir que o utilizador o pode consultar.

A consulta deve incluir ou validar ownership institucional.

---

# 13. WebSocket

O WebSocket deve utilizar a mesma identidade e membership das APIs.

## Fluxo alvo

```text
Client requests connection
        ↓
Server validates Firebase identity
        ↓
Server resolves Person/User
        ↓
Server resolves active Membership(s)
        ↓
Institution context is authorized server-side
        ↓
Socket is bound to immutable authorized context
        ↓
Only authorized events are delivered
```

### Regras não negociáveis

- query string `tenantId` nunca concede acesso;
- `SUBSCRIBE` nunca muda livremente a instituição da sessão;
- conexão não autenticada não recebe eventos institucionais;
- troca de contexto requer revalidação;
- broadcast seleciona clientes por contexto já autorizado;
- autorização deve ser reavaliada quando membership for suspensa/revogada quando operacionalmente viável.

---

# 14. API e serviços

Toda operação institucional deve receber um contexto resolvido pelo backend.

Padrão conceptual:

```text
authenticate()
resolvePerson()
resolveInstitutionContext()
authorize(action, resource)
execute()
audit()
```

Handlers não devem implementar políticas diferentes manualmente em dezenas de rotas.

A implementação futura deve convergir para serviços/middleware reutilizáveis.

---

# 15. Jobs, filas e automações

Isolamento institucional também se aplica fora de pedidos HTTP.

Todo job institucional deve carregar explicitamente:

```text
institutionId
initiatedBy / service identity
correlationId
resource references
```

Um worker não pode processar um ID institucional sem verificar a origem/contexto do job.

---

# 16. Auditoria

Ações sensíveis devem registar, quando aplicável:

```text
actorIdentityId
actorPersonId
membershipId
institutionId
action
resourceType
resourceId
result
reason/metadata sanitizada
timestamp
correlationId
```

Nunca guardar tokens ou segredos.

Mudanças de membership, role, estado e ações cross-institution requerem auditoria explícita.

---

# 17. IA

A camada de IA nunca recebe autoridade superior à do utilizador/contexto que iniciou a operação.

Antes de fornecer contexto ao modelo:

```text
Identity
  ↓
Membership
  ↓
Authorization
  ↓
Data minimization
  ↓
AI Gateway
```

IA não escolhe instituição nem amplia escopo.

---

# 18. Estados de Membership

Estado inicial recomendado:

```text
pending
active
suspended
revoked
expired
```

### Semântica

- `pending` — relação proposta, sem autoridade operacional normal;
- `active` — relação autorizada;
- `suspended` — temporariamente bloqueada;
- `revoked` — encerrada explicitamente;
- `expired` — encerrada por validade temporal quando aplicável.

Não reutilizar `deleted` para decisões de autorização.

---

# 19. Convites e onboarding

Fluxo recomendado:

```text
Institution exists
  ↓
Invitation / access request
  ↓
Person resolved/created
  ↓
Membership pending
  ↓
Authorized institutional approver
  ↓
Membership active
```

O requerente pode solicitar um papel, mas não criar para si uma membership ativa privilegiada.

A correção P0 já realizada no endpoint de pedido de acesso é compatível com este princípio e deve ser preservada durante a migração.

---

# 20. Transferências entre instituições

Transferência não significa reatribuir silenciosamente `institutionId` em registos históricos.

Princípios:

- preservar instituição de origem;
- criar novo contexto institucional quando necessário;
- manter histórico de transferência;
- controlar quais dados podem acompanhar o aluno;
- não expor dados internos da instituição anterior por defeito.

A política detalhada de transferência será definida num ADR próprio.

---

# 21. Estratégia de defesa em profundidade

A aplicação continua responsável pela autorização.

PostgreSQL Row-Level Security pode ser avaliado como segunda barreira para entidades críticas.

RLS não substitui:

- middleware;
- services;
- políticas de aplicação;
- testes de autorização.

Adoção de RLS exige ADR e estratégia operacional separados.

---

# 22. Invariantes arquiteturais

Estas regras passam a ser critérios obrigatórios para a arquitetura vNext:

1. Nenhum tenant/institution recebido do cliente é autoridade.
2. Toda operação institucional possui instituição resolvida no servidor.
3. Toda relação de acesso institucional é persistida.
4. Role institucional pertence à relação institucional, não à identidade global.
5. Um utilizador pode possuir múltiplos vínculos e papéis.
6. Recursos críticos possuem ownership institucional.
7. `resource.id` nunca é autorização suficiente.
8. Família exige relação Guardian ↔ Student.
9. Professor exige relação pedagógica para operações de escopo restrito.
10. WebSocket usa a mesma fronteira de identidade das APIs.
11. Jobs e automações carregam contexto institucional.
12. Auditoria inclui instituição e actor para ações críticas.
13. Platform Admin e Institution Admin são conceitos diferentes.
14. Estado `pending` nunca concede privilégio operacional por si só.
15. Falha em resolver contexto = deny.
16. Falha em resolver relação = deny.
17. Falha de PostgreSQL em produção não pode transformar autorização em fallback permissivo.

---

# 23. Cardinalidades alvo

```text
Identity      0..1 ─── 1 Person
Person        1 ────── * Membership
Institution   1 ────── * Membership
Institution   1 ────── * Student
Person        1 ────── * Student records (em instituições distintas, quando aplicável)
Person        1 ────── * Staff records
Guardian      * ────── * Student via GuardianRelationship
Staff         * ────── * Class/Course via assignments
Institution   1 ────── * institutional resources
```

Estas cardinalidades representam direção arquitetural. O schema físico final deve ser validado contra o repositório atual antes da migration.

---

# 24. Modelo lógico preliminar

```text
people
  id
  legalName
  preferredName?
  birthDate?
  ...

identities
  id
  personId
  provider
  providerSubject
  email?
  status
  ...

institutions
  id
  code
  name
  status
  ...

memberships
  id
  personId
  institutionId
  role
  status
  approvedBy?
  approvedAt?
  ...

students
  id
  personId
  institutionId
  studentNumber?
  status
  ...

guardian_relationships
  id
  guardianPersonId
  studentId
  institutionId
  relationshipType
  status
  ...

staff
  id
  personId
  institutionId
  staffNumber?
  status
  ...
```

Não implementar estas tabelas literalmente antes da comparação com o schema existente.

---

# 25. Estratégia de migração — princípios

A migração deve ser incremental e reversível.

Não executar uma transformação massiva num único passo.

Sequência sugerida:

### Etapa A — inventário

Mapear:

- `users` atual;
- students;
- teachers/staff;
- parent/guardian associations;
- tenantId existentes;
- fixtures/demo;
- foreign keys;
- rotas que usam role global.

### Etapa B — Institution + Membership

Adicionar estrutura nova sem remover imediatamente os campos antigos.

### Etapa C — backfill controlado

Criar memberships a partir de dados existentes apenas onde a relação for inequívoca.

Ambiguidades ficam bloqueadas para revisão.

### Etapa D — dual-read controlado

Serviços críticos passam a resolver contexto novo, com métricas/logs de incompatibilidade.

Evitar dual-write permanente.

### Etapa E — enforcement

APIs, WebSocket e serviços deixam de confiar em tenant/role global antigo.

### Etapa F — remoção de legado

Campos antigos só são removidos depois de cobertura de testes, migração e validação.

---

# 26. Critérios para considerar esta arquitetura implementada

Não basta criar tabelas.

A fundação institucional só está concluída quando houver evidência de que:

- utilizador sem membership não acede à instituição;
- membership suspensa/revogada perde acesso;
- Escola A não lê nem altera Escola B;
- role de Escola A não concede privilégio em Escola B;
- pessoa com duas instituições alterna contexto sem atravessar dados;
- parent não consulta aluno sem GuardianRelationship;
- professor não atua sobre recurso fora do seu escopo autorizado;
- WebSocket rejeita não autenticados;
- WebSocket não aceita tenant arbitrário;
- jobs preservam contexto;
- auditoria identifica instituição e actor;
- testes negativos existem e passam.

---

# 27. Decisões explicitamente adiadas

Este ADR não fecha ainda:

- política detalhada de transferências;
- estrutura curricular completa;
- modelo de grupos empresariais com várias escolas;
- delegação temporária de permissões;
- RLS definitivo;
- SSO empresarial;
- acesso de Ministério/entidades reguladoras;
- modelo de campus/unidade física;
- granularidade final de permissões customizadas.

Essas decisões devem receber ADRs próprios quando entrarem no roadmap.

---

# 28. Impacto no código atual

A auditoria já indica impacto provável em:

- `src/db/schema.ts`;
- `src/middleware/auth.ts`;
- middleware multi-tenant;
- `server.ts`;
- `src/security/access-control.ts`;
- WebSocket manager;
- APIs de students/users/teachers/invoices/documents/tasks;
- portais aluno/encarregado;
- auditoria/logs;
- testes de autorização.

**Este ADR não autoriza alterações imediatas nesses ficheiros.**

Primeiro deve existir análise de compatibilidade e plano de migration.

---

# 29. Consequências positivas

- isolamento institucional verificável;
- roles contextualizadas;
- suporte natural a utilizadores multi-instituição;
- WebSocket seguro torna-se implementável;
- melhor rastreabilidade;
- base sólida para Student 360;
- menor risco de IDOR;
- futura IA trabalha apenas sobre contexto autorizado;
- integrações ganham IDs e relações estáveis;
- expansão para várias escolas não exige reescrever identidade.

---

# 30. Custos e riscos

Esta decisão aumenta a sofisticação do modelo de dados.

Riscos principais:

- migration incorreta de utilizadores existentes;
- roles antigos ambíguos;
- dados sem institutionId;
- fixtures/demo misturados com dados reais;
- código ainda dependente de `users.role`;
- necessidade de atualizar muitos repositórios/queries;
- regressões se a migração for feita de uma vez.

Mitigação:

- inventário antes de migration;
- passos pequenos;
- compatibilidade temporária controlada;
- testes cross-tenant obrigatórios;
- não eliminar legado antes de prova.

---

# 31. Próxima ação técnica

Com este ADR aprovado, a próxima interação com Codex deve ser **ANÁLISE READ-ONLY**, não implementação.

Objetivo da análise:

> comparar este modelo alvo com o schema e os fluxos atuais e produzir o menor plano incremental de migração Institution + Membership.

O Codex deve mapear:

1. tabelas atuais;
2. dependências de `users.role`;
3. todos os locais que derivam tenant do cliente;
4. entidades sem ownership institucional;
5. relações aluno/encarregado atuais;
6. impacto de migrations;
7. dados demo/seed relevantes;
8. ordem segura de implementação;
9. testes obrigatórios;
10. riscos de compatibilidade.

Nenhum schema deve ser alterado nessa primeira passagem.

---

# 32. Regra final

> **O cliente seleciona contexto. O servidor concede contexto.**

> **A identidade prova quem é a pessoa. A Membership prova onde e em que capacidade ela pode atuar.**

> **Nenhuma funcionalidade do Nexus deve atravessar uma fronteira institucional sem uma relação persistida, autorizada e auditável.**
