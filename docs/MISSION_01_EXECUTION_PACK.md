# Nexus Edu IA — MISSÃO 01 Execution Pack

## 1. Identificação

**Issue:** #1 — MISSÃO 01 — Consolidar e validar o estado atual do projeto  
**Objetivo pai:** #3 — OBJETIVO ESTRATÉGICO 01 — Estabilizar a Plataforma  
**Estado operacional:** READY PARA ANÁLISE, não READY para implementação  
**Prioridade:** P0  
**Tamanho:** M para análise; qualquer correção descoberta deve ser decomposta antes de implementação.

---

## 2. Objetivo

Produzir uma fotografia técnica confiável do estado atual do Nexus Edu IA antes de novas alterações funcionais.

A Missão 01 não existe para “corrigir tudo”. Existe para transformar incerteza em inventário verificável.

---

## 3. Resultado observável

Ao terminar a análise devemos conseguir responder, com evidências:

1. qual é o estado Git real;
2. que trabalho está efetivamente presente no repositório;
3. que áreas estão concluídas, parciais, incompletas ou arriscadas;
4. que testes/builds existem e quais passam;
5. que riscos P0–P3 permanecem;
6. que trabalho pode ser preservado;
7. qual é a menor sequência segura de correções/commits;
8. se a MISSÃO 02 pode começar ou permanece bloqueada.

---

## 4. Dentro do âmbito

- estado Git e baseline;
- estrutura do repositório;
- Fundação;
- RBAC existente;
- Aluno;
- Encarregado;
- WebSocket;
- Interface relacionada com trabalho já existente;
- referências demonstrativas funcionais;
- testes/builds/configuração existentes;
- riscos e plano de preservação.

## 5. Fora do âmbito

- novas funcionalidades;
- correções automáticas durante a análise;
- redesenho visual;
- refatoração ampla;
- criação de novos perfis;
- novas integrações;
- deploy;
- mudança arquitetural não aprovada;
- merge ou push de alterações de produção.

---

## 6. Critérios de aceitação e matriz inicial

| ID | Critério | Evidência | Estado inicial |
|---|---|---|---|
| AC-01 | Branch, commit-base e estado Git documentados | E01 | NOT RUN |
| AC-02 | Alterações/estado organizados por Fundação, RBAC, Aluno, Encarregado, WebSocket e Interface | E02 | NOT RUN |
| AC-03 | Itens concluídos, parciais, incompletos e arriscados separados | E02/E15 | NOT RUN |
| AC-04 | TypeScript executado com resultado registado | E04 | NOT RUN |
| AC-05 | Testes relevantes executados ou limitações explicitamente registadas | E03 | NOT RUN |
| AC-06 | Build frontend executado com resultado | E04 | NOT RUN |
| AC-07 | Build servidor executado com resultado | E04 | NOT RUN |
| AC-08 | `git diff --check` executado | E02 | NOT RUN |
| AC-09 | Diff/estado revisto para segredos e tokens | E02/E15 | NOT RUN |
| AC-10 | Referências funcionais demonstrativas como `ALU-101` classificadas | E02 | NOT RUN |
| AC-11 | Estado atual das permissões dos sete perfis mapeado | E05/E12 | NOT RUN |
| AC-12 | Estado atual do isolamento WebSocket mapeado | E12/E15 | NOT RUN |
| AC-13 | Plano mínimo de preservação/correção/commits produzido | E14/E15 | NOT RUN |
| AC-14 | Riscos P0–P3 registados | E15 | NOT RUN |
| AC-15 | Próxima missão recomendada com justificação | E14/E15 | NOT RUN |

Nenhum destes estados pode ser convertido em PASS sem execução/evidência real.

---

## 7. Perguntas obrigatórias da análise

### Git
- Qual é a branch atual?
- Qual é o commit-base?
- O working tree está limpo ou existem alterações locais não representadas no remoto?
- Existem branches com trabalho não integrado relevante?

### Fundação
- Configuração de ambiente está coerente?
- Existem fallbacks silenciosos?
- Health/readiness representam falhas reais?
- O setup é reproduzível?

### RBAC
- Onde está a política central?
- Que rotas verificam permissões no backend?
- Que permissões existem apenas no frontend?
- Como os sete perfis são resolvidos?

### Aluno e Encarregado
- Associações são reais/persistidas ou demonstrativas?
- Existem IDs fixos?
- O aluno pode pedir dados de outro aluno?
- O encarregado pode selecionar educando não associado?

### WebSocket
- Como autentica?
- Como resolve utilizador/perfil/instituição?
- Existem broadcasts globais?
- O cliente escolhe salas/contexto livremente?

### Interface
- Existem dados técnicos expostos?
- Existem estados de erro convertidos em vazio/sucesso?
- Existem mocks apresentados como dados reais?

---

