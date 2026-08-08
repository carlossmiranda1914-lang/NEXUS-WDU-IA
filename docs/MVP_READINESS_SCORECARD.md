# Nexus Edu IA — MVP Readiness Scorecard

## 1. Objetivo

Medir progresso do Nexus Edu IA sem confundir quantidade de ecrãs, documentação ou código escrito com prontidão real para piloto.

A pontuação é baseada em evidências e deve ser recalculada após gates relevantes.

> **Percentagem sem evidência é estimativa. Score com evidência é gestão.**

---

## 2. Escala

Cada domínio recebe 0–5:

- **0 — Não definido**
- **1 — Definido/conceptual**
- **2 — Implementação parcial**
- **3 — Implementado, validação incompleta**
- **4 — Validado no ambiente alvo, riscos residuais controlados**
- **5 — Pronto para piloto segundo DoD, com evidências completas**

Não subir para 4 ou 5 apenas por inspeção visual ou afirmação do Codex.

---

## 3. Pesos do MVP

| Domínio | Peso |
|---|---:|
| Fundação técnica e reproducibilidade | 15% |
| Segurança, RBAC e autenticação | 15% |
| Multi-instituição e isolamento | 10% |
| Dados, PostgreSQL e persistência | 10% |
| Produto e fluxos essenciais | 15% |
| UX multidispositivo | 10% |
| Tempo real, auditoria e observabilidade | 10% |
| Qualidade, testes e CI | 10% |
| IA segura e governada | 5% |
| **Total** | **100%** |

---

## 4. Fórmula

Para cada domínio:

`contribuição = peso × (nível / 5)`

`MVP Readiness = soma das contribuições`

Exemplo: Segurança com peso 15 e nível 3 contribui 9 pontos.

---

## 5. Regras de teto

Mesmo que a média matemática seja alta:

- P0 aberto → **máximo global 59/100**;
- isolamento multi-instituição não validado → **máximo 59/100 para piloto com várias instituições**;
- persistência real não validada → **máximo 59/100 para dados reais**;
- RBAC backend não validado → **máximo 59/100 para dados reais**;
- CI/build crítico FAIL → estado **BLOQUEADO**, independentemente do score;
- qualquer domínio crítico em nível 0 → não declarar pronto para piloto.

O score não substitui gates.

---

## 6. Scorecard atual — antes da MISSÃO 01

O estado abaixo é deliberadamente conservador. Como a MISSÃO 01 ainda não produziu a fotografia técnica, vários níveis permanecem **NÃO MEDIDOS**.

| Domínio | Peso | Nível comprovado | Estado | Evidência necessária para atualizar |
|---|---:|---:|---|---|
| Fundação técnica | 15 | — | NÃO MEDIDO | Missão 01 + Missão 07 |
| Segurança/RBAC | 15 | — | NÃO MEDIDO | Missão 01 + Missão 02 |
| Multi-instituição | 10 | — | NÃO MEDIDO | Missão 03 |
| PostgreSQL/persistência | 10 | — | NÃO MEDIDO | Missão 04 |
| Produto/fluxos essenciais | 15 | — | NÃO MEDIDO | inventário funcional + testes |
| UX multidispositivo | 10 | — | NÃO MEDIDO | matriz desktop/tablet/mobile |
| Tempo real/auditoria | 10 | — | NÃO MEDIDO | Missões 05–06 |
| Qualidade/testes/CI | 10 | — | NÃO MEDIDO | Missão 01 + CI |
| IA segura | 5 | — | NÃO MEDIDO | avaliação específica de IA |

**Score oficial atual: NÃO CALCULADO.**

Qualquer percentagem global usada antes da Missão 01 deve ser marcada como **estimativa de planeamento**, nunca como readiness comprovada.

---

## 7. Evidência mínima por nível

### Nível 1
- requisitos/documentação identificados;
- owner/objetivo conhecido.

### Nível 2
- código ou fluxo parcial identificado;
- lacunas conhecidas;
- sem prova suficiente de integração completa.

### Nível 3
- fluxo implementado;
- testes/validações parciais;
- riscos ou cenários ainda NOT RUN.

### Nível 4
- critérios funcionais passam;
- testes relevantes passam;
- segurança/persistência/multidispositivo aplicáveis validados;
- sem P0/P1 do domínio.

### Nível 5
- DoD integral do domínio;
- evidências anexadas;
- CI/gates aplicáveis passam;
- operação de piloto documentada;
- risco residual aceite formalmente.

---

## 8. Atualização obrigatória

Recalcular o score após:

- conclusão da Missão 01;
- conclusão de cada Missão 02–07;
- mudança arquitetural relevante;
- novo módulo essencial entrar no MVP;
- regressão crítica;
- gate de piloto.

Toda atualização deve indicar:

- score anterior;
- score novo;
- evidências que justificam a mudança;
- teto aplicável;
- riscos que impedem avanço.

---

## 9. Interpretação

- **0–29** — descoberta/fundação inicial;
- **30–49** — produto em construção, ainda instável;
- **50–69** — MVP funcional em estabilização;
- **70–84** — candidato a piloto controlado;
- **85–94** — piloto tecnicamente forte;
- **95–100** — readiness muito alta dentro do âmbito definido, sem significar ausência absoluta de risco.

Estas bandas não anulam os tetos de segurança.

---

## 10. Regra final

> **O objetivo não é aumentar a percentagem. É aumentar a quantidade de comportamento importante que conseguimos provar.**