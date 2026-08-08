# Nexus Edu IA — Definition of Ready, Definition of Done e Sistema de Evidências

## 1. Propósito

Este documento transforma o workflow oficial em gates objetivos de entrada, execução e conclusão.

Uma tarefa não entra no Codex porque “parece pronta” e não termina porque “o código funciona”. Cada estado exige evidência verificável.

> **Sem evidência, não há aprovação. Sem aprovação, não há avanço de gate.**

---

## 2. Estados oficiais de uma Missão

Toda Missão deve estar em exatamente um destes estados:

1. **BACKLOG** — intenção registada, ainda não preparada.
2. **PREPARAÇÃO** — requisitos, dependências e evidências estão a ser definidos.
3. **READY** — Definition of Ready aprovada; pode entrar em análise Codex.
4. **ANÁLISE** — Codex trabalha somente em leitura.
5. **PLANEADA** — análise aprovada e plano mínimo definido.
6. **IMPLEMENTAÇÃO** — uma tarefa técnica aprovada está a ser alterada.
7. **VALIDAÇÃO** — implementação concluída; testes, diff e validação manual em curso.
8. **BLOQUEADA** — existe impedimento explícito que impede avanço seguro.
9. **DONE** — Definition of Done integralmente comprovada.

Não usar “quase pronto”, “90%”, “basicamente concluído” ou estados equivalentes como substituto destes gates.

---

## 3. Definition of Ready — DoR

Uma Missão só pode receber estado **READY** quando todos os itens obrigatórios aplicáveis estiverem satisfeitos.

### 3.1 Identidade e objetivo

- [ ] Existe uma issue única no GitHub.
- [ ] O problema está descrito em linguagem objetiva.
- [ ] Existe um resultado observável esperado.
- [ ] O valor funcional, operacional, técnico ou de segurança está explícito.
- [ ] A prioridade está definida.
- [ ] O responsável pela decisão de produto, quando necessário, é identificável.

### 3.2 Âmbito

- [ ] “Dentro do âmbito” está explícito.
- [ ] “Fora do âmbito” está explícito.
- [ ] Não existem duas missões independentes escondidas na mesma issue.
- [ ] A mudança foi classificada XS, S, M, L ou XL.
- [ ] L/XL foi decomposta antes de implementação.

### 3.3 Dependências

- [ ] Dependências técnicas conhecidas estão listadas.
- [ ] Dependências de outras missões estão listadas.
- [ ] Dependências externas estão identificadas.
- [ ] Nenhuma dependência bloqueadora permanece implicitamente assumida.

### 3.4 Fonte de verdade

- [ ] Arquitetura Oficial aplicável foi identificada.
- [ ] Plano Mestre aplicável foi identificado.
- [ ] Design System aplicável foi identificado quando houver UI/UX.
- [ ] ADRs ou decisões técnicas relevantes foram identificados.
- [ ] Conflitos entre documentação, issue e código foram registados.
- [ ] Conflitos bloqueadores foram resolvidos antes de implementação.

### 3.5 Critérios de aceitação

Cada critério deve ser verificável como **passa/falha**.

- [ ] Critérios funcionais estão definidos.
- [ ] Critérios de erro/falha estão definidos.
- [ ] Critérios de autorização estão definidos quando aplicável.
- [ ] Critérios de persistência estão definidos quando aplicável.
- [ ] Critérios multidispositivo estão definidos quando aplicável.
- [ ] Não existem critérios vagos como “melhorar”, “otimizar” ou “deixar bonito” sem medida observável.

### 3.6 Plano de prova

Antes do código deve existir uma resposta para: **como provaremos que funciona?**

- [ ] Testes automáticos necessários estão identificados.
- [ ] Testes negativos necessários estão identificados.
- [ ] Validação manual necessária está descrita.
- [ ] Perfis/utilizadores de teste estão identificados quando aplicável.
- [ ] Instituições de teste estão identificadas para fluxos multi-tenant.
- [ ] Estados loading/vazio/erro/sucesso estão previstos para UI quando aplicável.

### 3.7 Segurança e dados

Quando a missão toca autenticação, autorização, dados pessoais, financeiro, IA, documentos, uploads, WebSocket ou multi-instituição:

- [ ] superfície de risco foi identificada;
- [ ] origem do contexto autorizado está definida no servidor;
- [ ] dados mínimos necessários foram definidos;
- [ ] cenários de acesso indevido foram incluídos nos testes;
- [ ] auditoria/log esperado foi definido;
- [ ] segredos e dados sensíveis estão explicitamente fora de logs e outputs.

### 3.8 Prompt de análise

