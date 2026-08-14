# Nexus Edu IA — Hierarquia de Fontes Canónicas

Estado: CANÓNICO — obrigatório consultar antes de planear ou implementar produto, arquitetura, dados, segurança ou UX.

## 1. Regra constitucional

Nenhuma missão pode ser declarada READY se as fontes aplicáveis desta hierarquia não tiverem sido identificadas e verificadas.

Em caso de conflito, não escolher silenciosamente uma interpretação. Registar o conflito, bloquear a decisão afetada e resolver por ADR/decisão de produto antes de implementar.

O Google Drive oficial do projeto é uma fonte canónica de produto e design. Não deve ser tratado como arquivo opcional. Quando uma tarefa envolver produto, fluxo, UX, identidade visual, paleta, arquitetura funcional ou prioridades, consultar as fontes aplicáveis no Drive antes de assumir comportamento.

## 2. Ordem de autoridade

### Nível A — Constituição e invariantes

1. ADRs aceites em `docs/architecture/`.
2. `docs/ARCHITECTURE_V4.md`.
3. `docs/DEFINITION_READY_DONE_EVIDENCE.md`.
4. `docs/WORKFLOW_CODEX.md`.
5. Arquitetura Oficial e invariantes aprovados no Drive, quando forem mais recentes ou mais completos do que a cópia no repositório.

Estes documentos governam segurança, multi-instituição, fontes de verdade, workflow de engenharia, evidências e gates.

### Nível B — Estratégia e realidade operacional

1. Documento Mestre de Planeamento / Plano Mestre aprovado do Nexus.
2. Relatório Estratégico Profundo v2.
3. Relatório de Pesquisa Operacional e Benchmark v1.
4. `docs/product/NEXUS_OPERATIONAL_MAP_V1.md`.

Estes documentos governam o problema que o produto resolve, os atores, os fluxos, a prioridade e a experiência operacional.

### Nível B-V — Autoridade visual e de experiência

1. `Nexus_Edu_IA_Padrao_Visual_e_Paleta_Oficial_v1_0.docx` no Google Drive — documento normativo atual para identidade visual, tokens, modos, componentes e regras de aplicação.
2. `Nexus_Edu_IA_Design_System_Oficial_v3_2_Multidispositivo.pdf` no Google Drive — referência de estrutura de design system, componentes, padrões, layouts e governação visual.

Regra de precedência visual: quando existir conflito de cor/tokens entre estes dois documentos, o **Padrão Visual e Paleta Oficial v1.0**, por ser posterior e explicitamente normativo, prevalece. O ficheiro de Design System ainda contém uma paleta histórica azul/ciano e não deve ser usado como autoridade de cor quando contrariar a paleta oficial Nexus Aurora.

### Nível C — Blueprint de domínio/vertical

Blueprints aprovados de cada fluxo, começando por `docs/product/MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md`.

Um blueprint não pode contrariar Nível A, B ou B-V. Se precisar fazê-lo, exige alteração explícita da fonte superior.

### Nível D — Missões, issues e implementação

Issues, mission packs, execution logs, PRs, código, schema e testes materializam decisões superiores. Não redefinem silenciosamente a arquitetura, o processo de negócio ou a identidade visual.

## 3. Fontes Drive actualmente registadas

- `Nexus_Edu_IA_Documento_Mestre_Planeamento_v1.docx` — produto, operação, arquitetura, experiência e governação.
- `Plano_Mestre_Nexus_Edu_IA_v4_2_Multidispositivo.pdf` — planeamento mestre multidispositivo.
- `Nexus_Edu_IA_Arquitetura_Oficial_v4_0_Multidispositivo.pdf` — arquitetura oficial.
- `Nexus_Edu_IA_Relatorio_Estrategico_Profundo_v2.pdf` — estratégia profunda.
- `Nexus_Edu_IA_Relatorio_Pesquisa_Operacional_Benchmark_v1.pdf` — benchmark operacional.
- `Nexus_Edu_IA_Padrao_Visual_e_Paleta_Oficial_v1_0.docx` — autoridade visual atual.
- `Nexus_Edu_IA_Design_System_Oficial_v3_2_Multidispositivo.pdf` — design system e padrões de componentes.

