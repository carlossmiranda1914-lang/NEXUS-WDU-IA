# MISSÃO 01 — Consolidar e validar o estado atual do projeto

## Estado

**READY PARA ANÁLISE READ-ONLY**

> Este estado autoriza apenas a fotografia técnica. Não autoriza correções de código.

## Classificação

- Prioridade: **P0**
- Tamanho da análise: **M**
- Tipo: **Fundação / Qualidade / Segurança**
- Objetivo estratégico: **Objetivo Estratégico 01 — Estabilizar a Plataforma**
- Issue: **#1**

---

## 1. Problema

Existe trabalho técnico anterior no Nexus Edu IA cuja condição real precisa ser comprovada antes de novas funcionalidades ou correções amplas. Há histórico de alterações em Fundação, RBAC, perfis de Aluno/Encarregado, WebSocket e Interface que não devem ser tratados como concluídos sem inspeção e evidência.

## 2. Objetivo

Produzir uma fotografia técnica reproduzível do repositório que permita separar:

- concluído e comprovado;
- implementado mas não comprovado;
- parcial;
- incompleto;
- inseguro/arriscado;
- fora do âmbito.

A missão termina apenas quando existir um plano seguro para preservar, corrigir ou separar o trabalho existente.

## 3. Valor

Esta missão reduz o risco de construir novas funcionalidades sobre uma baseline desconhecida e fornece a referência necessária para RBAC, multi-instituição, PostgreSQL, WebSocket, auditoria e encerramento da Fundação.

---

## 4. Fontes de verdade

1. decisões de produto aprovadas;
2. Arquitetura Oficial multidispositivo;
3. Plano Mestre Integrado;
4. Design System Oficial quando houver UI;
5. `docs/WORKFLOW_CODEX.md`;
6. `docs/DEFINITION_READY_DONE_EVIDENCE.md`;
7. Issue #1 e Objetivo Estratégico #3;
8. código atual — como evidência do estado implementado, não automaticamente como comportamento desejado.

### Conflitos

Qualquer conflito entre código e documentação deve ser registado; não deve ser “corrigido” durante a análise.

---

## 5. Dentro do âmbito

- estado Git e baseline;
- inventário do diff/trabalho existente quando aplicável;
- Fundação;
- RBAC;
- Aluno;
- Encarregado;
- WebSocket;
- Interface relacionada ao trabalho pendente;
- identificação de mocks/IDs demonstrativos funcionais;
- identificação de riscos de dados/segurança;
- mapa dos testes/builds que devem ser executados;
- plano mínimo de preservação/correção/commits.

## 6. Fora do âmbito

- alterar código;
- corrigir problemas encontrados;
- criar novas funcionalidades;
- redesign;
- novas integrações;
- deploy;
- push de código de produto;
- refatoração;
- alterações de schema;
- mudança de arquitetura durante a análise.

---

## 7. Critérios de aceitação e evidências

| ID | Critério | Evidência | Estado |
|---|---|---|---|
| AC-01 | Branch, commit-base e estado Git conhecidos | E01 | NOT RUN |
| AC-02 | Alterações existentes agrupadas por área | E02 | NOT RUN |
| AC-03 | Cada bloco classificado como comprovado, não comprovado, parcial, incompleto ou arriscado | E02/E15 | NOT RUN |
| AC-04 | Ficheiros relevantes identificados | E02 | NOT RUN |
| AC-05 | Nenhum segredo/token aparente no trabalho analisado | E02/E15 | NOT RUN |
| AC-06 | Estado de referências funcionais a `ALU-101` e IDs demonstrativos conhecido | E02 | NOT RUN |
| AC-07 | Superfície atual de RBAC mapeada | E05/E15 | NOT RUN |
| AC-08 | Superfície atual de WebSocket mapeada | E12/E15 | NOT RUN |
| AC-09 | Comandos de TypeScript/testes/builds aplicáveis identificados | E03/E04 | NOT RUN |
| AC-10 | Plano mínimo de validação/commits produzido | E02/E15 | NOT RUN |
| AC-11 | Riscos P0-P3 registados | E15 | NOT RUN |
| AC-12 | Próxima missão recomendada com justificação | E15 | NOT RUN |

### Nota

Nesta primeira passagem **identificar comandos** é obrigatório. Executá-los poderá exigir uma sessão com ambiente de checkout/execução. Nenhum teste não executado será marcado PASS.

---

## 8. Riscos a procurar explicitamente

### P0/P1 candidatos — não presumidos

- autorização apenas visual;
- dados de uma instituição/perfil expostos a outro;
- broadcasts WebSocket globais com dados;
- fallback silencioso de persistência;
- dados demonstrativos usados em fluxos reais;
- segredos/tokens em ficheiros ou diff;
- erro real apresentado como sucesso;
- alteração ampla anterior sem separação segura.

