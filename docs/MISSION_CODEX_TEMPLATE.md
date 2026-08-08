# Nexus Edu IA — Template Universal de Missão + Prompts Codex

## 1. Finalidade

Este é o formulário operacional padrão para transformar uma intenção de produto ou correção técnica numa unidade de trabalho segura para o Codex.

Usar em conjunto com:

- `docs/WORKFLOW_CODEX.md`;
- `docs/DEFINITION_READY_DONE_EVIDENCE.md`.

> Regra: **o Codex recebe uma tarefa delimitada; nunca recebe a responsabilidade vaga de “resolver o projeto”.**

---

## 2. Cabeçalho da Missão

```markdown
# MISSÃO NN — [resultado observável]

Estado: BACKLOG | PREPARAÇÃO | READY | ANÁLISE | PLANEADA | IMPLEMENTAÇÃO | VALIDAÇÃO | BLOQUEADA | DONE
Prioridade: P0 | P1 | P2 | P3
Tamanho: XS | S | M | L | XL
Issue: #NN
Owner de decisão: [nome/papel]
Dependências: [issues/ADRs/serviços]
Baseline: [branch/commit]
```

---

## 3. Problema

Descrever o comportamento ou risco atual sem prescrever prematuramente a solução.

```markdown
## Problema

Hoje, [comportamento observável].
Isto provoca [impacto].
A evidência atual é [referência].
```

---

## 4. Objetivo e valor

```markdown
## Objetivo

Quando esta missão terminar, [resultado observável].

## Valor

- Utilizador/negócio: ...
- Técnico: ...
- Segurança/dados: ...
```

---

## 5. Âmbito

```markdown
## Dentro do âmbito
- ...

## Fora do âmbito
- ...

## Áreas explicitamente proibidas
- ...
```

Se uma implementação exigir uma área proibida, parar e devolver a missão para PLANEAMENTO.

---

## 6. Fontes de verdade

```markdown
## Fontes de verdade

1. Arquitetura Oficial: [secção]
2. Plano Mestre: [secção]
3. Design System: [secção/N/A]
4. ADRs: [lista/N/A]
5. Contratos/API/schema: [referências]
6. Issue atual: #NN
```

Conflitos entre fontes devem ser registados antes do modo IMPLEMENTAR.

---

## 7. Dependências

```markdown
## Dependências

### Técnicas
- ...

### Entre Missões
- ...

### Externas
- ...

### Bloqueios conhecidos
- Nenhum | ...
```

---

## 8. Critérios de aceitação

Usar IDs estáveis.

```markdown
## Critérios de aceitação

- AC-01 — [condição verificável]
- AC-02 — [condição verificável]
- AC-03 — [condição verificável]
```

Evitar “melhor”, “mais rápido”, “mais bonito” ou “seguro” sem condição de prova.

---

## 9. Matriz Critério → Evidência

```markdown
| ID | Critério | Evidência | Estado | Referência |
|---|---|---|---|---|
| AC-01 | ... | E03/E05/... | NOT RUN | — |
| AC-02 | ... | E09/E10/... | NOT RUN | — |
```

Estados permitidos: PASS, FAIL, BLOCKED, NOT RUN, N/A.

---

## 10. Riscos iniciais

```markdown
## Riscos

### P0
- Nenhum conhecido | ...

### P1
- ...

### P2
- ...

### P3
- ...
```

Risco desconhecido não deve ser tratado como risco zero.

---

# 11. PROMPT A — ANALISAR

Este é sempre o primeiro prompt para uma missão que toca código existente.

```text
Estás a trabalhar no Nexus Edu IA.

MODO: ANALISAR SOMENTE.
MISSÃO: [NN — título]
ISSUE: #[NN]
BASELINE: [branch/commit]

PROBLEMA
[texto]

OBJETIVO
[texto]

FONTES DE VERDADE
[lista]

DENTRO DO ÂMBITO
[lista]

FORA DO ÂMBITO / ÁREAS PROIBIDAS
[lista]

CRITÉRIOS DE ACEITAÇÃO
[ACs]

TAREFA
1. Confirma branch, commit-base e estado Git relevante.
2. Mapeia os ficheiros, módulos, rotas, contratos, schema e testes relacionados.
3. Explica o comportamento atual com referências concretas ao código.
4. Compara o comportamento atual com os critérios de aceitação e fontes de verdade.
5. Identifica implementação concluída, parcial, ausente e contraditória.
6. Identifica riscos P0, P1, P2 e P3.
7. Identifica dependências e mudanças que exigiriam sair do âmbito.
8. Define os testes necessários para provar cada critério.
9. Propõe o MENOR plano de implementação possível, dividido em passos verificáveis.
10. Para cada passo, indica ficheiros previstos, risco, teste e dependência.

PROIBIDO
- não alteres ficheiros;
- não cries ficheiros;
- não executes migrations destrutivas;
- não cries commits;
- não faças push;
- não abras/merges PR;
- não faças deploy;
- não aumentes o âmbito autonomamente.

SAÍDA OBRIGATÓRIA
A. Estado Git
B. Mapa técnico
C. Gap analysis por AC
D. Riscos P0-P3
E. Testes propostos
F. Plano mínimo numerado
G. Questões/bloqueios
H. Recomendação: READY PARA IMPLEMENTAR ou BLOQUEADA
```

---

# 12. Gate após análise

Antes de usar PROMPT B:

