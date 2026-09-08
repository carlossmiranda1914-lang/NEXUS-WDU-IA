# Nexus Aurora — Fundação de Layout Operacional

**Estado:** LAYOUT OFICIAL APROVADO — fundação obrigatória antes de componentes e implementação  
**Âmbito:** aplicação Nexus Edu IA inteira; reutilizável por Attendance, Documents Foundation e módulos futuros  
**Não é:** cópia de uma interface financeira, redesign de um módulo isolado ou autorização para alterar código

## 1. Decisão de produto

O Nexus usa um único **layout operacional adaptativo**: uma estrutura reconhecível, mas cuja densidade, painel de contexto e prioridade se ajustam ao papel, à tarefa e ao dispositivo. O resultado deve parecer um espaço de trabalho escolar preciso e humano, não uma coleção de dashboards genéricos.

Referências visuais aprovadas inspiram materialidade escura, profundidade controlada, navegação ancorada e verde aurora. Elas não autorizam copiar gráficos, métricas financeiras, textos, avatares, navegação ou composição de terceiros.

## 2. Princípios invioláveis

1. **Contexto antes de ação.** Cada vista explica processo, pessoa/turma/entidade, estado e próxima consequência.
2. **Um espaço, não uma parede de cartões.** A área central é a superfície de trabalho; cartões existem para orientar decisão, evidência ou acompanhamento.
3. **Profundidade com propósito.** Luz verde suave e contorno Aurora distinguem foco, decisão ou superfície especial — nunca todos os elementos.
4. **Densidade adaptativa.** Professor privilegia rapidez diária; coordenação privilegia fila, risco e prazo; aluno/encarregado privilegia clareza e acompanhamento.
5. **Painel direito só quando necessário.** Não há coluna permanente de notificações ou atividade decorativa.
6. **A mesma linguagem nos três modos.** Claro, Escuro e Tonal Nexus preservam geometria, prioridade, contraste e semântica.
7. **Nenhuma informação sensível vira decoração.** Dados, alertas, nomes e evidências surgem só no contexto e para o papel autorizados.

## 3. O Nexus Frame

Em desktop, a aplicação compõe-se de três regiões. A terceira é condicional.

| Região | Função | Regra |
|---|---|---|
| Barra de navegação | identidade, mudança de módulo, pesquisa e atalhos estáveis | persistente em desktop; não contém ações críticas do processo |
| Canvas de trabalho | tarefa, lista, dossiê, formulário ou análise do módulo | visualmente dominante; usa a largura disponível |
| Painel de contexto | decisão, alerta, detalhe temporal, evidência ou ação relacionada | só abre quando acrescenta valor; fecha sem perder a tarefa |

O Nexus Frame não exige que todos os módulos tenham três colunas. Attendance pode abrir um painel para sessão/conflito; Documents para decisão e versões; um ecrã de foco pode usar canvas de largura total.

### 3.1 Desktop

- barra lateral: largura estável, grupos de navegação por tarefa e módulo, item ativo com fundo/superfície aurora discreta;
- cabeçalho de canvas: breadcrumb contextual, título, estado e ações globais permitidas;
- canvas: grelha fluida de 12 colunas, largura máxima de leitura e zonas de decisão previsíveis;
- painel direito: folha lateral, não “dashboard de notificações”; tem título, fechar, conteúdo de uma intenção e ação principal única quando aplicável.

### 3.2 Tablet e mobile

| Dispositivo | Navegação | Contexto/decisão | Densidade |
|---|---|---|---|
| Tablet | barra lateral recolhível | folha lateral ou inferior | reduzida, sem perda de prioridade |
| Mobile | barra inferior para destinos principais e menu para restantes | folha inferior contextual | uma tarefa por vez; detalhe progressivo |

Não se comprime uma grelha desktop em três colunas no mobile. O utilizador mantém sempre contexto, estado e ação principal, com retorno à posição anterior.

## 4. Materialidade Aurora

### 4.1 Superfícies

O modo Escuro define a materialidade mais expressiva: base quase preta/verde-void, superfícies elevadas de tom profundo, separação por contraste tonal e sombra curta. O verde aurora é uma luz de orientação, não uma camada fluorescente.

| Nível | Uso | Tratamento visual |
|---|---|---|
| Base | janela/aplicação | mate, profundo, sem brilho contínuo |
| Canvas | trabalho principal | contraste calmo contra a base; espaçamento generoso |
| Superfície | painel, tabela, dossiê, formulário | elevação discreta e borda baixa |
| Foco Aurora | decisão, seleção, passo importante, conteúdo ativo | contorno fino com variação verde profunda → esmeralda suave; luz interna mínima |
| Estado semântico | sucesso, atenção, erro, informação | cor própria e texto explícito; não usa o verde de marca como cor universal de sucesso |

### 4.2 Contorno Aurora

O contorno Aurora só pode ser usado em quatro situações: ação primária focal, painel aberto de decisão, etapa atual de um percurso importante e conteúdo selecionado. Máximo uma superfície Aurora dominante por área visível. Não é usado em tabelas, todos os cartões, campos passivos ou alertas de erro.

### 4.3 Luz e movimento

- luz: gradiente muito suave, sem néon, sem brilho pulsante;
- sombras: curtas, difusas e subordinadas ao contraste; nunca efeito “flutuante” excessivo;
- movimento: transições 160–240 ms, redução obrigatória quando a preferência de movimento reduzido está ativa;
- nenhuma animação é portadora única de estado, progresso, êxito ou erro.

## 5. Densidade adaptativa por papel

| Papel/contexto | Prioridade de layout | Componentes dominantes | Evitar |
|---|---|---|---|
| Professor | ação diária rápida | sessão, lista de alunos, estado e confirmação | gráficos/indicadores que atrasem o registo |
| Coordenação/Secretaria | decisão e prazo | fila ordenada, filtros, evidência, painel contextual | excesso de cartões resumidos |
| Encarregado | compreensão e acompanhamento | estado da criança/processo, próximos passos e mensagens claras | linguagem interna e telemetria operacional |
| Aluno | orientação pessoal | tarefas, percurso, resultado e apoio | densidade administrativa |
| Administração | configuração responsável | formulários, políticas, impacto e auditoria contextual | ações destrutivas escondidas ou em massa sem confirmação |

O mesmo módulo pode mudar a sua densidade sem mudar a sua identidade. A autorização determina o conteúdo; o papel e dispositivo determinam a apresentação.

## 6. Famílias de superfícies

Não existe um cartão Nexus genérico. Cada superfície tem papel explícito.

| Família | Pergunta que responde | Estrutura mínima |
|---|---|---|
| Momento | “O que exige atenção agora?” | contexto humano, motivo, tempo/prazo, ação permitida |
| Decisão | “O que posso decidir e com que consequência?” | estado, evidência mínima, ação principal, confirmação quando necessária |
| Percurso | “Onde está este processo?” | etapas legíveis, etapa atual, bloqueio e próximo passo |
| Evidência | “O que foi confirmado e por quem?” | facto, origem/tempo autorizados e acesso ao histórico |
| Trabalho | “Onde executo a tarefa?” | conteúdo principal, controlos, estado e retorno de resultado |

O Nexus Path pode aparecer apenas em Percurso e Decisão: uma linha angular delicada que marca contexto → ação → validação → evidência → resultado. Não é decoração de cabeçalho nem ornamento em cada cartão.

## 7. Regras para informação, alertas e estados

- um alerta deve dizer âmbito, motivo, estado, prazo e ação humana pendente quando aplicável;
- notificações transitórias confirmam acontecimentos sem roubar foco; decisões persistentes abrem painel contextual ou entram na fila autorizada;
- estados técnicos e de negócio mantêm etiquetas/textos separados;
- vazio, indisponibilidade, acesso revogado e quarentena preservam o layout e mostram apenas ação permitida;
- métricas só surgem quando suportam uma decisão real. Um número sem consequência é removido.