A presença destes itens deve ser comprovada no código antes de classificá-los como achados.

---

## 9. Prompt oficial — primeira execução Codex

```text
Estás a trabalhar no repositório Nexus Edu IA.

MISSÃO: #1 — Consolidar e validar o estado atual do projeto
MODO: ANALISAR SOMENTE LEITURA

OBJETIVO
Produzir uma fotografia técnica reproduzível do estado atual antes de qualquer nova implementação.

FONTES DE VERDADE
1. decisões de produto aprovadas;
2. Arquitetura Oficial;
3. Plano Mestre Integrado;
4. Design System quando aplicável;
5. docs/WORKFLOW_CODEX.md;
6. docs/DEFINITION_READY_DONE_EVIDENCE.md;
7. Issue #1 e Objetivo Estratégico #3.

DENTRO DO ÂMBITO
- estado Git/baseline;
- Fundação;
- RBAC;
- Aluno;
- Encarregado;
- WebSocket;
- Interface relacionada;
- mocks/IDs demonstrativos;
- segurança e dados;
- testes/builds existentes;
- plano mínimo de preservação/correção.

FORA DO ÂMBITO
- qualquer alteração de ficheiro;
- correções;
- novas funcionalidades;
- refatorações;
- alterações de schema;
- deploy;
- commit/push.

CRITÉRIOS
AC-01 a AC-12 definidos em docs/missions/MISSION_01_READINESS.md.

EXECUTA
1. Confirma branch, HEAD/commit-base, git status e git diff --stat.
2. Se existir working tree alterado, agrupa cada alteração por Fundação, RBAC, Aluno, Encarregado, WebSocket, Interface ou Fora do Âmbito.
3. Se o working tree estiver limpo, identifica no histórico/estado atual os blocos relevantes da implementação anterior e deixa isso explícito.
4. Classifica cada bloco: COMPROVADO, NÃO COMPROVADO, PARCIAL, INCOMPLETO ou ARRISCADO. Não uses “concluído” sem evidência.
5. Localiza as superfícies atuais de autenticação/autorização e RBAC.
6. Localiza associações utilizador–aluno–encarregado e procura usos funcionais de ALU-101 ou outros IDs demonstrativos.
7. Localiza servidor/cliente WebSocket, autenticação, salas/subscrições e broadcasts relevantes.
8. Identifica mecanismos de persistência/fallback que possam afetar a fotografia da Fundação, sem executar a MISSÃO 04.
9. Procura apenas por indícios de segredos/tokens no âmbito analisado; não imprimas valores sensíveis encontrados.
10. Identifica scripts/comandos existentes para typecheck, testes e builds. Não inventes comandos.
11. Liga os achados aos critérios AC-01..AC-12.
12. Classifica riscos P0-P3 com ficheiro/fluxo e razão.
13. Propõe a menor sequência segura para preservar/corrigir/validar o trabalho existente.
14. Recomenda a próxima ação, respeitando dependências das Missões 02–07.

PROIBIDO
- alterar ficheiros;
- formatar automaticamente;
- instalar dependências;
- criar commit;
- push;
- deploy;
- aumentar o âmbito;
- tratar ausência de teste como PASS;
- expor segredos no relatório.

FORMATO FINAL
A. Estado Git
B. Fotografia executiva
C. Inventário por área
D. Matriz AC → estado → evidência
E. Superfície RBAC
F. Aluno/Encarregado e IDs demonstrativos
G. WebSocket
H. Persistência relevante à fotografia
I. Scripts/testes/builds disponíveis
J. Riscos P0-P3
K. Plano mínimo sequencial
L. Bloqueios
M. Próxima ação recomendada

Não implementes nada.
```

---

## 10. Gate antes da execução

- [x] Issue única existe (#1)
- [x] Objetivo observável definido
- [x] Dentro/fora do âmbito definidos
- [x] Fontes de verdade identificadas
- [x] Critérios AC-* definidos
- [x] Evidências exigidas definidas
- [x] Riscos candidatos explicitados sem os presumir como factos
- [x] Prompt read-only preparado
- [x] Commit/push/deploy proibidos
- [x] Próxima implementação permanece bloqueada até a análise

**Decisão:** MISSÃO 01 está pronta para a etapa de ANÁLISE READ-ONLY.

---

## 11. O que não está aprovado ainda

- nenhuma correção de código;
- nenhum plano de commits de produto;
- nenhuma declaração de TypeScript/build/testes PASS;
- nenhuma conclusão de RBAC;
- nenhuma conclusão de isolamento institucional;
- nenhuma conclusão de persistência;
- nenhuma conclusão de WebSocket.

Esses estados dependem das evidências produzidas na análise e nas missões seguintes.
