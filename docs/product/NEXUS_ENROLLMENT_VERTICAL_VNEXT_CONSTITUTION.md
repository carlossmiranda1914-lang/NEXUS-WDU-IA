# NEXUS EDU IA — Constituição da Vertical Matrícula + Student 360 vNext

Estado: FONTE DE IMPLEMENTAÇÃO OBRIGATÓRIA

## 1. Mandato

Esta vertical não será construída como um conjunto de formulários isolados, remendos sobre o frontend legado ou telas demonstrativas. A implementação deve obedecer ao Documento Mestre de Planeamento, Plano Mestre, Arquitetura Oficial, Design System Oficial e benchmark operacional do Nexus.

Fontes oficiais consultadas no Google Drive:
- `Nexus_Edu_IA_Documento_Mestre_Planeamento_v1.docx`;
- `NEXUS_MASTER_PLANNING_V1.md`;
- `Plano_Mestre_Nexus_Edu_IA_v4_2_Multidispositivo.pdf`;
- `Nexus_Edu_IA_Arquitetura_Oficial_v4_0_Multidispositivo.pdf`;
- `Nexus_Edu_IA_Design_System_Oficial_v3_2_Multidispositivo.pdf`;
- `Nexus_Edu_IA_Relatorio_Pesquisa_Operacional_Benchmark_v1.pdf`;
- `Nexus_Edu_IA_Relatorio_Estrategico_Profundo_v2.pdf`.

## 2. Princípios de produto não negociáveis

1. O Nexus é um sistema operacional da instituição escolar, não um catálogo de módulos independentes.
2. Dados capturados uma vez devem ser reutilizados por matrícula, documentos, financeiro, comunicação, relatórios e Student 360.
3. A experiência deve privilegiar trabalho por processo e por exceção: o utilizador vê o que está em curso, o que falta, o que bloqueia e qual é a próxima ação.
4. Estados devem ser explícitos, verificáveis e observáveis.
5. A UI não inventa autoridade. Identidade, instituição, membership, papéis e decisões sensíveis são resolvidos e validados no backend.
6. O frontend deve esconder detalhes técnicos de identidade/tenant e apresentar linguagem operacional da Secretaria.
7. O produto deve seguir os princípios do Design System: clareza, confiança e integração; sem ruído visual, efeitos sem função ou elementos demonstrativos.
8. Mobile, tablet e desktop são requisitos de arquitetura visual, não adaptações posteriores.

## 3. Fluxo oficial da vertical

A vertical deve representar uma cadeia única e contínua:

`Entrada / candidatura → identificação → resolução da pessoa → recolha estruturada → documentos → verificação → condição financeira → Ready for Decision → decisão / ativação → Student 360 → processos downstream`

A passagem entre etapas deve preservar dados, histórico e evidência. Nenhuma etapa deve obrigar a redigitação de informação já capturada.

## 4. Estrutura funcional da experiência

### 4.1 Centro da vertical

A área `Alunos & Matrículas` deve deixar de misturar lista antiga de alunos com um pequeno formulário de matrícula. Deve funcionar como um workspace operacional com quatro perspectivas coerentes:

- **Visão operacional** — processos em curso, exceções, bloqueios, prazos e próximas ações;
- **Entradas / candidaturas** — novos interessados e processos ainda não ativados como alunos;
- **Matrículas** — processos por etapa, estado e responsável;
- **Alunos / Student 360** — registos ativos e visão longitudinal autorizada após ativação.

Estas perspectivas pertencem à mesma vertical e partilham a mesma fonte de verdade.

### 4.2 Processo individual de matrícula

Cada processo deve possuir uma visão própria, com:

- cabeçalho de estado e contexto;
- identidade e correspondência de Person;
- dados do aluno;
- encarregado/contactos quando aplicável;
- oferta/ano/turma quando aplicável;
- checklist documental;
- condição financeira relevante para a decisão;
- conflitos/exceções;
- timeline de eventos e auditoria;
- próxima ação recomendada;
- decisões/autorização quando necessárias.

