# MISSÃO 01 — Relatório de Fecho

## Estado final

**Concluída — evidência registada em 10 de agosto de 2026.**

O `MISSION_01_READINESS.md` e o `MISSION_01_EXECUTION_PACK.md` são
documentos de preparação da auditoria. Os seus campos `NOT RUN` descrevem o
estado antes da execução e não devem ser reinterpretados como resultados.
Este documento é o registo de execução e fecho.

## Baseline verificada

- Branch: `main`.
- Commit de fundação: `808d209 feat(foundation): establish institutional persistence`.
- Commit de RBAC: `f0a00fb feat(auth): enforce institutional role boundaries`.
- Não houve push nem deploy nesta execução.
- A pasta aninhada `NEXUS-WDU-IA-main/`, `scripts/`, `docs/operations/` e dois
  testes avulsos permaneceram deliberadamente fora dos commits por não fazerem
  parte da baseline revista.

## Matriz de evidências

| Critério | Resultado | Evidência |
|---|---|---|
| Estado Git e baseline | PASS | Dois commits locais coerentes e alterações externas à missão separadas. |
| Fundação e persistência | PASS | `DATABASE_URL` validada; fallback em memória exige ativação local explícita. |
| RBAC | PASS | Firebase resolve identidade, pessoa, associação e papel institucional antes das rotas protegidas. |
| Aluno e encarregado | PASS | Relações persistidas controlam as APIs críticas; ausência de relação devolve zero registos. |
| Referências `ALU-101` | PASS (classificado) | Removidas das APIs críticas; permanecem apenas na interface demonstrativa e exemplos, a migrar na futura experiência visível. |
| WebSocket | PASS (estado mapeado) | Ligação requer token e contexto institucional; eventos legados sem contexto são bloqueados. |
| Testes | PASS | 9 testes de autorização, contexto institucional, aluno/encarregado e WebSocket aprovados. |
| TypeScript e builds | PASS | Verificação de tipos, build frontend e bundle do servidor concluídos. |
| Segredos | PASS | Credenciais permanecem no `.env` ignorado pelo Git; não incluídas nos commits revistos. |
| Plano de commits | PASS | Fundação e RBAC foram separados nos commits `808d209` e `f0a00fb`. |

## Riscos e encaminhamento

| Prioridade | Estado | Encaminhamento |
|---|---|---|
| P0 — dados entre escolas | Aberto, controlado parcialmente | MISSÃO 03: tornar os restantes dados legados isolados por instituição. |
| P1 — interface demonstrativa | Aberto, sem exposição de API crítica | Substituir referências e ecrãs antigos quando for criada a experiência visível. |
| P1 — eventos legados em tempo real | Mitigado | Permanecem bloqueados até receberem contexto institucional na MISSÃO 05. |
| P2 — pasta aninhada e scripts avulsos | Inventariado | Rever e separar numa tarefa de higiene de repositório; não apagar sem decisão explícita. |

## Decisão de continuidade

A próxima prioridade é a **MISSÃO 03 — Concluir isolamento multi-instituição**.
Ela é necessária antes de migrar a interface ou disponibilizar dados reais a
mais do que uma escola.
