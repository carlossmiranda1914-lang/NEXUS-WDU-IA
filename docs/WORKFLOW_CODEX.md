# Nexus Edu IA — Workflow Oficial de Desenvolvimento com Codex

## 1. Objetivo

Este documento define o fluxo de trabalho obrigatório para qualquer alteração técnica no Nexus Edu IA.

O objetivo é tornar a programação:

- leve e previsível;
- segura e reproduzível;
- fácil de rever;
- resistente a regressões;
- alinhada com a Arquitetura Oficial, Plano Mestre e Design System;
- adequada ao uso do Codex sem prompts gigantes nem alterações difusas.

> Regra central: **analisar primeiro, alterar pouco, testar cedo, rever sempre, integrar apenas com evidência.**

---

## 2. Princípios não negociáveis

1. **Uma missão ativa de implementação de cada vez.**
2. **Nenhuma implementação começa sem objetivo, âmbito, critérios de aceitação e testes.**
3. **O Codex analisa antes de editar.**
4. **Prompts de implementação devem ser pequenos e verificáveis.**
5. **Nenhum commit, push, merge ou deploy ocorre sem revisão do diff e validação.**
6. **O frontend nunca é a única camada de segurança.**
7. **Falhas reais nunca são convertidas em sucesso visual ou listas vazias.**
8. **Mudanças arquiteturais precisam de decisão documentada antes do código.**
9. **O cliente não define livremente contexto sensível como instituição, perfil ou permissões.**
10. **A documentação e o GitHub devem permanecer sincronizados com a baseline aprovada.**

---

## 3. Hierarquia de fonte de verdade

Quando houver conflito, a equipa deve resolver a divergência antes de programar.

Ordem de referência:

1. **Decisão de produto aprovada**
2. **Arquitetura Oficial**
3. **Plano Mestre Integrado**
4. **Design System Oficial**
5. **ADR / decisão técnica aprovada**
6. **Issue / missão ativa**
7. **Código atual**

O código atual não deve ser tratado automaticamente como comportamento desejado. Pode conter dívida, implementação incompleta ou decisões antigas.

---

## 4. Unidade de trabalho

A unidade padrão de desenvolvimento é uma **Missão**.

Cada missão deve conter:

- problema;
- objetivo;
- contexto;
- dependências;
- dentro do âmbito;
- fora do âmbito;
- critérios de aceitação;
- testes obrigatórios;
- evidências esperadas;
- riscos conhecidos;
- prompt de análise;
- Definition of Done.

Uma missão grande deve ser dividida em **tarefas técnicas pequenas**, idealmente capazes de produzir um diff fácil de compreender numa única revisão.

---

## 5. Fluxo de desenvolvimento obrigatório

### Fase 0 — Preparar a missão

Antes de abrir o Codex:

- confirmar a issue ativa;
- confirmar dependências;
- identificar documentação oficial relevante;
- definir o resultado observável esperado;
- indicar explicitamente o que não pode ser alterado;
- definir os testes que provarão a conclusão.

**Saída:** brief curto e inequívoco.

### Fase 1 — Análise somente leitura

O primeiro prompt ao Codex deve proibir alterações.

O Codex deve:

- mapear ficheiros relevantes;
- localizar fluxos atuais;
- identificar contratos, dependências e pontos de segurança;
- comparar comportamento atual com requisitos;
- classificar riscos P0, P1, P2 e P3;
- sugerir o menor plano possível.

**Gate A — Aprovação da análise**

Não avançar enquanto não for claro:

- o que será alterado;
- porquê;
- quais ficheiros deverão mudar;
- quais testes deverão provar o resultado.

### Fase 2 — Plano de implementação

O Codex produz um plano em passos pequenos.

Cada passo deve indicar:

- ficheiros previstos;
- alteração concreta;
- risco;
- teste correspondente;
- dependência do passo seguinte.

**Regra:** se o plano mistura segurança, dados, UI e novas funcionalidades na mesma alteração, deve ser dividido.

### Fase 3 — Implementação controlada

Executar **um passo do plano de cada vez**.

Prompt recomendado:

```text
Implementa apenas o Passo X aprovado da MISSÃO NN.

Objetivo observável:
[resultado]

Ficheiros esperados:
[lista]

Não alterar:
[limites]

Critérios de aceitação deste passo:
[lista]

Testes a executar:
[lista]

No final:
1. resume o que alteraste;
2. lista ficheiros modificados;
3. mostra testes executados e resultados;
4. indica riscos ou dúvidas restantes;
5. não cries commit, não faças push e não faças deploy.
```

