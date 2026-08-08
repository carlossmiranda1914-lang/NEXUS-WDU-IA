# Nexus Edu IA — Template Universal de Missão e Prompts Codex

## 1. Finalidade

Este template é a interface operacional entre intenção de produto, arquitetura e execução no Codex.

Ele deve ser usado para transformar pedidos amplos em trabalho pequeno, verificável e retomável.

> **Nunca entregar ao Codex uma intenção ampla quando podemos entregar uma missão com critérios e um único passo verificável.**

---

## 2. Cabeçalho da Missão

```markdown
# MISSÃO NN — [resultado concreto]

## Estado
BACKLOG | PREPARAÇÃO | READY | ANÁLISE | PLANEADA | IMPLEMENTAÇÃO | VALIDAÇÃO | BLOQUEADA | DONE

## Prioridade
P0 | P1 | P2 | P3

## Tamanho
XS | S | M | L | XL

## Objetivo estratégico
[issue/objetivo]

## Dependências
- ...
```

---

## 3. Problema e resultado

```markdown
## Problema
[descrever o comportamento, risco ou necessidade atual sem prescrever prematuramente a solução]

## Resultado observável esperado
[descrever o que será verdadeiro quando a missão terminar]

## Valor
[por que isto importa para utilizador, escola, operação, segurança ou desenvolvimento]
```

---

## 4. Âmbito

```markdown
## Dentro do âmbito
- ...

## Fora do âmbito
- ...

## Não alterar sem nova decisão
- contratos públicos não relacionados;
- arquitetura fora da missão;
- schema fora do necessário;
- identidade visual não relacionada;
- novas funcionalidades não previstas.
```

---

## 5. Fontes de verdade

```markdown
## Fontes de verdade aplicáveis
- Arquitetura Oficial: [secção]
- Plano Mestre: [secção]
- Design System: [secção/N/A]
- ADRs: [lista/N/A]
- Issues relacionadas: [lista]

## Divergências conhecidas
- Nenhuma | ...
```

Se documentação e código discordarem, o Codex deve reportar a divergência antes de assumir qual está correta.

---

## 6. Critérios de aceitação

Usar IDs estáveis.

```markdown
| ID | Critério | Evidência esperada |
|---|---|---|
| AC-01 | ... | E03/E05/... |
| AC-02 | ... | ... |
```

Cada critério deve permitir PASS ou FAIL.

---

## 7. Riscos e superfícies especiais

```markdown
## Segurança
[aplicável/N/A + riscos]

## Multi-instituição
[aplicável/N/A + riscos]

## Persistência
[aplicável/N/A + riscos]

## WebSocket/tempo real
[aplicável/N/A + riscos]

## UI multidispositivo
[desktop/tablet/mobile/N/A]

## IA
[aplicável/N/A + guardrails]
```

---

## 8. Plano de testes antes da implementação

```markdown
## Automáticos
- ...

## Negativos
- ...

## Manuais
- ...

## Viewports/perfis/instituições
- ...
```

Não definir os testes apenas depois de ver o código produzido.

---

# 9. PROMPT 1 — ANALISAR

Este é sempre o primeiro prompt para uma missão técnica nova.

```text
MODO: ANALISAR — SOMENTE LEITURA
MISSÃO: [NN — título]
REPOSITÓRIO: Nexus Edu IA

OBJETIVO
[resultado observável]

FONTES DE VERDADE
[documentos/ADRs/issues]

DENTRO DO ÂMBITO
[lista]

FORA DO ÂMBITO
[lista]

CRITÉRIOS DE ACEITAÇÃO
[AC-01...]

TAREFA
1. Confirma branch, commit-base e estado Git relevante.
2. Localiza ficheiros, módulos, rotas, contratos, testes e dados envolvidos.
3. Explica o fluxo atual ponta a ponta.
4. Compara o estado atual com cada critério de aceitação.
5. Identifica divergências entre código, documentação e issue.
6. Identifica riscos e classifica P0, P1, P2 ou P3.
7. Identifica dependências e áreas que não devem ser alteradas.
8. Propõe o menor plano de implementação possível, em passos independentes e verificáveis.
9. Para cada passo, indica ficheiros esperados, risco e testes.
10. Indica perguntas realmente bloqueadoras, se existirem.

PROIBIÇÕES
- não alteres ficheiros;
- não cries commits;
- não faças push;
- não abras PR;
- não faças deploy;
- não aumentes o âmbito;
- não assumes que o código atual representa a arquitetura desejada.

SAÍDA OBRIGATÓRIA
A. fotografia atual;
B. mapa de ficheiros/fluxos;
C. matriz AC → estado atual;
D. riscos P0–P3;
E. plano mínimo numerado;
F. testes por passo;
G. bloqueios/perguntas;
H. recomendação do primeiro passo.
```

---

# 10. Gate após análise

Antes do PROMPT 2:

```text
ANÁLISE RECEBIDA: SIM
ESCOPO CONFIRMADO: SIM
RISCOS CONHECIDOS: SIM
DIVERGÊNCIAS RESOLVIDAS OU REGISTADAS: SIM
PLANO APROVADO: SIM
PRIMEIRO PASSO DELIMITADO: SIM
```

Se qualquer resposta for NÃO, não implementar.

---

# 11. PROMPT 2 — IMPLEMENTAR UM PASSO

```text
MODO: IMPLEMENTAR
MISSÃO: [NN]
PASSO APROVADO: [X — nome]

OBJETIVO OBSERVÁVEL DESTE PASSO
[resultado]

FICHEIROS/ÁREAS ESPERADOS
[lista]

NÃO ALTERAR
[lista]

CONTRATOS QUE DEVEM PERMANECER
[lista]

CRITÉRIOS DE ACEITAÇÃO DESTE PASSO
[IDs + texto]

TESTES OBRIGATÓRIOS IMEDIATOS
[lista]

IMPLEMENTAÇÃO
1. Implementa apenas este passo.
2. Mantém o diff mínimo.
3. Não faças refatorações oportunistas.
4. Se precisares sair do âmbito, PARA e reporta antes de alterar.
5. Executa os testes definidos para o passo.
6. Não escondas falhas com fallback, mock, lista vazia ou sucesso visual.

NO FINAL DEVOLVE
A. resumo exato da alteração;
B. ficheiros modificados;
C. comandos/testes e PASS/FAIL/BLOCKED/NOT RUN;
D. critérios satisfeitos;
E. riscos restantes;
F. alterações inesperadas;
G. diff/áreas que exigem revisão;
H. recomendação do próximo passo.

PROIBIDO
- commit;
- push;
- merge;
- deploy;
- implementar o passo seguinte.
```

---

# 12. PROMPT 3 — VALIDAR O PASSO

Usar depois da implementação, antes de considerar o passo concluído.

```text
MODO: VALIDAR
MISSÃO: [NN]
PASSO: [X]

Não alteres código nesta primeira validação.

1. Revê o diff completo deste passo contra o plano aprovado.
2. Confirma que não existem alterações fora do âmbito.
3. Procura regressões, falhas de autorização, dados excessivos, fallback silencioso e estados inconsistentes.
4. Executa/recomenda os testes de validação aplicáveis.
5. Confirma cada critério de aceitação com evidência.
6. Classifica cada verificação como PASS, FAIL, BLOCKED, NOT RUN ou N/A.
7. Classifica riscos restantes P0–P3.
8. Indica se o passo está pronto para commit ou se exige correção.

SAÍDA
- matriz AC → evidência → estado;
- riscos;
- problemas encontrados;
- decisão: READY FOR COMMIT | FIX REQUIRED | BLOCKED.
```

---

# 13. PROMPT 4 — CORRIGIR APENAS FALHAS DE VALIDAÇÃO

