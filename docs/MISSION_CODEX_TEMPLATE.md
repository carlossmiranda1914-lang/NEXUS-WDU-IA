# Nexus Edu IA — Template Universal de Missão e Prompts Codex

## 1. Finalidade

Este template é a interface operacional entre uma decisão de produto e uma sessão de desenvolvimento com Codex.

Deve ser usado para novas funcionalidades, correções, segurança, dados, arquitetura, UI/UX, IA, integrações e estabilização.

> **Uma intenção só chega ao código depois de ser convertida numa Missão verificável.**

---

# PARTE A — CARTÃO DA MISSÃO

## MISSÃO NN — [Título orientado a resultado]

### Estado
`BACKLOG | PREPARAÇÃO | READY | ANÁLISE | PLANEADA | IMPLEMENTAÇÃO | VALIDAÇÃO | BLOQUEADA | DONE`

### Prioridade
`P0 | P1 | P2 | P3`

### Tamanho
`XS | S | M | L | XL`

### Objetivo estratégico
[Issue/objetivo pai]

### Problema
[O que está errado, ausente, arriscado ou ineficiente?]

### Resultado observável
[O que será objetivamente diferente quando terminar?]

### Valor
[Por que isto importa para utilizador, escola, negócio, segurança ou operação?]

### Dependências
- [ ] ...

### Fonte de verdade
- Arquitetura Oficial: [secção]
- Plano Mestre: [secção]
- Design System: [secção/N/A]
- ADRs: [lista/N/A]
- Contratos/API: [lista/N/A]

### Dentro do âmbito
- ...

### Fora do âmbito
- ...

### Áreas proibidas sem nova aprovação
- ...

### Riscos conhecidos
- P0: ...
- P1: ...
- P2: ...
- P3: ...

---

# PARTE B — CRITÉRIOS DE ACEITAÇÃO

Cada critério deve produzir PASS/FAIL.

| ID | Critério | Evidência exigida | Estado | Referência |
|---|---|---|---|---|
| AC-01 | ... | E__ | NOT RUN | — |
| AC-02 | ... | E__ | NOT RUN | — |

### Testes negativos obrigatórios
- ...

### Validação manual obrigatória
- Perfil:
- Instituição:
- Desktop:
- Tablet:
- Mobile:
- Estados especiais:

---

# PARTE C — PROMPT 1: ANALISAR

Copiar para o Codex antes de qualquer implementação.

```text
MODO: ANALISAR — SOMENTE LEITURA

Estás a trabalhar no Nexus Edu IA.

MISSÃO:
[ID + título]

PROBLEMA:
[problema]

RESULTADO ESPERADO:
[resultado observável]

FONTE DE VERDADE:
[documentos/ADRs/contratos]

DENTRO DO ÂMBITO:
[lista]

FORA DO ÂMBITO:
[lista]

ÁREAS PROIBIDAS:
[lista]

CRITÉRIOS DE ACEITAÇÃO:
[ACs]

Executa apenas análise.

1. Confirma branch, commit-base e estado Git disponível.
2. Mapeia ficheiros, componentes, rotas, serviços, schema, testes e contratos relacionados.
3. Explica o fluxo atual ponta a ponta.
4. Compara o comportamento atual com cada critério de aceitação.
5. Identifica código concluído, parcial, morto, demonstrativo ou inconsistente.
6. Identifica riscos P0, P1, P2 e P3.
7. Identifica dependências ou decisões em falta.
8. Propõe o menor plano seguro de implementação, dividido em passos verificáveis.
9. Para cada passo, indica ficheiros previstos, risco e testes.
10. Indica explicitamente qualquer alteração que exigiria sair do âmbito.

PROIBIDO:
- alterar ficheiros;
- criar ou editar código;
- criar commit;
- fazer push;
- fazer merge;
- fazer deploy;
- ampliar o âmbito autonomamente.

FORMATO DE SAÍDA:
A. Estado Git
B. Mapa técnico
C. Fluxo atual
D. Gap por critério AC
E. Riscos P0-P3
F. Plano mínimo numerado
G. Testes necessários
H. Bloqueios/decisões necessárias
I. Recomendação do próximo passo
```

---

# PARTE D — GATE DA ANÁLISE

Antes de implementar:

- [ ] mapa técnico compreensível;
- [ ] gaps ligados aos ACs;
- [ ] riscos classificados;
- [ ] plano dividido;
- [ ] ficheiros previstos identificados;
- [ ] testes por passo definidos;
- [ ] nenhuma decisão arquitetural crítica ficou implícita;
- [ ] nenhuma ampliação de âmbito foi aceite silenciosamente.

Se falhar, repetir apenas análise.

---

# PARTE E — PLANO TÉCNICO APROVADO

| Passo | Resultado | Ficheiros previstos | Risco | Testes | Dependência |
|---|---|---|---|---|---|
| 1 | ... | ... | P_ | ... | — |
| 2 | ... | ... | P_ | ... | 1 |

Regra: executar apenas um passo de cada vez.

---

# PARTE F — PROMPT 2: IMPLEMENTAR UM PASSO

