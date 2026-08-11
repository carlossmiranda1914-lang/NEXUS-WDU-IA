# NEXUS EDU IA - Documento Mestre de Planeamento v1

**Estado:** Referência canónica de planeamento.  
**Data:** 11 de agosto de 2026  
**Âmbito:** produto, operação, arquitetura, experiência, governação e roadmap.

## 1. Mandato do documento

Este documento consolida o planeamento funcional, operacional, arquitetural e de experiência do Nexus Edu IA. Ele existe para impedir que o produto evolua por acumulação de ecrãs, módulos demonstrativos ou remendos incrementais sem um fluxo operacional claro.

A regra central é simples: nenhuma implementação relevante deve avançar sem estar ligada a um problema real de uma escola, um fluxo ponta a ponta, uma fonte de verdade, uma autorização explícita, evidência verificável e um resultado operacional observável.

O Nexus deve ser tratado como um sistema operacional da instituição escolar: uma plataforma única que conecta pessoas, processos, dados, decisões, documentos, financeiro, comunicação e acompanhamento pedagógico, com experiências diferentes por papel e dispositivo, mas com as mesmas regras e fontes de verdade.

## 2. Hierarquia de fontes canónicas

O projeto passa a operar com uma hierarquia documental obrigatória. Em caso de conflito, decisões arquiteturais e invariantes aceites prevalecem sobre conveniências de implementação ou comportamento legado.

Nível A - Constituição e invariantes: ADRs aceites, Arquitetura Oficial, Definition of Ready/Done/Evidências e Workflow de desenvolvimento.

Nível B - Produto e realidade operacional: Plano Mestre, Relatório Estratégico Profundo, Benchmark Operacional e Mapa Operacional Geral.

Nível C - Blueprints: desenho profundo de cada vertical, incluindo fluxos, atores, estados, exceções, dados, automações e provas.

Nível D - Execução: issues, missões, tarefas técnicas, código, migrations, testes, PRs e evidências.

Toda nova missão deve identificar explicitamente quais documentos desta hierarquia se aplicam antes de entrar em READY.

## 3. Constituição arquitetural não negociável

A arquitetura institucional oficial mantém a cadeia Identity -> Person -> Membership -> Institution -> Resources.

Firebase autentica a identidade. PostgreSQL é a fonte de verdade para contexto institucional e autorização. O browser nunca é fonte autorizadora de tenant/institution.

Membership é a relação autorizadora entre pessoa e instituição. O papel institucional pertence à Membership, não à identidade global. Platform Admin e Institution Admin são conceitos distintos.

Um utilizador pode pertencer a várias instituições e ter papéis diferentes. Nenhuma migração pode aumentar privilégios automaticamente.

Todas as entidades de negócio novas devem ter institution_id e, quando aplicável, unit_id. Alteração de contexto institucional deve invalidar queries, caches sensíveis e subscrições em tempo real.

Operações críticas não podem ser apresentadas como concluídas sem confirmação real. IA, automações e interfaces usam as mesmas policies de autorização do utilizador.

Mudanças devem ser incrementais, testáveis, reversíveis e rastreáveis. Big-bang não é estratégia autorizada.

## 4. Princípios de produto

Fluxo antes de módulo. O Nexus deve representar trabalho real, não a estrutura interna do software.

Trabalho por exceção. O sistema executa o caminho normal quando seguro e chama pessoas apenas quando existe ambiguidade, decisão, bloqueio ou exceção.

Uma pessoa, uma história. O produto deve procurar e reconciliar identidade antes de criar uma nova Person.

Contexto antes de menus. Ao abrir um processo, o utilizador deve encontrar dados, estado, pendências, histórico, evidências e próxima ação no mesmo contexto.

Automação invisível. O utilizador vê o resultado e a próxima ação em linguagem humana, não termos como workflow, trigger, event bus ou agent.