```text
MODO: IMPLEMENTAR CORREÇÃO
MISSÃO: [NN]
PASSO: [X]

Corrige exclusivamente as falhas abaixo identificadas na validação:
[lista]

Não expandas o âmbito.
Não refatores áreas aprovadas sem necessidade.
Executa novamente apenas os testes afetados e devolve evidências atualizadas.
Não cries commit, push ou deploy.
```

Repetir PROMPT 3 depois da correção.

---

# 14. PROMPT 5 — PREPARAR COMMIT

Este prompt prepara, mas não autoriza automaticamente integração.

```text
MODO: PREPARAR COMMIT
MISSÃO: [NN]
PASSO: [X]

1. Confirma git status e diff stat.
2. Revê git diff --check.
3. Confirma ausência de segredos, tokens e ficheiros temporários.
4. Confirma que todos os critérios deste passo estão PASS/N/A justificado.
5. Lista exatamente os ficheiros que devem entrar no commit.
6. Propõe uma mensagem de commit no formato <tipo>(<área>): <resultado>.
7. Não incluas alterações não relacionadas.
8. Não faças push, merge ou deploy.

Devolve uma decisão final:
READY FOR COMMIT | NOT READY
```

---

# 15. PROMPT 6 — VALIDAÇÃO FINAL DA MISSÃO

```text
MODO: VALIDAR MISSÃO
MISSÃO: [NN]

1. Revê todos os critérios de aceitação da missão.
2. Liga cada critério à evidência E01–E15 correspondente.
3. Confirma testes, builds, segurança, persistência, multidispositivo e documentação quando aplicáveis.
4. Confirma P0 restantes = 0.
5. Confirma P1 restantes = 0 ou exceção formal documentada.
6. Lista P2/P3 diferidos com issue/owner.
7. Confirma que a documentação afetada está atualizada.
8. Confirma que nenhuma informação necessária existe apenas nesta sessão.

DECISÃO
DONE | VALIDATION REQUIRED | BLOCKED | FIX REQUIRED
```

---

## 16. Relatório de continuidade

Ao terminar qualquer sessão, guardar:

```markdown
## Handoff
- Missão:
- Estado:
- Branch:
- Commit/PR:
- Último passo concluído:
- Critérios PASS:
- Critérios pendentes:
- Testes executados:
- Riscos P0/P1/P2/P3:
- Bloqueios:
- Próximo passo exato:
- Prompt recomendado para retomar:
```

---

## 17. Regra para pedidos novos durante uma missão

Se surgir uma nova ideia enquanto uma missão está ativa:

1. não inserir automaticamente na implementação atual;
2. classificar como correção necessária, dependência ou nova intenção;
3. se não for necessária para os critérios atuais, colocar no backlog;
4. manter a missão atual pequena.

Isto evita que uma sessão Codex se transforme numa reescrita geral do produto.

---

## 18. Regra para benchmark externo

Quando uma decisão nasce de outro sistema:

```markdown
Referência:
Problema observado:
Padrão útil:
Porque pode servir ao Nexus:
O que NÃO copiar:
Adotar | Adaptar | Rejeitar:
Decisão/ADR:
Missão afetada:
```

O Codex recebe apenas a decisão adaptada ao Nexus, nunca a instrução vaga “faz igual ao sistema X”.

---

## 19. Exemplo mínimo de decomposição

Pedido:

> “Melhorar o Financeiro.”

Não é implementável.

Transformação correta:

```text
Objetivo: tornar a confirmação de pagamento persistente e autorizada.

Missão A — contrato e persistência do pagamento
Missão B — autorização Tesouraria/Secretaria
Missão C — UI desktop
Missão D — adaptação mobile/tablet
Missão E — auditoria e evidência
```

Mesmo estas missões podem ser divididas em passos menores depois da análise.

---

## 20. Regra final

> **Uma boa sessão Codex não é a que altera mais ficheiros. É a que reduz incerteza e produz o menor conjunto de alterações comprovadamente corretas.**