- [ ] Existe prompt Codex em modo ANALISAR.
- [ ] O prompt proíbe alteração de ficheiros.
- [ ] O prompt exige mapa dos ficheiros/fluxos relevantes.
- [ ] O prompt exige riscos P0–P3.
- [ ] O prompt exige menor plano de correção possível.
- [ ] O prompt proíbe commit, push e deploy.

### Gate READY

**Aprovar READY somente se todos os itens obrigatórios aplicáveis estiverem marcados.**

Se faltar informação não crítica, registar como questão aberta. Se a falta puder mudar arquitetura, segurança, contrato, schema ou critério de aceitação, a missão permanece em PREPARAÇÃO ou BLOQUEADA.

---

## 4. Definition of Ready — Tarefa Técnica

Mesmo numa Missão READY, cada tarefa de implementação precisa de um micro-gate antes do Codex editar.

- [ ] Passo do plano está identificado.
- [ ] Objetivo observável do passo está definido.
- [ ] Ficheiros esperados estão listados ou delimitados.
- [ ] Ficheiros/áreas proibidos estão explícitos.
- [ ] Contratos que não podem mudar estão explícitos.
- [ ] Critérios de aceitação do passo estão definidos.
- [ ] Testes imediatos do passo estão definidos.
- [ ] Risco do passo está classificado.
- [ ] Rollback é compreensível quando a mudança for de risco relevante.

Se o Codex descobrir que precisa alterar área fora do âmbito, deve **parar e reportar**, não ampliar a tarefa autonomamente.

---

## 5. Definition of Done — DoD

Uma Missão só recebe estado **DONE** quando a implementação e a prova estão completas.

### 5.1 Resultado

- [ ] Todos os critérios de aceitação passam.
- [ ] Não existem funcionalidades parcialmente escondidas atrás de UI.
- [ ] Não existem mocks/dados demonstrativos em fluxos declarados reais, salvo decisão explícita.
- [ ] Erros reais não são apresentados como sucesso.

### 5.2 Qualidade técnica

- [ ] `git diff --check` passa.
- [ ] TypeScript passa quando aplicável.
- [ ] Lint/formatação passam quando configurados.
- [ ] Testes unitários afetados passam.
- [ ] Testes de integração afetados passam.
- [ ] Build do frontend passa quando afetado.
- [ ] Build do servidor passa quando afetado.
- [ ] CI obrigatória passa.

Um teste não executado deve ser registado como **NÃO EXECUTADO**, nunca implicitamente tratado como aprovado.

### 5.3 Segurança

Quando aplicável:

- [ ] autenticação válida testada;
- [ ] ausência/expiração de autenticação testada;
- [ ] autorização permitida testada;
- [ ] autorização proibida testada;
- [ ] acesso direto à API testado;
- [ ] acesso cruzado entre perfis testado;
- [ ] acesso cruzado entre instituições testado;
- [ ] manipulação de IDs/contexto no cliente não concede acesso;
- [ ] logs não expõem tokens, segredos ou dados sensíveis;
- [ ] ações sensíveis produzem auditoria adequada.

### 5.4 Dados e persistência

Quando aplicável:

- [ ] schema e código estão coerentes;
- [ ] migrations necessárias existem e passam;
- [ ] persistência após nova sessão/restart foi comprovada;
- [ ] constraints críticas foram verificadas;
- [ ] falha da base não ativa sucesso/fallback silencioso em produção;
- [ ] transações compostas não deixam estado parcial crítico.

### 5.5 UI/UX

Quando aplicável:

- [ ] desktop validado;
- [ ] tablet validado;
- [ ] mobile validado;
- [ ] loading validado;
- [ ] estado vazio validado;
- [ ] erro validado;
- [ ] sucesso validado;
- [ ] permissões/ações indisponíveis não dependem apenas de ocultação visual;
- [ ] linguagem técnica desnecessária não é exposta ao utilizador;
- [ ] evidência visual foi anexada à PR ou issue.

### 5.6 IA

Quando aplicável:

- [ ] sugestão e ação executada são claramente distintas;
- [ ] ação sensível exige confirmação/aprovação adequada;
- [ ] inputs enviados ao modelo respeitam minimização de dados;
- [ ] outputs são tratados como probabilísticos quando aplicável;
- [ ] falha/indisponibilidade possui comportamento seguro;
- [ ] ação e decisão relevantes são rastreáveis.

### 5.7 Diff e escopo

- [ ] `git diff --stat` foi revisto.
- [ ] diff completo foi revisto.
- [ ] não existem ficheiros inexplicados.
- [ ] não existem segredos/tokens no diff.
- [ ] não existem ficheiros temporários.
- [ ] não existem alterações fora do âmbito sem decisão registada.
- [ ] refatorações oportunistas não relacionadas foram removidas ou separadas.

### 5.8 Git e revisão

