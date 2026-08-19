# Nexus Edu IA — Definition of Ready, Definition of Done e Sistema de Evidências v2

**Estado:** CANÓNICO para gates de implementação.  
**Princípio:** sem evidência, não há aprovação; sem aprovação, não há avanço de gate.

## 1. Estados oficiais

Uma Missão está em exatamente um estado: **BACKLOG, PREPARAÇÃO, READY, ANÁLISE, PLANEADA, IMPLEMENTAÇÃO, VALIDAÇÃO, BLOQUEADA ou DONE**.

READY autoriza análise/execução apenas dentro do Mission Pack aprovado. DONE é um estado provado, não uma opinião.

## 2. Definition of Ready — Missão

Antes de READY, todos os itens aplicáveis devem estar explícitos:

### Identidade, valor e âmbito
- issue/identificador único;
- problema e resultado observável;
- valor e prioridade;
- IN/OUT scope;
- tamanho/decomposição adequada;
- dependências e bloqueios.

### Rastreabilidade canónica
- benchmark/evidência operacional aplicável;
- decisão ADOPT/ADAPT/KEEP/REJECT/INVESTIGATE quando aplicável;
- requisito no Plano Mestre;
- contrato na Arquitetura/ADR/domain authority;
- finding/gap AS-IS aplicável;
- conflitos documentais resolvidos antes de código.

### Critérios
- critérios funcionais passa/falha;
- erro/falha;
- autorização/tenant;
- persistência/transação/idempotência quando aplicável;
- multidispositivo/estados UI quando aplicável;
- critérios de integração e auditoria quando aplicável.

### Plano de prova
- testes automáticos e negativos;
- PostgreSQL/migration proof quando toca persistência;
- validação manual/visual quando user-facing;
- atores/perfis e instituições de teste;
- rollback/recovery;
- stop rules.

### Segurança/dados
Para autenticação, autorização, PII, financeiro, IA, documentos, uploads, realtime ou multi-instituição: origem server-side do contexto, mínimo de dados, cenários de acesso indevido, audit/log esperado e proibição de segredos/PII indevida em outputs.

## 3. Micro-gate de tarefa técnica

Antes de editar:

- passo aprovado e objetivo observável;
- áreas esperadas e áreas proibidas;
- contratos/invariantes que não podem mudar;
- critérios e testes imediatos;
- risco e rollback;
- stop rule se a correção exigir ampliar produto, arquitetura, authority ou dados fora do âmbito.

O executor — humano, agente ou ferramenta — deve parar em vez de ampliar silenciosamente a missão.

## 4. Definition of Done

### Resultado
- todos os AC obrigatórios PASS;
- nenhum mock/demo é apresentado como fluxo real sem decisão explícita;
- falha real nunca vira sucesso visual;
- persistência e efeitos correspondem ao resultado apresentado.

### Qualidade técnica
- `git diff --check`;
- typecheck/lint/formatação aplicáveis;
- testes unitários/integration/contract aplicáveis;
- PostgreSQL/migrations quando aplicável;
- builds afetados;
- CI obrigatória.

Teste não executado = **NOT RUN**, nunca PASS.

### Segurança e tenancy
Quando aplicável: autenticação válida/inválida, allow/deny, acesso direto API, cross-role, cross-tenant, ID manipulation, server-owned authority, logs seguros e audit de mutações críticas.

### Dados
Schema/código coerentes; migrations ordenadas; constraints verificadas; persistência comprovada; nenhuma readiness falsa; transações não deixam estado crítico parcial; concorrência/retry testados quando relevantes.

### UI/UX
Desktop/tablet/mobile conforme âmbito; loading/empty/error/success/forbidden; backend continua authority; linguagem operacional clara; evidência visual/manual para mudanças user-facing.

### IA
Mesmo policy scope do ator; minimização; sugestão distinta de execução; confirmação para ação crítica; falha segura; rastreabilidade.

### Diff/Git/documentação
Diff completo revisto; sem ficheiros inexplicados/segredos/temporários; commits coerentes; PR referencia Missão e evidências; documentação/ADR/PROJECT_STATE atualizados quando materialmente afetados.

### Risco residual
P0 = 0. P1 = 0 para DONE, salvo exceção formal explicitamente aprovada e documentada. P2/P3 remanescentes têm owner/issue quando necessário.

## 5. Classes de evidência

| Código | Evidência |
|---|---|
| E01 | Estado Git / branch / base |
| E02 | Diff / `diff --check` |
| E03 | Teste automático |
| E04 | Build / typecheck / lint |
| E05 | Segurança / autorização |
| E06 | Multi-tenant |
| E07 | Persistência |
| E08 | Database / migrations / constraints |
| E09 | UI visual |
| E10 | Fluxo manual |
| E11 | Auditoria / logs |
| E12 | Contrato/API |
| E13 | IA |
| E14 | Documentação/ADR |
| E15 | Risco/decisão |
| E16 | Concorrência/idempotência |
| E17 | Rollback/recovery |

Toda evidência responde: **o quê, como, onde, resultado e qual AC prova**.

Estados: **PASS, FAIL, BLOCKED, NOT RUN, N/A**. BLOCKED/NOT RUN nunca são convertidos em PASS.

## 6. Matriz obrigatória

| ID | Critério | Evidência exigida | Estado | Referência |
|---|---|---|---|---|
| AC-xx | comportamento verificável | E0x | NOT RUN | — |

Nenhuma Missão é DONE com critério obrigatório FAIL/BLOCKED/NOT RUN.

## 7. Relatório mínimo de execução

Registar: Missão/passo; branch/base; âmbito; ficheiros; comandos/ações; matriz AC→evidência; riscos P0–P3; alterações fora do plano; bloqueios; rollback quando relevante; próxima ação.

## 8. Relação com outros documentos

- `docs/README.md` define autoridade documental;
- `docs/templates/MISSION_PACK_TEMPLATE.md` materializa este gate;
- `docs/operations/IMPLEMENTATION_WORKFLOW.md` define o ciclo de execução;
- `docs/operations/ENGINEERING_PLAYBOOK.md` detalha práticas;
- `docs/operations/AGENT_TRAINING_AUTOMATION.md` é SUPPORTING para qualificação/automação e não pode relaxar estes gates.

## 9. Regra constitucional

Nenhuma ferramenta, agente, pressa de roadmap ou investimento anterior pode transformar evidência ausente em PASS, ampliar authority silenciosamente ou declarar DONE com um bloqueio crítico conhecido.