### Fase 4 — Validação técnica imediata

Depois de cada passo, executar apenas o conjunto relevante, aumentando progressivamente:

1. lint / formatação quando aplicável;
2. TypeScript;
3. testes unitários afetados;
4. testes de integração afetados;
5. build do componente afetado;
6. testes completos apenas quando o passo estiver estável.

Não acumular muitos passos sem testes.

### Fase 5 — Revisão do diff

Antes de qualquer commit:

- rever `git diff --stat`;
- rever o diff completo;
- executar `git diff --check`;
- procurar segredos, tokens e dados sensíveis;
- confirmar que não existem ficheiros temporários;
- confirmar que o diff corresponde ao âmbito aprovado;
- verificar regressões e alterações acidentais.

**Gate B — Diff aprovado**

Se houver código não explicado pelo plano, o commit fica bloqueado.

### Fase 6 — Commit pequeno e coerente

Um commit deve representar uma intenção compreensível.

Evitar commits com mistura de:

- refatoração cosmética;
- mudança funcional;
- alteração de schema;
- segurança;
- documentação não relacionada.

Formato recomendado:

```text
<tipo>(<área>): <resultado concreto>
```

Exemplos:

```text
fix(auth): enforce backend role checks for finance routes
feat(student): persist guardian-student associations
refactor(ws): scope events by institution membership
docs(architecture): record mobile navigation decision
```

### Fase 7 — Pull Request e revisão

Toda alteração relevante deve passar por PR.

A PR deve declarar:

- problema resolvido;
- issue/missão;
- alterações principais;
- evidências;
- testes;
- riscos restantes;
- passos de validação manual;
- screenshots quando UI for alterada.

### Fase 8 — Validação manual

Para fluxos funcionais, validar no browser o caminho real do utilizador.

Quando aplicável, testar:

- desktop;
- tablet;
- mobile;
- perfis diferentes;
- duas instituições distintas;
- estados vazios, sucesso, erro e loading;
- sessão expirada;
- permissões negadas;
- persistência após nova sessão.

### Fase 9 — Gate de merge

Merge apenas quando:

- critérios de aceitação concluídos;
- testes passam;
- builds passam;
- riscos P0 = 0;
- diff revisto;
- documentação afetada atualizada;
- validação manual concluída quando aplicável.

### Fase 10 — Pós-merge

Após merge:

- confirmar CI;
- atualizar issue;
- registar limitações restantes;
- fechar apenas trabalho efetivamente concluído;
- selecionar a próxima missão conforme dependências, não por impulso.

---

## 6. Política de prompts para Codex

### 6.1 Prompt nunca deve começar por “melhora tudo”

Prompts genéricos criam alterações grandes, difíceis de verificar e com maior probabilidade de regressão.

### 6.2 Um prompt deve conter cinco blocos

1. **Contexto**
2. **Objetivo**
3. **Âmbito permitido**
4. **Proibições**
5. **Evidência de conclusão**

### 6.3 Dois modos obrigatórios

**Modo A — ANALISAR**

Não altera ficheiros.

**Modo B — IMPLEMENTAR**

Executa apenas um plano previamente aprovado.

Nunca misturar análise exploratória extensa com uma implementação ampla no mesmo prompt.

---

## 7. Orçamento de mudança

Antes de implementar, classificar a alteração:

### XS

- 1–2 ficheiros;
- risco baixo;
- sem schema, auth ou contratos.

Pode ser concluída num ciclo curto.

### S

- poucos ficheiros;
- fluxo isolado;
- testes claros.

Um commit principal.

### M

- vários módulos ou camadas;
- contrato API ou persistência;
- segurança ou permissões.

Deve ser dividida em subtarefas e commits.

### L / XL

Não implementar diretamente.

Deve ser transformada em objetivo + missões menores antes de entrar no Codex.

---

## 8. Gates especiais por tipo de mudança

### Segurança / RBAC

Obrigatório:

- testes positivos e negativos;
- acesso direto à API;
- 401 e 403;
- testes cruzados entre perfis;
- verificação no backend.

### Multi-instituição

Obrigatório:

- instituição A não lê/escreve B;
- contexto resolvido no servidor;
- IDs manipulados no cliente não concedem acesso;
- jobs, uploads e WebSocket incluídos na análise.

### Base de dados

Obrigatório:

- migrations desde base vazia;
- constraints;
- persistência após restart;
- comportamento com PostgreSQL indisponível;
- ausência de fallback silencioso em produção.