A lista é um índice de consulta, não uma cópia integral dos documentos. Sempre que a decisão depender de detalhe normativo, consultar o documento original mais recente no Drive.

## 4. Invariantes atuais

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

## 5. Princípios de produto obrigatórios

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

## 6. Contrato visual oficial — Nexus Aurora

### Direção

- Clareza antes de decoração.
- Vibração controlada: cor intensa destaca, não domina a interface.
- Confiança visível: estado, origem, atualização, confirmação e evidência devem ser claros.
- Acessibilidade: informação importante nunca depende apenas da cor.
- Assinatura Nexus Path: `Contexto → Ação → Validação → Evidência → Resultado` somente quando explica processo real.

### Modos

- Claro — padrão inicial.
- Escuro.
- Tonal Nexus.
- Seguir dispositivo.

A preferência é individual e persistente.

### Tokens de cor oficiais

- `brand.void` — `#031D18`
- `brand.deep` — `#064C3C`
- `action.primary` — `#0B8B62`
- `accent.vivid` — `#28C76F`
- `accent.lime` — `#9BEA4A`
- `surface.canvas` — `#F5FAF7`
- `surface.raised` — `#FFFFFF`
- `surface.mint` — `#DDF9E8`
- `text.primary` — `#102E27`
- `border.default` — `#D8E8E0`
- `ai.primary` — `#00A6A6`
- `info` — `#3478E5`
- `success` — `#15803D`
- `warning` — `#F2A93B`
- `danger` — `#E65362`

Gradiente institucional aprovado: `#064C3C → #0B8B62 → #9BEA4A`, apenas em login, onboarding, capa de processo, mensagem editorial ou ação especial. Não usar em cartões comuns, tabelas, fundos gerais ou múltiplos botões na mesma tela.

Proporção recomendada: 85% superfícies neutras, 10% verdes de base, até 5% acentos vivos/turquesa.

### Regras de implementação visual

- Usar tokens semânticos antes de valores hexadecimais.
- Não espalhar hexadecimais por componentes.
- Uma zona deve ter no máximo uma ação primária dominante.
- Verde-lima e gradientes são acentos, nunca fundos recorrentes.
- IA usa `ai.primary` e não compete com `action.primary`.
- Estados críticos usam ícone + rótulo + cor.
- Contraste mínimo: 4.5:1 para texto normal e 3:1 para texto grande/controlos essenciais.
- Botões: 44–48 px de altura, raio 12 px.
- Inputs: raio 14 px, borda 1 px, foco verde/turquesa suave.
- Cards: raio 18–20 px, borda discreta e sombra baixa.
- Modal: raio 28 px quando interrompe a tarefa.
- Escala de espaço: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Tabelas densas permanecem tabelas em desktop; em mobile convertem-se em lista/card-resumo.
- Testar cada ecrã em Claro, Escuro e Tonal Nexus antes de aprovação visual quando o sistema de modos estiver aplicado à superfície alterada.

Uma alteração visual estrutural só é válida quando norma, design e implementação permanecem alinhados.

## 7. Gate documental antes de implementar

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
- decisões abertas que ainda bloqueiam implementação;
- para UI/UX: tokens, modo(s), estados e regras visuais aplicáveis.

Sem estes itens, a missão permanece PREPARAÇÃO.

## 8. Regra de continuidade

Quando houver dúvida sobre comportamento, prioridade, arquitetura, UX ou identidade visual:

1. não improvisar;
2. identificar a categoria da dúvida;
3. consultar primeiro esta hierarquia;
4. abrir a fonte original aplicável no Drive/repositório;
5. citar a decisão encontrada no plano/issue/PR relevante;
6. se ainda houver conflito, bloquear a decisão e escalar em vez de inventar.