A UI deve mostrar progresso real do processo, não apenas campos de formulário.

### 4.3 Student 360

Após ativação, o Student 360 torna-se o fio condutor longitudinal autorizado do estudante. Deve consolidar progressivamente:

- identidade e vínculos institucionais;
- matrícula e histórico de movimentações;
- turma/oferta/ano letivo;
- documentos e pendências;
- assiduidade;
- avaliação/desempenho;
- financeiro autorizado;
- comunicações e ocorrências relevantes;
- processos e ações pendentes;
- histórico cronológico/auditável.

A antiga `StudentsList` não é a referência funcional para este modelo.

## 5. Fronteira backend/frontend

### Backend preservado

As fundações T2–T6 continuam válidas e devem ser reutilizadas:

- Person Resolution determinística;
- restricted match e anti-enumeração;
- contexto institucional derivado do backend;
- idempotência persistente;
- intake transacional e rollback;
- decisões de autoridade/auditoria;
- API segura de integração.

### Frontend a substituir

A experiência legada que mistura:

- criação direta de Student;
- notas/assiduidade/saldo hardcoded ou derivados do modelo antigo;
- documentos simulados;
- comportamento como atributo genérico;
- separação artificial entre lista e matrícula;

não deve orientar a reconstrução vNext.

## 6. Política de migração visual

1. Não apagar indiscriminadamente navegação, autenticação, shell global ou componentes compartilhados que continuam válidos.
2. Isolar e retirar progressivamente componentes legados apenas da vertical `Alunos & Matrículas`.
3. Nenhuma tela nova deve importar o modelo legado `Student` como fonte principal de domínio para matrícula vNext.
4. Toda substituição deve preservar rollback por branch/PR.
5. O frontend novo deve consumir exclusivamente APIs vNext autorizadas.

## 7. Estados obrigatórios de UX

A experiência deve cobrir explicitamente:

- carregamento;
- vazio inicial;
- processo em curso;
- dados incompletos;
- documento em falta;
- identidade resolvida localmente;
- múltiplas correspondências;
- restricted possible match;
- decisão pendente;
- bloqueio/conflito;
- pronto para decisão;
- aprovado/ativado;
- erro recuperável;
- sucesso observável.

Mensagens genéricas como `Não foi possível concluir a operação` não são suficientes quando o backend possui um estado/erro operacional que pode ser traduzido com segurança para o utilizador.

## 8. Gate visual e operacional obrigatório

Nenhuma missão frontend desta vertical será marcada como concluída apenas com testes, lint e build.

É obrigatório provar:

- coerência com esta constituição e documentos oficiais;
- fluxo manual real de Secretaria;
- nenhuma tela legada concorrente para a mesma tarefa;
- clareza da próxima ação;
- desktop, tablet e mobile;
- estados de erro, vazio, revisão e sucesso;
- inexistência de exposição de IDs/tenant/roles técnicos;
- fidelidade ao Design System Oficial.

## 9. Sequência de reconstrução

A reconstrução deve ocorrer por fatias verticais completas, nesta ordem:

1. shell operacional da vertical e arquitetura de navegação;
2. inbox/entradas e mapa de processos de matrícula;
3. processo individual de matrícula com etapas e exceções;
4. integração completa com identidade T2–T6;
5. checklist documental e prontidão;
6. condição financeira/decision readiness;
7. ativação e transição para Student 360;
8. Student 360 mínimo funcional;
9. remoção definitiva dos caminhos legados substituídos;
10. validação multidispositivo e gate final de produto.

## 10. Regra de mudança

Qualquer alteração que contradiga esta constituição deve primeiro atualizar explicitamente a documentação oficial e justificar a decisão arquitetural. Não é permitido contornar a constituição por conveniência de implementação.