Não pedir duas vezes informação já conhecida e autorizada para reutilização.

Toda métrica exibida deve apoiar entendimento, decisão ou ação. Evitar dashboards decorativos e vanity metrics.

## 5. Contexto operacional e diferenciação

A investigação de mercado e o benchmark apontam que muitos sistemas de gestão escolar ainda organizam a experiência por módulos: académico, tesouraria, secretaria, documentos, comunicação, RH, relatórios. Isso funciona, mas transfere ao utilizador a responsabilidade de conhecer a estrutura do software e procurar manualmente problemas.

O Nexus deve melhorar esse padrão: organizar a operação por processos completos, pendências, prioridades e exceções; reduzir reentrada manual; automatizar coordenação; manter histórico e evidência; e apresentar ao utilizador apenas a complexidade necessária ao seu papel.

Na realidade angolana, isso implica especial atenção à Secretaria, gestão documental, matrícula, propinas, reconciliação, emissão de documentos, comunicação com encarregados, operação com conectividade variável e simplicidade de uso.

## 6. Coluna vertebral funcional

Configurar escola -> configurar operação -> captar pessoas -> executar processos -> resolver exceções -> consolidar Student 360 -> medir e melhorar.

Essa sequência impede que Matrícula, Financeiro, Documentos ou Comunicação sejam configurados isoladamente. A instituição define parâmetros uma vez e os fluxos reutilizam esse contexto.

## 7. Mapa Operacional Geral - 15 macrofluxos

| ID | Macrofluxo | Objetivo |
|---|---|---|
| F01 | Captação, candidatura e admissão | Entrada inicial de interessados, dados mínimos, triagem e preparação para matrícula. |
| F02 | Matrícula | Identidade, encarregado, oferta, documentos, condições, decisão e ativação. |
| F03 | Renovação | Reutilizar histórico, confirmar alterações, requisitos anuais e continuidade. |
| F04 | Transferência | Entrada/saída, proveniência/destino, documentos, equivalências e histórico. |
| F05 | Student 360 | Visão longitudinal autorizada do estudante e do que requer atenção. |
| F06 | Estrutura académica e colocação | Ano, ciclo, oferta, turma, vagas, calendário e colocação. |
| F07 | Assiduidade | Registo, exceções, justificações, comunicação e acompanhamento. |
| F08 | Avaliação e progressão | Lançamento, validação, publicação, recuperação e progressão. |
| F09 | Financeiro | Planos, obrigações, pagamentos, conciliação, recibos e exceções. |
| F10 | Documentos e certificação | Pedido, preparação, validação, emissão, entrega e arquivo. |
| F11 | Comunicação | Mensagens, avisos, lembretes, entregabilidade e histórico autorizado. |
| F12 | Tarefas, aprovações e exceções | Orquestração do trabalho humano que não pode ser resolvido automaticamente. |
| F13 | Pessoas, staff e RH | Identidade, vínculos, funções, documentação e estado do colaborador. |
| F14 | Configuração e governação | Instituição, unidades, parâmetros, permissões, políticas e readiness. |
| F15 | Direção e supervisão | Decisões, riscos, capacidade, indicadores e exceções de alto impacto. |

## 8. Cadeias transversais

Entrada -> Aluno ativo: candidatura/admissão, resolução de identidade, matrícula, validação, ativação e criação do contexto escolar.

Dia escolar -> Ausência -> Exceção -> Resolução: registo, deteção, comunicação, tarefa e fecho.

Avaliação -> Validação -> Publicação -> Progressão: lançamento, revisão, publicação e decisão académica.

Obrigação -> Pagamento -> Conciliação: plano, obrigação, receção, conciliação, recibo/evidência e exceções.

Pedido documental -> Entrega: solicitação, elegibilidade, preparação, validação, emissão, disponibilização e arquivo.

Exceção -> Responsável -> Decisão -> Evidência -> Encerramento: padrão transversal para qualquer problema que não possa ser resolvido automaticamente.

