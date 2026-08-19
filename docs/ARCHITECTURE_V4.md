# Nexus Edu IA — Arquitetura v4 — Especificação Supporting Reconciliada

**Estado:** SUPPORTING.  
**Autoridade superior:** `docs/architecture/NEXUS_ARCHITECTURE_TO_BE_V2.md` + ADRs aceites.  
**Regra:** este documento preserva especificações úteis da antiga Arquitetura Oficial v4, mas não pode contrariar a TO-BE v2 nem ser usado como prova do estado AS-IS.

## 1. Decisão preservada

Nexus é uma plataforma escolar integrada: desktop, tablet e mobile são experiências sobre os mesmos dados, policies e serviços — não portais obrigatoriamente fragmentados.

## 2. Invariantes preservados

1. PostgreSQL e storage autorizado são fontes oficiais de dados persistentes.
2. Autorização é backend/server-side e considera instituição, papel, relação, ownership e estado.
3. Processos transversais usam estados, tarefas, eventos, prazos/bloqueios e evidências quando o domínio exige.
4. Operação crítica não aparece concluída sem confirmação real.
5. Cache nunca substitui fonte de verdade e é tenant/context scoped.
6. IA respeita as mesmas policies do ator e não ganha authority própria.
7. Alterações são incrementais, testáveis, reversíveis e rastreáveis.
8. Migrations são a autoridade de evolução de schema para vNext; runtime DDL concorrente deve convergir via FND-01.

## 3. Camadas alvo

- **Experience:** shell, context, workspaces, Student 360/read models, search, notifications, contextual AI.
- **Application:** commands, queries, transactions, orchestration.
- **Domain:** entities, invariants, policies, domain events.
- **Workflow:** states, tasks, SLA/blockers, approvals/evidence quando aplicável.
- **Infrastructure:** PostgreSQL, storage, outbox/events, realtime, integrations, payments, AI gateway.

A separação é conceptual; a migração física do repositório ocorre incrementalmente, nunca por big-bang rewrite.

## 4. Multidispositivo

Desktop privilegia operações densas, tabelas/filtros e gestão. Tablet privilegia supervisão, atendimento e sala. Mobile privilegia tarefas rápidas, contexto essencial e formulários progressivos. Tabelas densas podem permanecer tabelas em desktop e converter-se em resumo/lista no mobile.

Breakpoints de referência preservados: mobile até 767 px; tablet 768–1199; desktop 1200+. O conteúdo governa a adaptação final.

## 5. Context-First / Task-First

A experiência alvo preserva instituição, ano/período, entidade e tarefa sempre que possível. Evitar repetir pesquisa do mesmo aluno/documento/obrigação entre operações. Student 360 é projeção autorizada, não novo silo de escrita.

## 6. Estado, sincronização e conectividade

Escritas user-facing distinguem, quando aplicável: draft/local, pending, processing, confirmed, failed, conflict. Idempotency é obrigatória em comandos retryable de alto impacto. Operações financeiras não são repetidas silenciosamente. Conflitos que exigem julgamento são explícitos.

## 7. Cache

- privado nunca em cache público;
- client cache inclui institution/context e invalida após command confirmado;
- server cache apenas para leitura/derivação adequada, com TTL/invalidation documentados;
- permissões, financeiro e audit têm freshness restrita;
- mudança de contexto invalida cache/subscriptions sensíveis.

## 8. Dados e ownership

Entidades institucionais possuem ownership explícito (`institution_id` e `unit_id` quando aplicável). Modelo longitudinal preserva Person distinta de Student/Staff/Membership. Role institucional pertence à Membership; relações como Guardian↔Student e Teacher×Class×Subject×AcademicYear são contratos próprios.

Finance é bounded context profundo: catalogue → obligation/charge → invoice quando aplicável → payment/allocation → ledger/extract → adjustment/reversal/reconciliation. Campos legacy agregados não são autoridade de saldo.

## 9. Eventos/outbox

Mudança de negócio e evento/outbox que precisam atomicidade são persistidos na mesma transação. Consumidores são idempotentes. Nomes de eventos são contratos do domínio implementado, não uma lista de funcionalidades presumidas.

## 10. IA

Pipeline alvo: `authorized context → policy → minimized retrieval → generation → validation → human confirmation when critical → authorized command → audit`.

AI Gateway não acede diretamente a tabelas como atalho de authority. Ferramentas são policy-scoped e tenant-safe.

## 11. Performance e UX

Metas históricas de referência preservadas: LCP <=2.5s, INP <=200ms, CLS <=0.1 em condições definidas. Estas metas só são release gates quando a Missão define ambiente/método de medição.

Nexus Aurora/tokens e documentos visuais atuais governam cor/componentes; esta arquitetura não redefine paleta.

## 12. Estrutura alvo

A direção modular permanece válida (`features/application/domain/workflow/security/audit/infrastructure`), mas a TO-BE v2 governa bounded contexts e ownership. Estrutura de pastas não é objetivo por si só.

## 13. Gate arquitetural

Uma capability não é considerada pronta apenas porque existe UI. Deve ter, conforme aplicável: owner/domain; fonte de verdade; autorização/tenant; persistência real; estados/falhas; transaction/idempotency; cache/invalidation; audit/observability; testes/negativos; multidispositivo; CI; rastreabilidade Mission Pack→evidence.

## 14. Relação com AUDIT-01

A AUDIT-01 mostrou que vários destes princípios existem no vNext, mas não uniformemente no legado. Por isso esta especificação descreve **TO-BE/supporting invariants**, enquanto `docs/audit/AUDIT_01_TECHNICAL_BASELINE.md` descreve o AS-IS factual. Nunca usar este documento para afirmar que um princípio já está implementado em todo o sistema.
