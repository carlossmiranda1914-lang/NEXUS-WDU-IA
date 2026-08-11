# Nexus Edu IA — Hierarquia de Fontes Canónicas

Estado: CANÓNICO — obrigatório consultar antes de planear ou implementar produto, arquitetura, dados, segurança ou UX.

## 1. Regra constitucional

Nenhuma missão pode ser declarada READY se as fontes aplicáveis desta hierarquia não tiverem sido identificadas e verificadas.

Em caso de conflito, não escolher silenciosamente uma interpretação. Registar o conflito, bloquear a decisão afetada e resolver por ADR/decisão de produto antes de implementar.

## 2. Ordem de autoridade

### Nível A — Constituição e invariantes

1. ADRs aceites em `docs/architecture/`.
2. `docs/ARCHITECTURE_V4.md`.
3. `docs/DEFINITION_READY_DONE_EVIDENCE.md`.
4. `docs/WORKFLOW_CODEX.md`.

Estes documentos governam segurança, multi-instituição, fontes de verdade, workflow de engenharia, evidências e gates.

### Nível B — Estratégia e realidade operacional

1. Plano Mestre / documentação estratégica aprovada do Nexus.
2. Relatório Estratégico Profundo v2.
3. Relatório de Pesquisa Operacional e Benchmark v1.
4. `docs/product/NEXUS_OPERATIONAL_MAP_V1.md`.

Estes documentos governam o problema que o produto resolve, os atores, os fluxos, a prioridade e a experiência operacional.

### Nível C — Blueprint de domínio/vertical

Blueprints aprovados de cada fluxo, começando por `docs/product/MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md`.

Um blueprint não pode contrariar Nível A ou B. Se precisar fazê-lo, exige alteração explícita da fonte superior.

### Nível D — Missões, issues e implementação

Issues, mission packs, execution logs, PRs, código, schema e testes materializam decisões superiores. Não redefinem silenciosamente a arquitetura ou o processo de negócio.

## 3. Invariantes atuais

- Identity → Person → Membership → Institution → Resources.
- Firebase autentica; PostgreSQL autoriza contexto institucional.
- O browser nunca é fonte autorizadora de instituição/tenant.
- Role institucional pertence à Membership.
- Platform Admin e Institution Admin são conceitos distintos.
- Nenhuma migração aumenta privilégios automaticamente.
- Recursos de negócio são institution-scoped e, quando aplicável, unit-scoped.
- Processos transversais usam estados, tarefas, eventos, prazos, bloqueios e evidências.
- Nenhuma operação crítica é apresentada como concluída sem confirmação real.
- IA respeita as mesmas policies do utilizador e não executa ações críticas autonomamente.
- Alterações são incrementais, testáveis, reversíveis e rastreáveis.

## 4. Princípios de produto obrigatórios

1. Fluxo antes de módulo.
2. Trabalho por exceção antes de procura manual de problemas.
3. Uma pessoa, uma identidade longitudinal; evitar duplicação por conveniência de UI.
4. Contexto operacional antes de navegação técnica.
5. Automação invisível: mostrar ao utilizador a decisão, pendência e próxima ação — não mecanismos internos.
6. Ações humanas concentram-se em julgamento, exceção, validação e responsabilidade.
7. O caminho normal deve exigir o mínimo de passos e reintrodução de dados.
8. Nenhum ecrã demonstrativo é considerado fluxo real sem persistência, autorização, erros, estados e evidência.
9. A experiência é adaptada por papel e dispositivo sem duplicar a verdade do domínio.
10. Angola é contexto operacional primário: linguagem, documentos, conectividade, pagamentos, calendário, estrutura escolar e práticas administrativas devem ser validados localmente.

## 5. Gate documental antes de implementar

Toda missão funcional deve declarar:

- fontes canónicas consultadas;
- fluxo operacional afetado;
- atores e responsabilidades;
- invariantes que não podem ser quebrados;
- dados e ownership;
- estados, exceções e bloqueios;
- automações propostas e respetivos limites;
- critérios de autorização e multi-instituição;
- critérios de aceitação e plano de evidência;
- impacto em outros fluxos/domínios;
- decisões abertas que ainda bloqueiam implementação.

Sem estes itens, a missão permanece PREPARAÇÃO.