## 9. Centro Operacional e experiência diária

A Home operacional não começa por perguntar 'que módulo quer abrir?'. Ela responde 'o que precisa da sua atenção?'.

O Centro Operacional deve combinar quatro zonas: Atenção agora, Trabalho de hoje, Ações contextuais e Estado da escola.

Cada cartão de atenção deve ter motivo, estado, responsável, idade/SLA quando aplicável e ação segura. Exemplo: '7 matrículas aguardam documentos; 3 bloqueiam ativação; Resolver agora'.

A navegação permanece para orientação e exploração deliberada. O Centro Operacional apresenta prioridades. As ações contextuais executam o trabalho. Não duplicar tudo nas três camadas.

## 10. Experiência adaptada por papel

| Papel | Prioridade operacional |
|---|---|
| Secretaria | Matrículas, renovações, transferências, pessoas, encarregados, documentos, pendências e exceções administrativas. |
| Financeiro | Obrigações, atrasos, pagamentos, conciliação, exceções, evidência e fecho diário. |
| Direção | Aprovações, riscos, capacidade, desempenho institucional e exceções de maior impacto. |
| Professor | Aulas de hoje, assiduidade, avaliações, situações de alunos e comunicação autorizada. |
| Encarregado/Família | Ações necessárias, pagamentos, documentos, mensagens e estado dos processos do educando. |
| Aluno | Informação relevante, tarefas, documentos, estado académico e comunicações autorizadas. |

## 11. Onboarding institucional guiado

Uma nova instituição deve ser configurada por uma experiência guiada, não pela descoberta manual de dezenas de páginas de definições.

O onboarding deve recolher apenas o necessário para colocar o próximo fluxo real a funcionar: instituição e unidades, escala aproximada, níveis/ciclos, ano letivo, ofertas/turmas, capacidade, práticas de matrícula, documentos exigidos, modelo financeiro, comunicação, principais dores operacionais e fontes de dados existentes.

As respostas podem gerar configurações sugeridas, tarefas, alertas de readiness e recomendações. Nunca podem atribuir privilégios ou contornar policies.

A configuração deve ser progressiva. Evitar questionário gigante obrigatório antes de a escola conseguir obter valor.

## 12. Questionários e recolha estruturada

O Nexus pode oferecer Forms/Questionnaires/Data Collection como capacidade reutilizável para onboarding, matrícula, informações familiares, autorizações, diagnóstico interno e outros processos.

Perguntas devem ter finalidade definida, contexto institucional, obrigatoriedade clara e lógica condicional. Recolher apenas o necessário para o objetivo.

Respostas podem alimentar tarefas, recomendações e workflows, mas informação pertencente a Person, Enrollment, Guardian, Finance ou outro domínio canónico deve terminar nesse domínio, e não numa base paralela de respostas.

Questionários nunca são fonte direta para concessão de privilégios ou decisões sensíveis.

## 13. Modelo profundo da vertical Matrícula + Student 360

A implementação atual da Missão 08 é tratada como prova técnica e protótipo de vertical. Não deve ser expandida por remendos até o blueprint estar READY.

Fluxo alvo: Entrada -> Resolver identidade -> Resolver encarregado/relações -> Elegibilidade/oferta/vaga -> Checklist dinâmico -> Recolha/verificação -> Condição financeira -> Ready for Decision -> Decisão/ativação -> Student 360 + processos downstream.

A criação de Person não pode ocorrer automaticamente apenas porque um nome foi digitado. Primeiro procurar/reconciliar; em caso de ambiguidade, criar tarefa 'Resolver identidade'; criar Person apenas quando não existir correspondência adequada.

Requisitos documentais devem ser configuráveis por oferta/ciclo. A máquina de estados deve validar pré-condições reais e não apenas permissões de transição.

