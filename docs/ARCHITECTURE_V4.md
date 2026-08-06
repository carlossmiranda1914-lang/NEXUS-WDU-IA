# Nexus Edu IA — Arquitetura Oficial v4

Estado: referência de engenharia para produto, UX, backend, frontend e operações.

## 1. Decisão central

O Nexus Edu IA é uma única plataforma escolar integrada, com uma fonte de verdade e experiências adaptadas por perfil, contexto e dispositivo. Desktop, tablet e mobile não são produtos separados: são projeções diferentes sobre os mesmos dados, workflows, políticas e serviços.

## 2. Princípios não negociáveis

1. PostgreSQL e storage autorizado são fontes oficiais de dados.
2. Autorização é aplicada no backend com instituição, unidade, papel, propriedade e estado do recurso.
3. Processos transversais usam workflows, tarefas, estados, eventos, prazos e evidências.
4. Nenhuma operação crítica é apresentada como concluída sem confirmação real.
5. Interfaces adaptam prioridade e densidade ao dispositivo; não escondem regras de negócio.
6. Cache nunca substitui a fonte de verdade e deve ter estratégia explícita de invalidação.
7. IA utiliza as mesmas policies do utilizador e não executa ações críticas autonomamente.
8. Alterações devem ser incrementais, testáveis, reversíveis e rastreáveis.

## 3. Arquitetura em camadas

- Experience Layer: app shell, navegação, centros operacionais, pesquisa, notificações e IA contextual.
- Application Layer: casos de uso, comandos, queries, transações e coordenação.
- Domain Layer: entidades, invariantes, políticas, eventos e regras escolares.
- Workflow Layer: estados, tarefas, SLAs, bloqueios, aprovações e evidências.
- Infrastructure Layer: PostgreSQL, storage, outbox, WebSocket, email, pagamentos e IA.

## 4. Estratégia multidispositivo

### Desktop

Uso principal: administração, secretaria, tesouraria, direção e configuração avançada.

- navegação lateral persistente;
- tabelas densas com filtros avançados;
- trabalho simultâneo entre listas e detalhes;
- dashboards completos;
- ações em massa apenas quando seguras.

### Tablet

Uso principal: supervisão, coordenação, sala de aula e atendimento móvel.

- navegação adaptativa;
- grelhas de 8 colunas;
- foco em filas, formulários e validações;
- painéis secundários convertidos em drawers ou tabs.

### Mobile

Uso principal: aluno, encarregado, professor e tarefas rápidas.

- navegação inferior ou menu compacto;
- uma ação primária por contexto;
- formulários por etapas;
- tabelas convertidas em listas ou cartões;
- dados essenciais antes de analytics;
- nenhuma função depende de hover.

## 5. Breakpoints oficiais

- mobile: até 767 px;
- tablet: 768–1199 px;
- desktop: 1200 px ou superior.

Os breakpoints são referências de layout. A decisão final deve considerar conteúdo, não apenas largura física.

## 6. Arquitetura de navegação

- AppShell mantém instituição, unidade, período, perfil, pesquisa, notificações e conta.
- Rotas pertencem a features e domínios, não a um App.tsx monolítico.
- Navegação visível melhora UX, mas autorização continua no backend.
- Mudança de contexto institucional invalida queries, cache sensível e subscrições em tempo real.

## 7. Estado, sincronização e conectividade

Estados obrigatórios de escrita:

- rascunho local;
- pendente de sincronização;
- em processamento;
- confirmado;
- falhou;
- conflito.

Regras:

- idempotency keys para matrículas, pagamentos, documentos e comunicações;
- auto-save apenas para rascunhos claramente identificados;
- retries limitados e visíveis;
- operações financeiras nunca são repetidas silenciosamente;
- conflitos mostram diferenças e exigem decisão humana quando necessário.

## 8. Estratégia de cache

### Browser/CDN

- assets versionados: cache longo e imutável;
- HTML principal: revalidação curta;
- conteúdo privado: nunca em cache público.

### Cliente

- cache por query, instituição, perfil e período;
- stale-while-revalidate para leitura não crítica;
- invalidação após comandos confirmados;
- dados financeiros, permissões e auditoria com frescura restrita.

### Servidor

- cache apenas para dados derivados ou leitura de alta frequência;
- chaves incluem tenant e contexto;
- TTL e invalidadores documentados;
- nunca guardar segredos, tokens ou respostas sensíveis em cache partilhado.

## 9. Performance

Metas iniciais:

- LCP <= 2,5 s em condições de referência;
- INP <= 200 ms;
- CLS <= 0,1;
- carregamento progressivo por rota e feature;
- virtualização para listas extensas;
- evitar pedidos duplicados;
- páginas críticas usam payload mínimo e skeletons informativos.

## 10. Dados e multi-tenancy

Todas as entidades de negócio incluem institution_id e, quando aplicável, unit_id.

Entidades centrais:

- Institution;
- Unit;
- AcademicYear;
- Person;
- User;
- Membership;
- Student;
- GuardianRelationship;
- StaffMember;
- Enrollment;
- Document;
- Invoice;
- Payment;
- WorkflowInstance;
- Task;
- AuditEvent.

## 11. Eventos e outbox

Eventos mínimos:

- EnrollmentValidated;
- PaymentConfirmed;
- StudentAssignedToClass;
- AttendanceExceptionRaised;
- GradesPublished;
- DocumentSigned;
- CommunicationDelivered.

A alteração de negócio e o registo no outbox ocorrem na mesma transação. Consumidores devem ser idempotentes.

## 12. IA

Pipeline obrigatório:

contexto → policy → recuperação → geração → validação → confirmação → execução → auditoria.

A IA pode informar, recomendar e preparar rascunhos. Ações críticas exigem confirmação humana e caso de uso autorizado.

## 13. Estrutura alvo do repositório

```text
src/
  app-shell/
  features/
  shared/
  design-system/
server/
  api/
  application/
  domain/
  workflow/
  security/
  audit/
  infrastructure/
    db/
    events/
    storage/
    integrations/
```

## 14. Gates de arquitetura

Uma feature só está pronta quando possui:

- domínio proprietário e contratos definidos;
- persistência real;
- autorização no backend;
- estados de loading, vazio, erro, processamento, confirmação e sem permissão;
- comportamento desktop, tablet e mobile;
- estratégia de cache e invalidação;
- testes unitários, integração e E2E adequados;
- logs, métricas e auditoria quando aplicável;
- ligação a issue, PR e decisão arquitetural.
