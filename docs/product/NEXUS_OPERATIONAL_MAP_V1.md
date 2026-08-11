# Nexus Edu IA — Mapa Operacional Geral v1

Estado: PREPARAÇÃO CANÓNICA DE PRODUTO

Objetivo: descrever como uma instituição escolar trabalha de ponta a ponta antes de desenhar módulos ou implementar novas funcionalidades. Este mapa não autoriza implementação por si só; cada vertical exige blueprint e Definition of Ready.

## 1. Tese do produto

O Nexus deve funcionar como sistema operacional da instituição: uma fonte de verdade, fluxos contínuos entre áreas, trabalho orientado por pendências/exceções e experiências simples por papel.

A unidade principal de design não é o menu nem o CRUD. É o trabalho real que começa com um acontecimento, atravessa decisões e termina com um resultado verificável.

## 2. Atores operacionais

### Externos
- candidato/aluno;
- encarregado de educação/família;
- potencial família;
- fornecedor/parceiro quando aplicável.

### Institucionais
- Secretaria/Atendimento;
- Direção;
- Coordenação pedagógica;
- Professor;
- Tesouraria/Financeiro;
- Recursos Humanos;
- Serviços administrativos/documentais;
- Administrador institucional;
- operador autorizado de suporte, quando existir.

Cada ação deve possuir ator, autoridade, contexto institucional e evidência.

## 3. Macrofluxos do ciclo de vida escolar

### F01 — Captação, candidatura e admissão
Gatilho: interesse de uma família/candidato.
Resultado: candidatura identificada, informação mínima recolhida e decisão/encaminhamento claro.

Subfluxos: lead/contacto → candidatura → triagem → visita/entrevista/teste quando aplicável → decisão → preparação de matrícula.

### F02 — Matrícula inicial
Gatilho: candidato elegível ou atendimento direto autorizado.
Resultado: aluno institucionalmente ativado ou processo encerrado com motivo.

Subfluxos: identidade → encarregado → oferta/vaga → requisitos → documentos → condições financeiras → validação → aprovação → ativação → eventos downstream.

### F03 — Renovação/rematrícula
Gatilho: abertura do ciclo de renovação.
Resultado: continuidade confirmada, pendência explicitada ou saída registada.

Automação desejada: pré-preenchimento a partir da verdade existente; solicitar apenas alterações, confirmações e requisitos novos.

### F04 — Transferência/entrada/saída
Gatilho: pedido de transferência ou mudança institucional.
Resultado: histórico preservado, documentos emitidos/recebidos, situação académica e financeira explicitada, saída/entrada auditada.

### F05 — Identidade e Student 360
Não é um CRUD isolado. É a visão longitudinal da pessoa/aluno.

Agrega, conforme autorização: identidade, relações familiares, matrículas, turma, frequência, avaliação, documentos, financeiro relevante, ocorrências, apoios, comunicações, tarefas e histórico de decisões.

### F06 — Estrutura académica e colocação
Gatilho: preparação do ano/período ou ativação de aluno.
Resultado: oferta, curso/classe, turma, disciplina, calendário e capacidade coerentes.

Inclui vagas/capacidade e impede colocações impossíveis ou silenciosamente incoerentes.

### F07 — Assiduidade e exceções de presença
Gatilho: aula/atividade escolar.
Resultado: presença registada; exceções relevantes transformadas em trabalho acionável.

Fluxo: registo simples pelo professor → deteção de ausência/padrão → justificação → contacto quando necessário → escalonamento → histórico.

### F08 — Avaliação, progressão e publicação
Gatilho: atividade avaliativa/período.
Resultado: avaliação válida, aprovada/publicada conforme regras e refletida no histórico.

Inclui lançamento, validação, fecho, correção auditada, pauta/boletim e decisão de progressão quando aplicável.

### F09 — Financeiro escolar
Gatilho: obrigação financeira, pagamento, ajuste ou exceção.
Resultado: posição financeira verdadeira e conciliada.

Fluxos: plano/obrigação → fatura/cobrança → pagamento → conciliação → recibo → atraso → acordo/isenção/ajuste autorizado → fecho.

Nunca repetir cobrança silenciosamente. Nunca confundir pagamento iniciado com confirmado.

### F10 — Documentos e certificação
Gatilho: requisito, upload, emissão ou pedido.
Resultado: documento recebido/verificado/emitido/assinado/entregue com proveniência e estado.