- [ ] commits são pequenos e coerentes.
- [ ] mensagens de commit descrevem intenção.
- [ ] PR referencia a Missão.
- [ ] PR contém resumo, testes, evidências e riscos.
- [ ] comentários/revisões bloqueadores foram resolvidos.
- [ ] branch está atualizada conforme política do repositório.

### 5.9 Documentação

- [ ] documentação afetada foi atualizada.
- [ ] decisão arquitetural relevante gerou/atualizou ADR.
- [ ] setup/operação foi atualizado quando mudou.
- [ ] limitações conhecidas estão registadas.
- [ ] issue contém decisão final e evidências.

### 5.10 Risco residual

- [ ] P0 restantes = 0.
- [ ] P1 restantes = 0 para declarar conclusão, salvo exceção formal aprovada e documentada.
- [ ] P2/P3 restantes possuem owner/issue quando não resolvidos.
- [ ] nenhuma dívida conhecida está escondida em texto de chat sem registo persistente.

### Gate DONE

**DONE é um estado provado, não uma opinião.**

Se qualquer item obrigatório aplicável falhar, a Missão permanece em VALIDAÇÃO ou volta para IMPLEMENTAÇÃO.

---

## 6. Sistema oficial de evidências

### 6.1 Classes de evidência

Usar os códigos abaixo para tornar relatórios e PRs comparáveis.

| Código | Evidência | Exemplo |
|---|---|---|
| E01 | Estado Git | branch, commit-base, `git status` |
| E02 | Diff | `git diff --stat`, diff revisto, `git diff --check` |
| E03 | Teste automático | comando + resultado + quantidade de testes |
| E04 | Build/Typecheck | comando + exit status/resultados |
| E05 | Segurança/autorização | 401/403, acesso permitido/proibido |
| E06 | Multi-tenant | tentativa A→B rejeitada |
| E07 | Persistência | dados após restart/nova sessão |
| E08 | Base de dados | migrations, constraints, readiness |
| E09 | UI visual | screenshot por viewport/estado relevante |
| E10 | Fluxo manual | passos, perfil, resultado esperado/obtido |
| E11 | Auditoria/logs | evento registado e ausência de dados sensíveis |
| E12 | Contrato/API | request/response sanitizados e schema esperado |
| E13 | IA | input minimizado, confirmação, fallback, rastreabilidade |
| E14 | Documentação | ficheiro/ADR atualizado |
| E15 | Risco | registo P0–P3 com decisão/owner |

### 6.2 Regra de validade

Uma evidência deve responder a cinco perguntas:

1. **O quê** foi verificado?
2. **Como** foi verificado?
3. **Onde** foi verificado?
4. **Qual foi o resultado?**
5. **A que critério de aceitação corresponde?**

Evidências como “testado”, “funciona”, “parece correto” ou “Codex confirmou” são inválidas sem suporte observável.

### 6.3 Resultado padronizado

Cada verificação deve usar um dos estados:

- **PASS** — executado e aprovado.
- **FAIL** — executado e reprovado.
- **BLOCKED** — não pode ser executado por impedimento documentado.
- **NOT RUN** — não executado.
- **N/A** — comprovadamente não aplicável.

Nunca converter BLOCKED ou NOT RUN em PASS.

---

## 7. Matriz Critério → Evidência

Toda Missão deve manter uma matriz mínima:

| ID | Critério de aceitação | Evidência exigida | Estado | Referência |
|---|---|---|---|---|
| AC-01 | Exemplo: utilizador sem permissão recebe 403 | E05 | NOT RUN | — |
| AC-02 | Exemplo: dados persistem após restart | E07 | NOT RUN | — |

A Missão não pode ser DONE enquanto existir critério obrigatório em FAIL, BLOCKED ou NOT RUN.

---

## 8. Template de relatório de execução Codex

```markdown
# Relatório — MISSÃO NN / Passo X

## Contexto
- Branch:
- Commit-base:
- Issue:
- Modo: ANALISAR | IMPLEMENTAR | VALIDAR

## Âmbito executado
- ...

## Ficheiros
### Alterados
- ...
### Inspecionados
- ...

## Comandos e evidências
| Código | Comando/ação | Resultado | Critério |
|---|---|---|---|
| E04 | npm run typecheck | PASS | AC-03 |

## Critérios
| ID | Estado | Evidência |
|---|---|---|
| AC-01 | PASS | E05 ... |

## Riscos
- P0:
- P1:
- P2:
- P3:

## Alterações fora do plano
- Nenhuma | [descrever e justificar]

## Bloqueios
- Nenhum | [descrever]

## Próxima ação recomendada
- ...
```

---

## 9. Template de evidência manual

