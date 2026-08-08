# MISSÃO NN — [Resultado observável]

## Estado

`BACKLOG | PREPARAÇÃO | READY | ANÁLISE | PLANEADA | IMPLEMENTAÇÃO | VALIDAÇÃO | BLOQUEADA | DONE`

## Classificação

- Prioridade: `P0 | P1 | P2 | P3`
- Tamanho: `XS | S | M | L | XL`
- Tipo: `Fundação | Segurança | Dados | Backend | Frontend | UX | IA | Integração | Operação | Documentação`
- Objetivo estratégico:
- Dependências:

---

## 1. Problema

[Descrever o problema atual sem propor prematuramente a solução.]

## 2. Objetivo

[Resultado observável que deve existir quando a missão terminar.]

## 3. Valor

[Por que esta missão importa para utilizador, instituição, segurança, operação ou desenvolvimento.]

## 4. Fonte de verdade

- Arquitetura Oficial:
- Plano Mestre:
- Design System:
- ADRs/decisões:
- Issues/PRs relacionados:

### Conflitos conhecidos

- Nenhum | [descrever]

---

## 5. Dentro do âmbito

- ...

## 6. Fora do âmbito

- ...

## 7. Dependências e pré-condições

- [ ] ...

---

## 8. Critérios de aceitação

Usar IDs permanentes e critérios binários.

- [ ] **AC-01** — ...
- [ ] **AC-02** — ...
- [ ] **AC-03** — ...

### Critérios negativos / falha

- [ ] **AC-N01** — ...

---

## 9. Matriz Critério → Evidência

| ID | Critério | Evidência exigida | Estado | Referência |
|---|---|---|---|---|
| AC-01 | ... | E03/E04/... | NOT RUN | — |

Estados permitidos: `PASS | FAIL | BLOCKED | NOT RUN | N/A`.

---

## 10. Segurança, dados e privacidade

- Contexto autorizado resolvido em:
- Dados mínimos necessários:
- Riscos de acesso indevido:
- Auditoria necessária:
- Dados que nunca podem aparecer em logs/prompts:

Se não aplicável, justificar `N/A`.

---

## 11. UX e multidispositivo

Quando aplicável:

- Desktop:
- Tablet:
- Mobile:
- Loading:
- Vazio:
- Erro:
- Sucesso:
- Acessibilidade/interação:

---

## 12. Plano de testes

### Automáticos

- ...

### Negativos

- ...

### Manuais

- ...

### Ambientes/perfis necessários

- ...

---

## 13. Prompt Codex — ANALISAR

```text
Estás a trabalhar no Nexus Edu IA.

MISSÃO: NN — [título]
MODO: ANALISAR SOMENTE LEITURA

Objetivo:
[objetivo]

Fonte de verdade:
[documentos/ADRs/issues]

Dentro do âmbito:
[lista]

Fora do âmbito:
[lista]

Executa:
1. confirma branch, commit-base e estado Git relevante;
2. mapeia ficheiros, contratos e fluxos envolvidos;
3. compara implementação atual com os critérios AC-*;
4. identifica dependências e alterações fora do âmbito;
5. classifica riscos P0, P1, P2 e P3;
6. indica testes necessários;
7. propõe o menor plano sequencial possível;
8. liga cada passo do plano aos critérios que resolve.

Não alteres ficheiros.
Não cries commits.
Não faças push.
Não faças deploy.
Não aumentes o âmbito.

No final entrega:
- fotografia atual;
- ficheiros relevantes;
- critérios já satisfeitos/não satisfeitos/não comprovados;
- riscos;
- plano mínimo;
- bloqueios;
- recomendação do próximo passo.
```

---

## 14. Resultado da análise

- Commit-base:
- Data:
- Estado:
- Riscos P0:
- Riscos P1:
- Riscos P2:
- Riscos P3:
- Bloqueios:

### Plano aprovado

1. ...
2. ...
3. ...

---

## 15. Tarefas técnicas

Criar apenas depois da análise.

### Tarefa T01 — [resultado]

- Estado:
- Risco:
- Ficheiros esperados:
- Áreas proibidas:
- Critérios relacionados:
- Testes imediatos:

[repetir]

---

## 16. Evidências finais

| Código | Evidência | Resultado | Critério | Referência |
|---|---|---|---|---|
| E01 | ... | NOT RUN | ... | — |

---

## 17. Riscos residuais

- P0:
- P1:
- P2:
- P3:

---

## 18. Definition of Done

- [ ] Todos os AC obrigatórios estão PASS ou N/A justificado
- [ ] Testes aplicáveis passam
- [ ] Builds aplicáveis passam
- [ ] Diff revisto
- [ ] Segurança validada quando aplicável
- [ ] Persistência validada quando aplicável
- [ ] Desktop/tablet/mobile validados quando aplicável
- [ ] Evidências anexadas
- [ ] P0 = 0
- [ ] P1 = 0 ou exceção formal aprovada
- [ ] Documentação atualizada
- [ ] PR revista
- [ ] Próximo passo registado

---

## 19. Encerramento

- Resultado final:
- Commit/PR:
- Limitações conhecidas:
- Issues de seguimento:
- Próxima missão recomendada:
