# MISSÃO 08A — Blueprint Operacional de Matrícula + Student 360

Estado: PREPARAÇÃO
Tipo: produto + domínio + arquitetura. **Sem autorização para implementação funcional.**

## 1. Resultado humano

Uma Secretaria deve conseguir transformar uma intenção de matrícula num aluno corretamente identificado, documentalmente tratado, validado, ativado e colocado no contexto escolar, sem duplicar pessoas, sem reconstruir contexto em vários módulos e sem perder histórico.

A família deve saber o que falta e o que aconteceu sem depender de chamadas repetidas à escola quando o canal digital estiver disponível.

## 2. Princípios específicos

- procurar/reconciliar identidade antes de criar Person;
- Student nasce como papel escolar de Person, não identidade paralela;
- encarregado é Person relacionada explicitamente;
- requisitos são calculados pela oferta/política/contexto;
- processo normal avança automaticamente entre filas quando regras permitem;
- exceções viram tarefas claras;
- ativação é evento crítico confirmado e auditado;
- Student 360 nasce da ativação/projeção dos domínios, não de duplicação de dados;
- nenhuma escola vê ou referencia dados institucionais de outra sem autorização explícita.

## 3. Atores

- Secretaria: cria/recebe, identifica, recolhe, corrige e prepara.
- Família/encarregado: fornece/confirma dados e documentos quando canal disponível.
- Direção/Institution Admin autorizado: aprova exceções/ativação quando política exigir.
- Financeiro: resolve condição financeira quando aplicável.
- Sistema: deduz requisitos, deteta pendências, encaminha, notifica e regista evidência.

## 4. Caminho normal alvo

### E01 — Entrada
Origem: atendimento presencial, candidatura digital, renovação futura ou importação controlada.

Criar `EnrollmentCase`/processo com origem, instituição, período e responsável. Não criar Person automaticamente só porque existe um nome.

### E02 — Resolver identidade
Pesquisar por sinais permitidos: identificadores oficiais quando disponíveis, contacto, email, telefone, nome/data de nascimento e relações existentes.

Resultados:
- correspondência forte → reutilizar Person após confirmação adequada;
- ambígua → tarefa `Resolver identidade`;
- inexistente → criar Person com dados mínimos e proveniência.

Nunca fazer merge automático de pessoas com baixa confiança.

### E03 — Resolver relações
Confirmar/criar GuardianRelationship e contactos autorizados. Uma pessoa pode ter múltiplas relações; relação não equivale automaticamente a permissão total.

### E04 — Elegibilidade e oferta
Selecionar ano/oferta/turno/unidade conforme modelo aprovado. Validar estado da oferta, capacidade/vaga, critérios e instituição no servidor.

### E05 — Checklist dinâmico
Calcular requisitos a partir de política versionada: dados, documentos, consentimentos, avaliações/condições e itens financeiros aplicáveis.

Cada requisito possui estado, origem, responsável e possibilidade explícita de waiver/exceção quando permitida.

### E06 — Recolha e verificação
Receber dados/documentos uma vez; validar formato/proveniência; assinalar verificação humana quando necessária.

Sistema mostra apenas pendências acionáveis e não obriga a revisitar itens completos.

### E07 — Condição financeira
Quando política exigir, gerar/consultar obrigação apropriada. Matrícula não deve interpretar pagamento iniciado como confirmado. Exceções financeiras exigem autoridade e evidência.

### E08 — Ready for decision
Só atingir estado de decisão quando invariantes obrigatórias estiverem satisfeitas ou exceções formalmente aprovadas.

### E09 — Decisão/ativação
Ação crítica autorizada no backend. Transação deve produzir estado consistente e evento `EnrollmentValidated/Activated` conforme nomenclatura final.

### E10 — Pós-ativação
Consumidores idempotentes podem:
- criar/ativar Student profile;
- iniciar colocação/turma;
- atualizar Student 360;
- criar obrigações financeiras aplicáveis;
- emitir/solicitar documentos;
- enviar confirmação;
- criar tarefas pendentes permitidas.

Falha downstream não pode fingir que toda a cadeia terminou; estado e retry devem ser visíveis/seguros.

## 5. Estados propostos do processo

Nomes finais ainda sujeitos a validação operacional:
- draft;
- identity_review;
- collecting_requirements;
- awaiting_family;
- under_review;
- requires_decision;
- approved;
- activating;
- active;
- rejected;
- cancelled;
- blocked.

Evitar estados vagos que não indiquem quem/que ação falta.

## 6. Exceções obrigatórias a desenhar

- possível Person duplicada;
- aluno já ativo na mesma instituição/período;
- relação de encarregado contestada/incompleta;
- documento ilegível, expirado, inconsistente ou ausente;
- requisito dispensado por autoridade;
- oferta sem vaga;
- oferta suspensa/encerrada;
- condição financeira pendente;
- pagamento não conciliado;
- mudança de oferta durante processo;
- dados divergentes entre família e histórico;
- transferência com documentação incompleta;
- falha técnica após decisão mas antes de downstream completo;
- tentativa de referência cross-institution indevida.

Cada exceção deve definir owner, SLA quando aplicável, resolução e auditoria.

## 7. Student 360 — contrato funcional

Student 360 é uma projeção contextual, não um novo silo.

Deve apresentar, conforme autorização:
- identidade e dados essenciais;
- encarregados/relações;
- estado escolar atual;
- matrículas e histórico;
- turma/oferta;
- documentos e pendências;
- assiduidade;
- avaliação/progressão;
- posição financeira relevante sem expor além do necessário;
- comunicações relevantes;
- tarefas/exceções abertas;
- timeline de eventos significativos.

A primeira vista deve responder: `Quem é?`, `Qual é a situação atual?`, `O que precisa de atenção?`, `Qual foi o histórico relevante?`.

## 8. Modelo de dados — decisões antes de schema

A migration 0006 existente é protótipo e não deve ser expandida até fechar:
- diferença entre candidatura, caso de matrícula e matrícula efetiva;
- estratégia de deduplicação/reconciliação de Person;
- requisitos configuráveis/versionados;
- capacidade/vaga e reserva;
- relação entre offer e academic year sem reescrever história;
- estados e event log;
- idempotência da ativação;
- contratos downstream;
- política de cancelamento/reabertura/correção.

Nenhuma destas decisões deve ser resolvida apenas porque o schema atual já possui determinada tabela.

## 9. UX alvo da Secretaria

### Caixa de trabalho
Em vez de abrir `Matrículas` e procurar manualmente:
- Novas para tratar;
- Aguardam família;
- Identidade por resolver;
- Documentos por validar;
- Sem vaga/decisão necessária;
- Condição financeira;
- Prontas para ativar;
- Falhas/exceções.

### Processo individual
Cabeçalho: pessoa/aluno + estado + oferta + responsável + próxima ação.

Corpo: pendências primeiro; depois dados essenciais, relações, requisitos/documentos, financeiro relevante, comunicação e timeline.

Ações usam linguagem escolar: `Confirmar identidade`, `Pedir documento`, `Validar requisitos`, `Enviar para decisão`, `Ativar matrícula`. Evitar termos técnicos.

## 10. Automação alvo

Automático quando seguro:
- reaproveitar dados confirmados;
- calcular checklist;
- detetar duplicação potencial;
- criar pendência;
- encaminhar fila;
- preparar lembrete;
- sinalizar atraso;
- produzir eventos downstream após confirmação.

Humano:
- confirmar correspondência ambígua;
- aprovar exceção;
- validar documento que exige julgamento;
- decidir vaga especial;
- aprovar condição financeira sensível;
- ativar quando policy exigir confirmação.

## 11. Multi-instituição e autorização

Todas as queries/comandos partem do institutional context resolvido no servidor.

IDs globais de Person não concedem acesso por si. Endpoints devem provar que relações/recursos referenciados são válidos para o caso e contexto institucional.

Testes negativos obrigatórios: Escola A não consegue listar, ler, alterar, transicionar, anexar, relacionar ou subscrever casos/recursos da Escola B manipulando IDs.

## 12. Evidência mínima para DONE futuro

- unit tests de invariantes/policies;
- integration tests API + PostgreSQL real de teste;
- cross-institution negative tests;
- idempotência e retry;
- restart/persistência;
- conflitos de identidade;
- documentos/requisitos;
- transições com pré-condições;
- ativação e eventos downstream;
- estados loading/vazio/erro/sucesso/sem permissão;
- desktop/tablet/mobile;
- validação manual por cenário de Secretaria;
- auditoria sem dados sensíveis;
- diff/CI/documentação conforme DoD.

## 13. Questões de produto que bloqueiam READY

1. Quais identificadores e combinações são aceitáveis para identificar/reconciliar uma pessoa no contexto angolano?
2. Qual terminologia final: candidatura, inscrição, matrícula, confirmação, renovação?
3. Quem possui autoridade final para ativação em cada tipo de instituição?
4. Quais documentos/requisitos são comuns e quais são configuráveis por instituição/oferta?
5. Como modelar vaga/reserva/lista de espera?
6. Em que momento financeiro bloqueia, alerta ou não interfere na matrícula?
7. Que dados a família pode fornecer/corrigir diretamente?
8. Quais documentos oficiais devem ser emitidos após matrícula?
9. Como tratar transferência e aluno vindo de outra instituição?
10. Que eventos downstream são obrigatórios no MVP?
11. Quais operações em lote são realmente necessárias à Secretaria?
12. Que métricas operacionais indicam que o fluxo melhorou o trabalho?

## 14. Métricas propostas

- tempo mediano entrada → ativação;
- toques manuais por matrícula normal;
- percentagem resolvida sem exceção;
- duplicações de Person detetadas/criadas;
- tempo em cada fila/pendência;
- documentos pedidos novamente por erro;
- contactos da família motivados por falta de visibilidade;
- ativações revertidas/corrigidas;
- falhas cross-institution = zero;
- percentagem de processos com próxima ação clara.

## 15. Próximo gate

Esta missão permanece PREPARAÇÃO até as questões bloqueadoras de produto serem resolvidas com pesquisa/validação suficiente e convertidas em critérios passa/falha.

Depois: criar issue da Missão 08A, matriz de decisões, ACs, plano de evidência e somente então declarar READY para análise técnica. A implementação existente permanece preservada como protótipo/evidência e não dita o desenho final.