## 8. Prompt oficial — Codex / Análise 01

```text
MODO: ANALISAR — SOMENTE LEITURA

Estás no repositório Nexus Edu IA.
Executa a MISSÃO 01: Consolidar e validar o estado atual do projeto.

OBJETIVO
Produzir uma fotografia técnica confiável do estado atual sem alterar nenhum ficheiro.

ÂMBITO
- estado Git e baseline;
- Fundação;
- RBAC;
- Aluno;
- Encarregado;
- WebSocket;
- Interface relacionada;
- testes/builds/configuração;
- identificadores demonstrativos;
- riscos e plano de preservação.

FORA DO ÂMBITO
- novas funcionalidades;
- correções;
- refatorações;
- redesign;
- deploy;
- commits/push/merge.

CRITÉRIOS
AC-01 Estado Git documentado.
AC-02 Estado organizado por Fundação/RBAC/Aluno/Encarregado/WebSocket/Interface.
AC-03 Concluído/parcial/incompleto/arriscado separado.
AC-04 TypeScript com resultado.
AC-05 Testes relevantes com resultado ou limitação explícita.
AC-06 Build frontend com resultado.
AC-07 Build servidor com resultado.
AC-08 git diff --check com resultado.
AC-09 Segredos/tokens revistos.
AC-10 ALU-101 e equivalentes classificados.
AC-11 Permissões dos sete perfis mapeadas.
AC-12 Isolamento WebSocket mapeado.
AC-13 Plano mínimo de preservação/correção/commits.
AC-14 Riscos P0-P3.
AC-15 Próxima missão recomendada.

EXECUÇÃO
1. Confirma branch, HEAD/commit-base e git status.
2. Executa git diff --stat e git diff --check quando aplicável.
3. Mapeia a estrutura relevante do repositório.
4. Agrupa o estado por Fundação, RBAC, Aluno, Encarregado, WebSocket e Interface.
5. Classifica cada bloco: CONCLUÍDO, PARCIAL, INCOMPLETO ou ARRISCADO.
6. Procura ALU-101, IDs fixos, mocks, fallbacks silenciosos, permissões apenas visuais e exposição técnica.
7. Mapeia a autorização atual de Administrador Geral, Direção, Secretaria, Tesouraria/Financeiro, Professor, Aluno e Encarregado.
8. Mapeia autenticação/autorização/isolamento do WebSocket.
9. Identifica scripts de TypeScript, testes e builds existentes.
10. Executa apenas comandos de validação que não modifiquem o repositório; regista comando, resultado e limitações.
11. Não instales/atualizes dependências se isso modificar lockfiles ou estado do projeto. Se dependências impedirem testes, marca BLOCKED e explica.
12. Revê o estado/diff disponível para segredos, tokens e dados sensíveis sem os reproduzir no relatório.
13. Produz riscos P0, P1, P2 e P3.
14. Propõe a menor sequência de trabalho para preservar o que está correto e corrigir o restante.
15. Recomenda se a MISSÃO 02 está READY, BLOQUEADA ou necessita subtarefa prévia.

PROIBIDO
- alterar ficheiros;
- aplicar fixes;
- formatar automaticamente;
- instalar/atualizar dependências que alterem ficheiros;
- criar commit;
- push;
- merge;
- deploy.

FORMATO DE SAÍDA
A. Estado Git
B. Estrutura técnica relevante
C. Inventário por área
D. Matriz AC-01..AC-15 com PASS/FAIL/BLOCKED/NOT RUN/N/A e evidência
E. Testes/builds executados
F. Segurança e dados
G. Riscos P0-P3
H. Plano mínimo numerado
I. Proposta de commits futuros (sem os criar)
J. Decisão sobre MISSÃO 02
K. Handoff exato para a próxima sessão
```

---

## 9. Gate depois da resposta Codex

Não implementar imediatamente.

Primeiro verificar:

- [ ] todos AC-01..AC-15 possuem estado;
- [ ] PASS possui evidência;
- [ ] BLOCKED explica causa;
- [ ] nenhum NOT RUN foi chamado de sucesso;
- [ ] nenhum ficheiro foi alterado;
- [ ] riscos P0/P1 estão claros;
- [ ] plano proposto não mistura missões;
- [ ] correções foram divididas em passos pequenos;
- [ ] decisão sobre MISSÃO 02 é suportada por evidência.

---

## 10. Decisão de execução

A MISSÃO 01 está **READY PARA ANÁLISE** porque já possui problema, objetivo, âmbito, fora do âmbito, critérios, evidências esperadas e prompt read-only.

Ela **não está autorizada para implementação** até a análise real do repositório produzir o plano mínimo e esse plano passar pelo Gate da Análise.

---

## 11. Regra final

> A primeira vitória da MISSÃO 01 não é escrever código. É deixar de adivinhar o estado do código.