Inclui requisitos por processo, validade, versões, modelos oficiais, emissão em lote quando segura e documentos educacionais aplicáveis ao contexto local.

### F11 — Comunicação e relacionamento
Gatilho: evento, campanha, pendência ou mensagem humana.
Resultado: comunicação entregue/confirmada ou falha explicitada.

Canais podem incluir app, email, SMS/WhatsApp quando integrados e autorizados. Comunicação é consequência do fluxo, não base paralela de verdade.

### F12 — Pedidos, tarefas, aprovações e exceções
Camada transversal.

Todo trabalho que exige pessoa deve poder responder: o quê, porquê, responsável, prioridade, prazo, bloqueio, evidência e próxima ação.

Exemplos: validar documento; aprovar exceção de vaga; rever desconto; corrigir identidade; contactar encarregado.

### F13 — Pessoas, staff e RH
Gatilho: entrada/alteração/saída de colaborador.
Resultado: pessoa, vínculo, papel institucional e responsabilidades coerentes sem misturar identidade global com autorização institucional.

### F14 — Configuração e governação institucional
Gatilho: criação/alteração de regras institucionais.
Resultado: configuração versionada/auditada e aplicada apenas ao contexto correto.

Inclui instituição, unidades, ano letivo, oferta, permissões, políticas, templates, requisitos, integrações e parâmetros operacionais.

### F15 — Direção, supervisão e decisão
Não é apenas dashboard.

Direção recebe exceções, risco, aprovações e indicadores derivados dos fluxos: matrículas bloqueadas, vagas, inadimplência, frequência crítica, publicação pendente, carga operacional e qualidade dos dados.

## 4. Cadeias transversais prioritárias

### C01 — Entrada até aluno ativo
Candidatura/atendimento → Person → relações → matrícula → documentos → financeiro quando aplicável → decisão → Student → colocação → comunicação.

### C02 — Dia escolar
Turma/aula → presença → exceção → tarefa/comunicação → resolução → Student 360.

### C03 — Ciclo avaliativo
Plano → avaliação → lançamento → validação → publicação → comunicação → histórico/progressão.

### C04 — Receita
Obrigação → cobrança → pagamento → conciliação → recibo → posição financeira → exceção/escalonamento.

### C05 — Pedido documental
Pedido/requisito → elegibilidade → geração/recolha → validação/assinatura → entrega → auditoria.

### C06 — Exceção institucional
Evento detetado → classificação → responsável → SLA → decisão → ação → evidência → encerramento → métrica.

## 5. Modelo de experiência

### Home operacional
A primeira pergunta não é “que módulo quer abrir?”, mas “o que precisa da sua atenção?”.

Mostrar por papel:
- ações prioritárias;
- processos bloqueados;
- prazos próximos;
- exceções;
- trabalho atribuído;
- contexto resumido;
- acesso rápido ao processo completo.

### Centro de processo
Um processo deve concentrar informação e ações relevantes sem obrigar o utilizador a navegar por múltiplos módulos para reconstruir contexto.

Estrutura recomendada: resumo → próxima ação → pendências → dados essenciais → pessoas relacionadas → documentos → financeiro relevante → comunicações → timeline/evidência.

### Pesquisa global
Procurar pessoa, aluno, encarregado, processo, documento ou referência e chegar ao contexto autorizado correspondente.

## 6. Padrão de automação

Automatizar quando a ação é determinística, reversível/segura e derivável de regras confiáveis.

Exemplos:
- criar tarefas a partir de pendências;
- pré-preencher dados já conhecidos;
- calcular checklist aplicável;
- detetar atraso;
- encaminhar processo ao próximo responsável;
- preparar comunicação;
- atualizar projeções derivadas após evento confirmado.

Exigir intervenção humana quando houver julgamento, conflito de identidade, exceção de política, impacto financeiro sensível, decisão pedagógica, alteração crítica ou baixa confiança.

IA pode resumir, explicar, procurar, classificar e preparar rascunhos; não substitui policy nem confirmação humana para ações críticas.

## 7. Estados universais de processo

Cada vertical define estados próprios, mas deve distinguir pelo menos:
- rascunho;
- em progresso;
- aguardando terceiro;
- bloqueado;
- requer decisão;
- em processamento;
- concluído/confirmado;
- cancelado/encerrado;
- falhou/conflito quando tecnicamente aplicável.

Estado deve ter significado operacional, não apenas visual.

## 8. Padrão de exceção

