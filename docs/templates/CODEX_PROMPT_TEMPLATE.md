# Nexus Edu IA — Templates Oficiais de Prompt para Codex

## Regra de utilização

Usar prompts diferentes para **ANALISAR**, **IMPLEMENTAR** e **VALIDAR**. Nunca pedir as três coisas num único prompt amplo.

---

# 1. ANALISAR — somente leitura

```text
Estás a trabalhar no repositório Nexus Edu IA.

MISSÃO: [issue/título]
MODO: ANALISAR SOMENTE LEITURA
COMMIT-BASE ESPERADO: [sha/ref]

OBJETIVO
[resultado observável]

FONTES DE VERDADE
- [arquitetura]
- [plano mestre]
- [design system se aplicável]
- [ADR/issue]

DENTRO DO ÂMBITO
- ...

FORA DO ÂMBITO
- ...

CRITÉRIOS
- AC-01 ...
- AC-02 ...

EXECUTA
1. confirma branch, commit-base e estado Git;
2. identifica ficheiros, módulos, contratos, rotas, schema e testes relevantes;
3. descreve o comportamento atual com evidência no código;
4. compara cada AC com o estado atual: SATISFEITO, NÃO SATISFEITO ou NÃO COMPROVADO;
5. identifica alterações existentes fora do âmbito;
6. classifica riscos P0-P3;
7. identifica dependências e bloqueios;
8. propõe o menor plano sequencial de correção;
9. para cada passo, indica ficheiros previstos, critérios resolvidos, risco e testes.

PROIBIDO
- alterar ficheiros;
- criar commits;
- fazer push;
- fazer deploy;
- ampliar a missão;
- tratar suposição como evidência.

FORMATO FINAL
- Estado Git
- Fotografia técnica
- Ficheiros relevantes
- Matriz AC → estado → evidência
- Riscos P0-P3
- Plano mínimo
- Testes necessários
- Bloqueios
- Próxima ação recomendada
```

---

# 2. IMPLEMENTAR — um único passo

```text
Estás a trabalhar no Nexus Edu IA.

MISSÃO: [issue/título]
MODO: IMPLEMENTAR
PASSO APROVADO: [Txx / passo]
COMMIT-BASE: [sha/ref]

OBJETIVO DESTE PASSO
[um resultado observável]

FICHEIROS/ÁREAS ESPERADOS
- ...

NÃO ALTERAR
- ...

CONTRATOS QUE DEVEM PERMANECER
- ...

CRITÉRIOS RELACIONADOS
- AC-...

TESTES IMEDIATOS
- ...

REGRAS
1. implementa somente este passo;
2. usa a menor alteração que satisfaça os critérios;
3. não faças refatorações oportunistas;
4. se precisares sair do âmbito, PARA e reporta;
5. não escondas erros com fallback de sucesso;
6. mantém autorização no backend quando aplicável;
7. não introduzas mocks em fluxos reais;
8. não cries commit, push ou deploy.

NO FINAL
- resumo das alterações;
- ficheiros alterados;
- comandos executados;
- resultados PASS/FAIL/BLOCKED/NOT RUN;
- critérios afetados;
- riscos restantes;
- diff inesperado, se existir;
- recomendação do próximo passo.
```

---

# 3. VALIDAR — sem novas funcionalidades

```text
Estás a validar uma alteração do Nexus Edu IA.

MISSÃO: [issue/título]
MODO: VALIDAR
COMMIT/ESTADO: [sha/ref]

CRITÉRIOS A PROVAR
- AC-...

EVIDÊNCIAS EXIGIDAS
- E0x ...

EXECUTA
1. confirma o estado Git;
2. revê git diff --stat e diff relevante;
3. executa git diff --check;
4. executa os testes definidos;
5. executa typecheck/builds aplicáveis;
6. valida cenários negativos;
7. procura segredos, mocks indevidos e alterações fora do âmbito;
8. classifica riscos residuais P0-P3;
9. preenche a matriz Critério → Evidência → Estado.

NÃO
- adiciones funcionalidades;
- alteres arquitetura para fazer testes passar;
- marques NOT RUN/BLOCKED como PASS;
- cries commit, push ou deploy sem instrução separada.

SAÍDA
- tabela de evidências;
- critérios PASS/FAIL/BLOCKED/NOT RUN/N/A;
- riscos;
- regressões encontradas;
- decisão recomendada: VOLTAR À IMPLEMENTAÇÃO | PRONTA PARA REVISÃO.
```

---

# 4. REVISAR DIFF — gate pré-commit

```text
Revê o diff atual do Nexus Edu IA sem alterar ficheiros.

Verifica:
- correspondência integral com o passo aprovado;
- alterações inesperadas;
- segurança/autorização;
- isolamento institucional;
- dados sensíveis/segredos;
- mocks/fallbacks silenciosos;
- regressões;
- contratos API/schema;
- complexidade desnecessária;
- testes em falta;
- documentação afetada.

Classifica achados P0-P3.

No final responde:
1. APROVADO PARA COMMIT ou BLOQUEADO;
2. razões;
3. correções mínimas necessárias;
4. testes/evidências em falta.

Não alteres ficheiros e não cries commit.
```

---

# 5. ENCERRAR SESSÃO — continuidade

```text
Não alteres código.
Produz o registo de continuidade desta sessão Nexus Edu IA.

Inclui:
- missão e passo;
- branch e commit-base;
- estado Git;
- trabalho concluído;
- ficheiros alterados;
- testes executados e resultados;
- critérios PASS/FAIL/BLOCKED/NOT RUN;
- evidências;
- riscos P0-P3;
- bloqueios;
- alterações fora do plano;
- próximo passo exato;
- prompt recomendado para retomar.

O relatório deve permitir que uma nova sessão continue sem depender da memória desta conversa.
```