A ativação deve produzir consequências downstream explícitas e auditáveis, sem ocultar falhas parciais.

## 14. Student 360

Student 360 não é um dashboard isolado; é uma projeção longitudinal autorizada sobre fontes reais de múltiplos domínios.

A primeira vista deve responder quatro perguntas: Quem é esta pessoa? Qual é a sua situação atual? O que precisa de atenção? Qual é o histórico relevante?

Pode agregar identidade, relações familiares, matrícula, turma, documentos, assiduidade, avaliações, financeiro relevante, comunicações, tarefas, exceções e timeline, sempre respeitando autorização e minimização de dados.

Student 360 deve evitar duplicar armazenamento quando a informação já pertence a outro domínio. É uma visão integrada, não uma nova fonte de verdade.

## 15. Financeiro como fluxo real

O gestor financeiro precisa de uma experiência rápida, simples e controlada. O sistema deve destacar pagamentos por conciliar, obrigações vencidas, exceções, reversões pendentes e fecho diário, sem exigir conhecimento técnico.

Operações frequentes devem ser rápidas; operações sensíveis devem exigir contexto, confirmação, segregação de funções quando aplicável e auditoria.

O fluxo financeiro ideal é obrigação -> pagamento -> conciliação -> evidência/recibo -> atualização do estado -> tratamento de exceções. O utilizador não deve procurar manualmente o que já pode ser deduzido com segurança pelos dados.

## 16. Ajuda incorporada e orientação

A ajuda deve viver dentro do fluxo, não principalmente num manual separado.

Incluir explicação contextual de estados e ações, onboarding progressivo no primeiro uso, estados vazios que ensinam a próxima ação legítima, pré-visualização de consequências antes de ações importantes e uma entrada de ajuda/pesquisa em linguagem natural.

No futuro, assistência conversacional pode guiar o utilizador até um workflow autorizado, mas não pode inventar permissões nem executar ações críticas sem confirmação e policy.

## 17. Automação

Padrão: Evento -> validar regras/contexto -> executar trabalho determinístico seguro -> registar evidência -> criar exceção/tarefa apenas quando necessário -> apresentar próxima ação em linguagem humana.

Exemplos: documento em falta gera pendência e lembrete permitido; pagamento confirmado atualiza obrigação elegível; matrícula pronta entra na fila de decisão; identidade ambígua bloqueia criação automática e pede reconciliação.

Automação nunca enfraquece isolamento institucional, autorização, auditoria ou separação de funções.

## 18. Regras de desenho de ecrãs

Antes de implementar qualquer ecrã relevante, responder: Para que utilizador/trabalho existe? Que decisão ou tarefa conclui? Que informação é necessária agora? O que pode ser inferido/preenchido? Qual o caminho normal e quais as exceções? Qual é a ação principal? O que acontece depois? Que evidência fica registada? Qual limite de autorização se aplica? O que aparece em vazio, erro e sem permissão?

Se estas perguntas não estiverem respondidas, o ecrã não está READY.

Preferir uma ação primária clara por estado, linguagem humana, formulários por etapas em mobile, pesquisa por entidades/processos e operações em lote apenas quando o trabalho escolar é naturalmente repetitivo e o escopo é explícito.

## 19. Governação por missões

Toda missão deve passar pelos estados oficiais: BACKLOG, PREPARAÇÃO, READY, ANÁLISE, PLANEADA, IMPLEMENTAÇÃO, VALIDAÇÃO, BLOQUEADA ou DONE.

READY exige problema objetivo, resultado observável, âmbito, dependências, fontes de verdade, critérios passa/falha, plano de prova e segurança/dados definidos.

DONE exige critérios aprovados, testes, persistência, segurança, multi-tenant, UI nos dispositivos aplicáveis, diff revisto, documentação atualizada e riscos P0/P1 resolvidos ou formalmente tratados.

Sem evidência não há aprovação; sem aprovação não há avanço de gate.