Uma exceção precisa de:
- tipo e severidade;
- causa observável;
- processo/recurso afetado;
- responsável atual;
- prazo/SLA quando aplicável;
- ação recomendada;
- autoridade necessária;
- evidência de resolução;
- auditoria.

O sistema deve evitar dashboards que apenas mostram números sem permitir resolver a causa.

## 9. Contratos entre domínios

- Identity autentica; Person representa ser humano; Membership autoriza participação institucional.
- Student é papel/perfil escolar de uma Person, não nova identidade.
- GuardianRelationship liga pessoas explicitamente.
- Enrollment não deve criar duplicação de Person por conveniência.
- Document pertence ao contexto/processo adequado e mantém proveniência/estado.
- Financeiro reage a eventos confirmados e não a suposições da UI.
- Communication referencia evento/processo e guarda estado de entrega.
- Task referencia trabalho real e responsável.
- AuditEvent explica ação sensível sem expor segredos.
- Student 360 é projeção autorizada de múltiplos domínios, não uma tabela gigante duplicando verdade.

## 10. Realidade operacional de Angola — requisitos a validar

O produto deve validar com instituições reais, antes de congelar regras:
- terminologia escolar e administrativa;
- estrutura de classes/cursos/turnos;
- documentos oficiais e modelos exigidos;
- processos de matrícula, transferência e certificação;
- propinas, referências, pagamentos e conciliação;
- papel do encarregado;
- conectividade irregular e uso móvel;
- operações em lote de Secretaria;
- calendário e períodos;
- requisitos legais/regulatórios e retenção documental.

Benchmark é evidência de padrões, não substitui validação local.

## 11. Benchmark — padrões absorvidos, não interfaces copiadas

Padrões observados em sistemas locais e internacionais:
- candidatura/enrollment como jornada e não formulário isolado;
- checklists e acompanhamento de progresso;
- autoatendimento da família quando apropriado;
- integração direta com SIS para evitar redigitação;
- operações em lote para Secretaria;
- gestão financeira e deteção de atrasos;
- comunicação ligada ao processo;
- perfil consolidado do aluno/candidato;
- reporting e supervisão.

O diferencial pretendido do Nexus é combinar estes padrões com trabalho por exceção, contexto operacional único, automação segura e arquitetura multi-instituição rigorosa.

## 12. Anti-padrões proibidos

- criar módulo porque existe item de menu no sistema antigo;
- CRUD como definição suficiente de processo;
- duplicar Person/Student para simplificar formulário;
- pedir ao utilizador informação que o Nexus já conhece sem motivo;
- obrigar navegação entre módulos para descobrir a próxima ação;
- esconder falha atrás de toast de sucesso;
- usar dados mock num fluxo declarado real;
- autorizar tenant pelo browser;
- colocar regra crítica apenas na UI;
- automatizar decisão sensível sem policy/confirmação;
- dashboard sem capacidade de agir sobre a exceção;
- alterar schema antes de o fluxo e invariantes estarem aprovados.

## 13. Priorização de verticais

P0 Produto — primeiro ciclo:
1. Matrícula + identidade + Student 360.
2. Estrutura académica/colocação necessária à matrícula.
3. Documentos/requisitos da matrícula.
4. Financeiro mínimo ligado à ativação, quando a política institucional exigir.
5. Tarefas/exceções/comunicação necessárias ao fluxo.

P1:
6. Renovação e transferência.
7. Assiduidade e exceções.
8. Avaliação/publicação.
9. Financeiro completo.

P2:
10. RH/staff aprofundado.
11. analytics avançado e otimização.
12. automações/IA adicionais após dados e processos maduros.

A ordem pode mudar por evidência de campo, mas não por conveniência técnica.

## 14. Gate para qualquer blueprint

Antes de implementar uma vertical, responder:
1. Qual problema humano termina resolvido?
2. Quem inicia e quem termina?
3. Qual é o caminho normal mínimo?
4. Quais são as exceções reais?
5. Que dados são fonte de verdade?
6. Que entidades pertencem a que instituição/unidade?
7. Que decisões exigem autoridade humana?
8. O que pode ser automatizado com segurança?
9. Que outros domínios recebem eventos?
10. Como provar isolamento, persistência, autorização e UX?
11. Como funciona desktop/tablet/mobile?
12. Como migramos sem big-bang?

Se estas respostas não estiverem suficientemente fechadas, permanece PREPARAÇÃO.