## 8. Aplicação imediata aos módulos já definidos

| Módulo | Canvas principal | Painel condicional | Aplicação Aurora |
|---|---|---|---|
| Attendance | sessão, lista de alunos ou painel analítico por papel | conflito offline, alerta de limite, decisão de justificação | foco na sessão/decisão atual; não usar o verde para “presente” e “marca” ao mesmo tempo |
| Documents Foundation | dossiê com pré-visualização dominante ou fila restrita | decisão, versão, partilha ou retoma | contorno apenas na decisão ativa; silhueta neutra nos estados sem acesso |
| Módulos futuros | tarefa/contexto definido pelo domínio | detalhe que realmente reduz incerteza | devem reutilizar Frame, famílias e regras; não copiar ecrãs de Attendance/Documents |

## 9. Critérios de aceitação de layout

- um utilizador reconhece o Nexus Frame em qualquer módulo sem que todas as páginas pareçam iguais;
- o painel direito nunca ocupa espaço sem uma decisão, alerta ou contexto concreto;
- existe no máximo uma superfície Aurora dominante em cada área de trabalho;
- a densidade muda por papel e dispositivo, mantendo a mesma hierarquia;
- todos os três modos Aurora preservam contraste, foco visível, estados semânticos e leitura assistida;
- Attendance e Documents aplicam a fundação sem reabrir as suas regras de produto;
- antes de implementação, a fundação será convertida em tokens, componentes, exemplos desktop/tablet/mobile e validação visual aprovada.

## 10. Próximos cortes de Design System

1. tokens concretos de cor, tipografia, elevação, raio, espaçamento e motion para os três modos;
2. componentes-base: navegação, painel contextual, superfícies, botões, campos, tabela/fila, timeline, folhas e notificações;
3. padrões compostos: centro operacional, dossiê, sessão, formulário e estado crítico;
4. prancha visual oficial para validação nos três modos, aplicada a Attendance e Documents;
5. só depois, guia de implementação CSS/componentes e adoção progressiva por módulo.

## 11. Decisões de fundação aprovadas

### 11.1 Contraste do modo Escuro

O modo Escuro Nexus usa **preto-verde profundo como base** e **superfícies grafite suaves**. O verde Aurora não substitui a neutralidade das superfícies; aparece com moderação para foco, seleção, percurso e ação relevante.

Isto preserva uma atmosfera premium e confortável durante uso prolongado, sem converter o sistema numa interface verde saturada.

### 11.2 Geometria

Superfícies, campos, botões, folhas e painéis usam **arredondamento médio, preciso e consistente**. Não há mistura arbitrária de cartões muito redondos, cápsulas em excesso e cantos retos.

O valor numérico exato será um token único aplicado por família de componente; variações só podem existir quando justificadas por função, por exemplo controlo compacto versus superfície de trabalho.

### 11.3 Tipografia

A tipografia oficial deve ser **tecnológica mas humana**:

- títulos e números-chave com presença, ritmo e clareza;
- texto de leitura, tabelas e formulários otimizado para legibilidade prolongada;
- sem aspeto corporativo genérico, futurismo agressivo ou fontes decorativas;
- pesos, tamanhos e escala determinados semanticamente, não por módulo.

A família concreta e a escala serão escolhidas no corte de tokens tipográficos antes de qualquer implementação.

## 12. Validação visual aprovada

A amostra visual de Attendance para Coordenação foi aprovada como validação da direção, não como ecrã a copiar literalmente. A aprovação cobre: Nexus Frame com painel contextual condicional, canvas operacional dominante, profundidade Aurora controlada, superfícies grafite, verde reservado ao foco/decisão e densidade adaptativa.

Qualquer ecrã futuro deve provar estes princípios na sua própria tarefa e papel; não pode introduzir cartões de métricas, coluna de notificações permanente ou brilho Aurora indiscriminado apenas para reproduzir a amostra.
