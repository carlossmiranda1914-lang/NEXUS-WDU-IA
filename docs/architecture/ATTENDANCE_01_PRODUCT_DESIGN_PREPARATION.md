# ATTENDANCE-01 — Preparação de Design de Produto

**Estado:** RASCUNHO — planeamento de design exclusivo de Attendance-01.  
**Autorização de implementação:** Não concedida.  
**Âmbito:** Apenas Attendance-01. Finance e a evolução do Design System global ficam explicitamente fora deste documento.

## 1. Autoridade de design

Attendance consome o sistema visual oficial Nexus Aurora como referência fixa. Este trabalho não altera, reabre nem amplia o Design System global.

## 2. Objetivo

Definir, antes de ecrãs, componentes ou código, o comportamento de produto de Attendance-01 para professor, coordenação, encarregado e aluno. O resultado deve tornar claras as ações, os estados, as decisões humanas, as provas e os efeitos de cada fluxo.

## 3. Restrições já confirmadas

- O professor só inicia e confirma sessões da sua atribuição ativa.
- A unidade de registo é configurável por instituição: aula/sessão, dia letivo ou atividade escolar.
- Presença/falta é o resultado principal; atraso e falta de material são ocorrências separadas.
- Antes de confirmar, resultados principais em falta são preenchidos como falta.
- Registos confirmados são imutáveis; correções são revisões propostas e decididas segundo política.
- A coordenação decide justificações e conflitos conforme política institucional.
- Encarregado e aluno apenas consultam informação própria; alterações confirmadas são visíveis imediatamente.
- Estados técnicos, estados de negócio e efeitos de assiduidade devem aparecer separadamente e em linguagem clara.
- O desenho deve cumprir teclado, leitor de ecrã, contraste adequado e os três modos oficiais.
- Anexos de justificações usam associação provisória em Documents Foundation; a validade como prova depende da decisão de negócio em Attendance.

## 4. Sequência de definição

| ID | Decisão de design | Estado |
|---|---|---|
| AD-01 | Arquitetura de informação e entradas por papel | Em curso |
| AD-02 | Espaço de trabalho do professor: iniciar, registar e confirmar | Pendente |
| AD-03 | Espaço da coordenação: decisões, conflitos e painel de alertas | Pendente |
| AD-04 | Experiência de encarregado e aluno: consulta e justificação | Pendente |
| AD-05 | Gramática de cartões: contexto, decisão, evidência, resultado e histórico | Pendente |
| AD-06 | Estados, mensagens, erros, offline, notificações e acessibilidade | Pendente |
| AD-07 | Critérios visuais e handoff de aceitação de Attendance | Pendente |

## 5. AD-01 — Entradas confirmadas

| Papel | Entrada prioritária | Conteúdo inicial | Limite de autoridade |
|---|---|---|---|
| Professor | Sessões de hoje | Atribuições ativas de hoje, sessões abertas/por confirmar e ação para iniciar registo | Só sessões da própria atribuição ativa |
| Encarregado | Hoje e alterações | Estado confirmado do dia, alterações recentes e justificações permitidas | Só alunos com relação ativa |
| Aluno | Hoje e alterações | Estado confirmado próprio e alterações recentes | Só a própria informação |

A coordenação será definida em seguida. A sua entrada não pode ocultar nem misturar decisões de justificação, conflitos offline e alertas com ação humana pendente.

## 6. Exclusões

Este planeamento não inclui Finance, dashboard global, novas regras do Design System, código, CSS, base de dados, API, Figma, migrações ou deployment.

## 7. Próximo ponto de decisão

Concluir a entrada de coordenação: ordem de prioridade da fila operacional, informação mínima por item e ação segura principal.