```text
MODO: IMPLEMENTAR — PASSO CONTROLADO

MISSÃO:
[ID + título]

PASSO APROVADO:
[número + resultado]

OBJETIVO OBSERVÁVEL DESTE PASSO:
[resultado]

FICHEIROS PREVISTOS:
[lista]

NÃO ALTERAR:
[lista]

CONTRATOS QUE DEVEM SER PRESERVADOS:
[lista]

CRITÉRIOS DE ACEITAÇÃO DESTE PASSO:
[ACs]

TESTES IMEDIATOS:
[lista]

Implementa apenas este passo.

REGRAS:
1. Faz a menor alteração capaz de cumprir o objetivo.
2. Não refatores código não relacionado.
3. Não alteres arquitetura, schema, contratos ou permissões fora do que foi aprovado.
4. Se descobrires necessidade de sair do âmbito, PARA e reporta.
5. Não escondas erros com fallback de sucesso.
6. Não introduzas dados demonstrativos em fluxo real.
7. Não exponhas segredos ou dados sensíveis.
8. Executa os testes imediatos definidos.

NO FINAL, NÃO CRIES COMMIT/PUSH/MERGE/DEPLOY.

Entrega:
A. resumo da alteração;
B. ficheiros alterados;
C. diff conceptual;
D. comandos/testes e resultados;
E. critérios PASS/FAIL/NOT RUN;
F. riscos restantes;
G. alterações inesperadas;
H. recomendação: validar / corrigir / bloquear.
```

---

# PARTE G — PROMPT 3: VALIDAR

```text
MODO: VALIDAR — NÃO EXPANDIR ÂMBITO

Valida o estado atual da MISSÃO [NN], com foco no PASSO [X].

1. Revê git diff --stat.
2. Revê o diff completo.
3. Executa git diff --check.
4. Confirma que só existem alterações explicadas pelo plano.
5. Procura segredos, tokens, dados sensíveis e ficheiros temporários.
6. Executa os testes previstos.
7. Executa TypeScript/builds aplicáveis.
8. Revalida critérios de aceitação relacionados.
9. Classifica riscos P0-P3 restantes.
10. Não corrijas automaticamente problemas novos; reporta-os primeiro.

Entrega uma tabela Critério → Evidência → Estado → Referência.

Não cries commit, push, merge ou deploy.
```

---

# PARTE H — PROMPT 4: PREPARAR COMMIT

Usar apenas após validação aprovada.

```text
MODO: PREPARAR COMMIT

Não cries ainda o commit.

Com base no diff validado da MISSÃO [NN]:
1. confirma os ficheiros que pertencem a este commit;
2. separa alterações não relacionadas;
3. propõe uma mensagem no formato <tipo>(<área>): <resultado>;
4. resume critérios e evidências cobertos;
5. confirma riscos restantes;
6. indica exatamente o que ficará fora do commit.

Se o commit misturar intenções independentes, propõe divisão.
```

---

# PARTE I — PROMPT 5: REVISÃO FINAL DA MISSÃO

```text
MODO: REVISÃO FINAL

Avalia a MISSÃO [NN] contra a Definition of Done oficial.

Para cada critério:
- PASS;
- FAIL;
- BLOCKED;
- NOT RUN;
- N/A justificado.

Confirma também:
- testes;
- builds;
- diff;
- segurança;
- persistência;
- multi-tenant;
- multidispositivo;
- IA, quando aplicável;
- documentação;
- riscos P0-P3;
- evidências anexadas.

Não declares DONE se existir critério obrigatório em FAIL, BLOCKED ou NOT RUN.
Não alteres código durante esta revisão.
```

---

# PARTE J — RELATÓRIO DE HANDOFF

Toda sessão relevante termina com:

```markdown
## Handoff — MISSÃO NN
- Estado:
- Branch:
- Commit-base:
- Último passo concluído:
- Passo em curso:
- Ficheiros alterados:
- Testes PASS:
- Testes FAIL:
- NOT RUN:
- Riscos P0/P1/P2/P3:
- Bloqueios:
- Decisões pendentes:
- Próxima ação exata:
```

---

# PARTE K — REGRAS DE EFICIÊNCIA

Para manter o Codex leve:

1. não repetir toda a documentação em cada prompt; apontar para as fontes;
2. enviar apenas o contexto necessário ao passo atual;
3. separar exploração de implementação;
4. preferir diffs pequenos;
5. testar imediatamente;
6. não pedir múltiplos módulos numa sessão de implementação;
7. persistir decisões no GitHub, não depender da memória do chat;
8. recomeçar uma sessão com o handoff, não com a história completa do projeto.

---

# PARTE L — BENCHMARK EXTERNO

Se a missão nasceu de análise de outro sistema, incluir antes do Codex:

```markdown
## Referência externa
- Sistema:
- Data/versão observada:
- Fluxo observado:
- Evidência:
- Problema que resolve:
- Princípio reutilizável:
- Decisão: ADOTAR | ADAPTAR | REJEITAR
- Justificação:
- Impacto na arquitetura Nexus:
- Licença, se houver código:
```

Nunca enviar “copiar sistema X” como requisito. Traduzir a referência num princípio e num critério próprio do Nexus.

---

## Regra final

> **O prompt não substitui a Missão. A Missão não substitui a arquitetura. E nenhum dos dois substitui evidência.**