## 20. Estado atual e congelamento consciente

A Fundação multi-instituição foi consolidada e não deve ser reaberta como projeto geral. A implementação atual da Missão 08 já contém base de dados, API e workspace inicial, mas permanece como vertical em implementação.

O desenvolvimento funcional adicional de Matrícula/Student 360 fica congelado enquanto decisões de domínio capazes de alterar schema, contratos ou UX continuarem abertas.

A Missão 08A - Blueprint Operacional de Matrícula + Student 360 está em PREPARAÇÃO. O objetivo é transformar a vertical em especificação executável antes de voltar ao código.

## 21. Bloqueadores para READY da Missão 08A

1. Estratégia de identificação e reconciliação de Person.
2. Terminologia e estados operacionais finais da matrícula.
3. Autoridade final de ativação e decisões de exceção.
4. Requisitos/documentos configuráveis por oferta/ciclo.
5. Vagas, reservas, capacidade e lista de espera.
6. Relação entre condição financeira e ativação.
7. Self-service da família e limites do que pode ser submetido/alterado.
8. Documentos oficiais pós-matrícula e respetiva emissão/arquivo.
9. Transferência e entrada externa com histórico/evidência.
10. Eventos downstream mínimos do MVP após ativação.
11. Operações em lote necessárias para a realidade da Secretaria.
12. Métricas operacionais que realmente orientam trabalho e decisão.

## 22. Sequência recomendada de execução

1. Fechar decisões dos 12 bloqueadores da Missão 08A.
2. Converter decisões em critérios de aceitação passa/falha e matriz de evidências.
3. Decompor implementação em pequenas missões técnicas XS/S/M, sem alterar áreas fora de âmbito.
4. Implementar primeiro os contratos de domínio e segurança que suportam o fluxo real.
5. Completar experiência operacional da Secretaria e Student 360 apenas sobre contratos estáveis.
6. Validar com duas instituições, utilizadores de teste, persistência, estados de erro/vazio/loading e dispositivos aplicáveis.
7. Depois da primeira vertical comprovada, aplicar o mesmo método aos restantes macrofluxos.

## 23. Critério de sucesso do Nexus

O Nexus terá sucesso quando uma escola conseguir executar trabalho diário com menos procura manual, menos reentrada de dados, menos coordenação informal e mais clareza de responsabilidade; quando exceções chegarem à pessoa certa; quando a configuração inicial acelerar o primeiro valor; quando cada aluno tiver uma história contínua; e quando automação reduzir esforço sem sacrificar controlo, segurança ou evidência.

A medida de qualidade não será o número de módulos disponíveis, mas a quantidade de processos reais concluídos com segurança, simplicidade e rastreabilidade.

## 24. Fontes canónicas consultadas

- Plano Mestre Integrado Nexus Edu IA v4.2 Multidispositivo (Drive)
- Nexus Edu IA - Arquitetura Oficial v4 (GitHub / Drive)
- Nexus Edu IA - Definition of Ready, Definition of Done e Sistema de Evidências (GitHub)
- Nexus Edu IA - Workflow oficial de desenvolvimento com Codex (GitHub)
- ADR-001 - Identidade, Person, Membership, Institution e contexto institucional (GitHub)
- Relatório de Pesquisa Operacional e Benchmark de Sistemas de Gestão Escolar v1.0 (Drive)
- Relatório Estratégico Profundo v2 (Drive)
- NEXUS_OPERATIONAL_MAP_V1.md (GitHub)
- NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1.md (GitHub)
- MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md e Issue #24 (GitHub)

## 25. Regra de continuidade

Este documento não autoriza implementação por si só. Ele define o quadro de decisão. Cada vertical deve gerar blueprint, issue/missão, critérios de aceitação, plano de evidências e gate READY antes de qualquer alteração funcional relevante. Decisões futuras que alterem este documento devem ser versionadas e justificadas.