```markdown
### E10 — Validação manual

- Data/hora:
- Ambiente:
- Commit/PR:
- Dispositivo/viewport:
- Instituição:
- Perfil:
- Pré-condição:
- Passos:
  1. ...
  2. ...
- Resultado esperado:
- Resultado obtido:
- Estado: PASS | FAIL | BLOCKED | NOT RUN
- Screenshot/log sanitizado:
- Critério relacionado:
```

Não incluir passwords, tokens, cookies, segredos ou dados pessoais desnecessários nas evidências.

---

## 10. Regras para screenshots

Screenshots são evidência de UI, não evidência suficiente de autorização backend, persistência ou segurança.

Quando usados:

- identificar viewport/dispositivo;
- mostrar apenas dados de teste apropriados;
- evitar informação pessoal real;
- capturar estados relevantes, não apenas o happy path;
- ligar cada screenshot a um critério de aceitação.

---

## 11. Regras para testes automáticos

Um teste só conta como evidência se for possível identificar:

- comando executado;
- âmbito do teste;
- resultado;
- falhas/skips relevantes;
- commit/estado do código ao qual se refere.

“Os testes passaram antes desta alteração” não prova a alteração atual.

---

## 12. Regras para riscos P0–P3

### P0 — Crítico

Risco de violação grave de segurança/isolamento, corrupção/perda crítica de dados, indisponibilidade fundamental ou comportamento que bloqueia utilização segura.

**Efeito:** bloqueia merge e DONE.

### P1 — Alto

Falha relevante em fluxo essencial, autorização, consistência de dados ou regressão com impacto elevado.

**Efeito:** bloqueia DONE; merge só por exceção formal explicitamente aprovada.

### P2 — Médio

Problema real com workaround aceitável ou impacto limitado, sem comprometer segurança fundamental ou integridade crítica.

**Efeito:** pode ser diferido apenas com issue/owner e decisão explícita.

### P3 — Baixo

Melhoria, inconsistência menor ou dívida sem impacto relevante imediato.

**Efeito:** pode ser registado para backlog.

---

## 13. Política de exceções

Exceção não significa ignorar um gate.

Toda exceção deve registar:

- regra não satisfeita;
- motivo;
- impacto;
- risco P0–P3;
- mitigação temporária;
- owner;
- prazo ou condição de resolução;
- aprovação explícita.

P0 não admite exceção para merge.

---

## 14. Gate de início de implementação

Antes do primeiro prompt em modo IMPLEMENTAR, confirmar:

```text
MISSÃO: READY
ANÁLISE: APROVADA
PLANO: APROVADO
PASSO ATUAL: DELIMITADO
TESTES: DEFINIDOS
RISCOS: CONHECIDOS
ÁREAS PROIBIDAS: EXPLÍCITAS
```

Se uma linha não puder ser confirmada, o Codex permanece em análise/planeamento.

---

## 15. Gate de encerramento

Antes de declarar DONE, confirmar:

```text
CRITÉRIOS: TODOS PASS/N/A JUSTIFICADO
TESTES: PASS
BUILDS: PASS
DIFF: REVISTO
SEGURANÇA: PASS QUANDO APLICÁVEL
PERSISTÊNCIA: PASS QUANDO APLICÁVEL
MULTIDISPOSITIVO: PASS QUANDO APLICÁVEL
EVIDÊNCIAS: ANEXADAS
P0: ZERO
P1: ZERO OU EXCEÇÃO FORMAL
DOCUMENTAÇÃO: ATUALIZADA
PR: REVISTA
```

---

## 16. Regra de continuidade entre sessões

Nenhuma sessão Codex pode ser a única fonte do estado do projeto.

Ao terminar uma sessão, persistir na issue/PR:

- último passo concluído;
- último commit/estado Git relevante;
- testes executados;
- evidências;
- riscos;
- bloqueios;
- próximo passo exato.

Assim, uma nova sessão, pessoa ou agente consegue continuar sem depender da memória da conversa anterior.

---

## 17. Aplicação imediata ao Objetivo Estratégico 01

As Missões 01–07 existentes continuam válidas. Este documento adiciona o mecanismo de prova para executá-las.

A próxima missão em implementação deve respeitar a ordem de dependências já aprovada. Antes de qualquer alteração de código, a missão ativa deve ser convertida para a matriz:

**Critério de aceitação → Evidência necessária → Estado → Referência.**

Em particular, a MISSÃO 01 deve produzir a fotografia técnica que permitirá classificar com segurança o trabalho já existente antes de RBAC, isolamento institucional, persistência, WebSocket e auditoria avançarem.

---

## 18. Regra final

> **Código sem prova é trabalho incompleto. Prova sem critério é ruído. Critério sem fonte de verdade é ambiguidade.**

O Nexus avança apenas quando os três estão ligados: **decisão → implementação → evidência**.