### UI / UX multidispositivo

Obrigatório:

- desktop, tablet e mobile;
- não apenas “desktop encolhido”;
- conteúdo prioritário por dispositivo;
- estados loading / vazio / erro / sucesso;
- acessibilidade básica e targets táteis adequados.

### IA

Obrigatório:

- distinguir sugestão de ação executada;
- validação humana para ações sensíveis;
- rastreabilidade;
- minimizar dados enviados ao modelo;
- fallback seguro;
- nenhum resultado probabilístico tratado como verdade transacional.

---

## 9. Fluxo de benchmark e pesquisa de mercado

Referências externas não devem entrar diretamente no código.

O fluxo obrigatório é:

```text
Sistema de referência
        ↓
Observação verificável
        ↓
Problema que resolve
        ↓
Princípio reutilizável
        ↓
Compatibilidade com Nexus
        ↓
Decisão: adotar / adaptar / rejeitar
        ↓
ADR ou decisão de produto
        ↓
Issue técnica
        ↓
Codex
```

### Ficha de benchmark

Para cada sistema analisado, guardar:

- nome e versão/data observada;
- mercado e público-alvo;
- screenshots ou links de evidência;
- fluxo analisado;
- pontos fortes;
- fricções;
- padrão visual;
- padrão funcional;
- hipótese de aplicação ao Nexus;
- riscos de copiar sem adaptação;
- decisão final: adotar, adaptar ou rejeitar.

### Regra de propriedade intelectual

Benchmark serve para aprender padrões e resolver problemas, não para copiar código proprietário, identidade visual, textos ou assets de terceiros.

Se houver código open source, a licença deve ser verificada antes de qualquer reutilização.

---

## 10. Backlog de pesquisa de mercado

A pesquisa futura deve ser organizada por tema, não como uma coleção de links.

Categorias recomendadas:

1. **SIS / Gestão escolar** — alunos, matrículas, notas, assiduidade, famílias.
2. **Financeiro escolar** — cobranças, recibos, reconciliação e pendências.
3. **LMS / experiência pedagógica** — tarefas, conteúdos e acompanhamento.
4. **Portais de aluno e encarregado** — mobile-first, comunicação e autoatendimento.
5. **Admin dashboards** — prioridades, exceções, pesquisa e produtividade.
6. **RBAC / multi-tenant SaaS** — isolamento, delegação e auditoria.
7. **IA em educação e operações** — assistentes, resumo, alertas e apoio à decisão.
8. **Onboarding e configuração institucional** — implementação gradual e adoção.

Cada análise deve responder: **“que problema real do Nexus isto ajuda a resolver?”**

---

## 11. Checklist antes de abrir o Codex

- [ ] Existe uma issue ativa?
- [ ] O objetivo é observável?
- [ ] O âmbito está pequeno?
- [ ] O fora do âmbito está explícito?
- [ ] A documentação oficial aplicável foi identificada?
- [ ] Sabemos quais testes provarão o resultado?
- [ ] O primeiro prompt é análise read-only?
- [ ] Existe risco de segurança, dados ou multi-tenant?
- [ ] A alteração precisa de ADR?
- [ ] A mudança cabe num ciclo de revisão compreensível?

Se duas ou mais respostas forem “não”, a tarefa ainda não está pronta para implementação.

---

## 12. Checklist de saída de uma sessão Codex

Antes de terminar uma sessão:

- [ ] estado do trabalho registado;
- [ ] ficheiros alterados conhecidos;
- [ ] testes e resultados registados;
- [ ] riscos restantes registados;
- [ ] nenhuma alteração inexplicada;
- [ ] nenhuma tarefa crítica fica apenas “na memória do chat”;
- [ ] issue atualizada;
- [ ] próxima ação inequívoca.

---

## 13. Métrica de qualidade do processo

O processo está a funcionar quando:

- os prompts ficam menores ao longo do tempo;
- cada diff é mais fácil de compreender;
- regressões diminuem;
- menos trabalho precisa ser refeito;
- cada sessão pode ser retomada por outro agente ou pessoa;
- decisões deixam de depender da memória da conversa;
- a baseline permanece reproduzível;
- os resultados do Codex são verificáveis por evidência.

---

## 14. Regra final

> **O Codex não decide a arquitetura enquanto implementa. A arquitetura decide o trabalho que o Codex executa.**

O Nexus deve evoluir por pequenas provas acumuladas: cada missão reduz incerteza, cada teste cria confiança e cada merge deixa a plataforma mais estável do que estava antes.