- [ ] análise foi lida;
- [ ] ficheiros propostos fazem sentido;
- [ ] nenhum P0/P1 desconhecido foi ignorado;
- [ ] conflitos documentais foram resolvidos;
- [ ] plano foi reduzido ao mínimo;
- [ ] cada passo tem prova;
- [ ] passo 1 passou no micro-DoR.

---

# 13. PROMPT B — IMPLEMENTAR UM PASSO

```text
Estás a trabalhar no Nexus Edu IA.

MODO: IMPLEMENTAR.
MISSÃO: [NN]
PASSO APROVADO: [X de Y]
BASELINE: [branch/commit]

OBJETIVO OBSERVÁVEL DESTE PASSO
[texto]

FICHEIROS ESPERADOS / ÁREA PERMITIDA
[lista]

NÃO ALTERAR
[lista]

CONTRATOS QUE DEVEM PERMANECER
[lista]

CRITÉRIOS DESTE PASSO
[ACs/subcritérios]

TESTES IMEDIATOS
[lista]

IMPLEMENTA APENAS ESTE PASSO.

Se descobrires que precisas alterar algo fora do âmbito, PARA e reporta. Não expandas a implementação.

NO FINAL
1. Resume exatamente o que alteraste.
2. Lista todos os ficheiros alterados.
3. Lista qualquer ficheiro criado/removido.
4. Mostra comandos/testes executados e resultado PASS/FAIL/BLOCKED/NOT RUN.
5. Liga cada evidência ao critério correspondente.
6. Mostra riscos restantes P0-P3.
7. Declara qualquer desvio do plano.
8. Recomenda a próxima ação.

PROIBIDO
- não implementes o passo seguinte;
- não faças refatorações oportunistas;
- não cries commit;
- não faças push;
- não faças merge;
- não faças deploy.
```

---

# 14. PROMPT C — VALIDAR O PASSO

Usar depois da implementação e antes do commit.

```text
Estás a validar o Nexus Edu IA.

MODO: VALIDAR SOMENTE.
MISSÃO: [NN]
PASSO: [X]

Não alteres ficheiros.

1. Revê git status, git diff --stat e o diff completo do passo.
2. Executa git diff --check.
3. Confirma que todos os ficheiros alterados pertencem ao âmbito.
4. Procura segredos, tokens, dados sensíveis, mocks acidentais e debug temporário.
5. Executa os testes definidos para este passo.
6. Executa typecheck/build relevante quando aplicável.
7. Verifica regressões nos contratos afetados.
8. Atualiza a matriz Critério → Evidência.
9. Classifica riscos P0-P3 restantes.
10. Dá um veredito:
   - PASS PARA COMMIT
   - FAIL — CORRIGIR
   - BLOCKED — [motivo]

Não cries commit, não faças push, merge ou deploy.
```

---

# 15. PROMPT D — PREPARAR COMMIT

Usar apenas depois de validação PASS.

```text
MODO: PREPARAR COMMIT.

Não alteres código.

Com base apenas no diff validado:
1. confirma os ficheiros que pertencem a este commit;
2. identifica qualquer ficheiro que deva ficar fora;
3. propõe uma mensagem de commit no formato <tipo>(<área>): <resultado>;
4. produz o resumo de evidências para a PR;
5. indica se o commit é coerente e reversível.

Não executes commit, push, merge ou deploy sem instrução explícita da etapa de integração.
```

---

# 16. PROMPT E — REVISÃO FINAL DA MISSÃO

```text
MODO: REVISÃO FINAL.
MISSÃO: [NN]

Não alteres ficheiros.

1. Revê todos os critérios AC-xx.
2. Confirma a evidência associada a cada critério.
3. Confirma testes, builds e validações manuais aplicáveis.
4. Confirma segurança, persistência, multi-tenant, UI e IA quando aplicáveis.
5. Confirma que P0 = 0.
6. Confirma que P1 = 0 ou existe exceção formal válida.
7. Confirma documentação/ADR atualizados.
8. Lista P2/P3 diferidos e respetivas issues/owners.
9. Produz veredito final:
   - DONE
   - VALIDATION INCOMPLETE
   - BLOCKED

Nunca declares DONE se existir critério obrigatório em FAIL, BLOCKED ou NOT RUN.
```

---

## 17. Relatório de handoff entre sessões

```markdown
# HANDOFF — MISSÃO NN

- Estado:
- Branch:
- Último commit/base:
- Último passo concluído:
- Passo atual:
- Critérios PASS:
- Critérios restantes:
- Testes executados:
- Riscos P0/P1/P2/P3:
- Bloqueios:
- Ficheiros principais:
- Próxima ação EXATA:
- Prompt seguinte recomendado:
```

Nunca terminar uma sessão importante deixando o próximo passo apenas na conversa.

---

## 18. Fluxo resumido para uso diário

```text
IDEIA
 ↓
MISSÃO / ISSUE
 ↓
DEFINITION OF READY
 ↓
PROMPT A — ANALISAR
 ↓
APROVAR PLANO
 ↓
PROMPT B — IMPLEMENTAR PASSO
 ↓
PROMPT C — VALIDAR
 ↓
PASS?
 ├─ NÃO → corrigir o mesmo passo
 └─ SIM → preparar commit / PR
 ↓
PR + VALIDAÇÃO MANUAL
 ↓
PROMPT E — REVISÃO FINAL
 ↓
DEFINITION OF DONE
 ↓
DONE
```

---

## 19. Regra final

> **Uma missão grande produz um plano. Um plano produz passos. Um prompt implementa um passo. Uma evidência prova um critério.**

Este encadeamento é o padrão operacional do Nexus Edu IA.