# MISSÃO 08B — Decisão D-06: Intake mínimo sem documentação/contactos

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: produto + domínio + segurança + operação escolar
Implementação: NÃO AUTORIZADA por este documento

## 1. Problema
O Nexus deve funcionar em situações reais em que a família chega à escola sem BI/NUC conhecido, telefone próprio, email ou documentação completa. A ausência de dados não pode obrigar a escola a inventar informação, nem pode justificar criação cega de uma nova Person.

## 2. Decisão central
O intake pode começar com informação incompleta, mas existe diferença entre:
- `mínimo para abrir o caso`;
- `mínimo para tentar resolver identidade`;
- `mínimo para criar Person após resolução`;
- `mínimo para ativar matrícula`.

A 08B trata apenas dos três primeiros. Ativação final e checklist documental pertencem às missões seguintes.

## 3. Mínimo para abrir o caso de intake
Obrigatório:
- nome informado da pessoa/aluno;
- instituição resolvida no backend;
- ator autorizado;
- origem do atendimento/processo (`presencial`, `digital`, `import_controlled` ou equivalente futuro);
- correlation/request context para auditoria quando disponível.

Não são obrigatórios para abrir o caso:
- documento civil;
- telefone;
- email;
- Firebase Identity;
- StudentProfile existente;
- Membership do aluno.

## 4. Dados adicionais a captar quando conhecidos
Perguntar de forma progressiva, não bloquear a operação inteira:
- data de nascimento;
- sexo/género apenas se existir requisito funcional/legal aprovado noutro contrato;
- telefone/contacto do responsável;
- nome do progenitor/encarregado;
- student number existente;
- legacy student id validado;
- identificador civil apresentado;
- referência de escola anterior quando necessária em etapa posterior.

A interface deve distinguir claramente `não informado ainda` de `não existe` e de `não aplicável`.

## 5. Regras para nome
Nome é obrigatório para iniciar o intake, mas não é identificador único.

Regras:
- preservar valor humano informado;
- normalizar apenas para pesquisa/comparação, sem destruir grafia original;
- não criar Person diretamente após preencher nome;
- nomes muito curtos/incompletos podem gerar `REVIEW_REQUIRED` ou pendência de complementação;
- não usar nomes fictícios como `Aluno Desconhecido` para contornar obrigatoriedade.

## 6. Data de nascimento desconhecida
`birth_date` permanece nullable conforme D-01.

Se desconhecida:
- resolver usa outros sinais disponíveis;
- confiança automática diminui;
- ausência pode gerar pendência;
- não inventar `01/01/<ano>` nem datas padrão;
- não bloquear necessariamente criação controlada de Person se o gate de resolução/revisão concluir `NO_MATCH` e o ator estiver autorizado.

## 7. Sem documento civil
Estado válido: `document_not_presented_yet` ou semântica equivalente de processo.

Regras:
- não preencher BI/NUC/passaporte com placeholder;
- não impedir abertura do intake;
- tentar resolução com sinais disponíveis;
- criar pendência documental somente quando política do processo exigir;
- eventual documento apresentado depois deve atualizar evidência/identificador sem criar nova Person.

## 8. Sem telefone/email
Telefone e email são canais, não prova obrigatória de existência da pessoa.

Regras:
- aluno menor pode não possuir contacto próprio;
- contacto de encarregado pode ser usado no workflow quando existir;
- ausência de email não impede Person nem intake;
- ausência de telefone não impede Person nem intake;
- não copiar automaticamente o contacto de outra Person para `people.phone` sem semântica clara;
- autenticação/login continua processo separado.

## 9. Criação controlada de Person com poucos dados
É permitida somente quando:
1. o resolver foi executado;
2. não existe match suficientemente seguro OU revisão autorizada concluiu que se trata de nova pessoa;
3. não existe conflito forte pendente de D-05;
4. o ator tem autoridade para a decisão;
5. a decisão e os sinais disponíveis ficam auditados;
6. dados ausentes permanecem `NULL`/pendentes, nunca fictícios;
7. a operação é idempotente e transacional.

Nome sozinho pode, em último caso operacional, resultar em Person nova, mas somente depois destas proteções.

## 10. Escala de completude operacional
Para UX, o Nexus pode apresentar estados simples de completude do intake, sem score técnico:
- `Dados mínimos recebidos`;
- `Identidade por confirmar`;
- `Informação adicional necessária`;
- `Identidade confirmada`.

Não usar percentagem de confiança visível como decisão automática.

## 11. Pendências
Informação ausente deve virar pendência acionável quando necessária.

Cada pendência deve ter:
- tipo;
- motivo;
- responsável/fila;
- estado;
- data de criação;
- resolução/evidência quando concluída.

A 08B não precisa criar agora um motor genérico de tarefas. Pode usar o menor mecanismo compatível com a arquitetura existente e evoluir na missão de workflows/exceções.

## 12. Cenários obrigatórios
### C1 — Nome + birth_date, sem documento/contacto
Resolver; se NO_MATCH confirmado, permitir criação controlada e intake.

### C2 — Apenas nome completo, família sem documentação naquele momento
Resolver com prudência; se não houver candidato/conflicto, criação controlada pode ocorrer com pendência explícita.

### C3 — Nome + contacto do encarregado, sem birth_date/documento
Usar como sinal composto fraco/moderado; nunca match determinístico isolado.

### C4 — Nome semelhante a Person existente e poucos dados
Não criar automaticamente; `REVIEW_REQUIRED`.

### C5 — Identificador forte apresentado depois de Person já criada
Re-resolver/validar antes de associar; se revelar possível duplicação, bloquear alteração silenciosa e encaminhar para conflito/revisão.

## 13. O que o sistema não deve fazer
- exigir email para criar aluno;
- exigir telefone próprio de menor;
- exigir BI universalmente para iniciar matrícula;
- inventar número documental;
- inventar data de nascimento;
- criar pessoa `temporária` descartável que depois vira outra Person;
- usar ausência de dados como razão para saltar o resolver;
- permitir que UI force `create_new=true` ignorando conflito forte.

## 14. Segurança
A falta de informação aumenta prudência, não privilégios.

- contexto institucional continua obrigatório;
- respostas do resolver continuam minimizadas;
- menos dados não autorizam pesquisa global mais ampla;
- casos de conflito seguem D-04/D-05;
- nenhuma informação ausente concede Membership/role;
- logs registram reason codes e IDs, não inventam nem repetem dados pessoais desnecessários.

## 15. Critérios derivados D-06
- AC-D06-01: intake pode começar sem documento, telefone ou email.
- AC-D06-02: nome é obrigatório para abrir intake, mas nunca tratado como identificador único.
- AC-D06-03: birth_date desconhecida permanece NULL; datas fictícias são proibidas.
- AC-D06-04: ausência documental não gera placeholder.
- AC-D06-05: resolver é executado mesmo em intake incompleto.
- AC-D06-06: poucos dados + ambiguidade resultam em revisão, não criação automática.
- AC-D06-07: Person pode ser criada com poucos dados apenas após decisão autorizada e auditada.
- AC-D06-08: adicionar identificador forte posteriormente não cria nova Person automaticamente.
- AC-D06-09: ausência de contacto não concede nem bloqueia autenticação; login continua separado.
- AC-D06-10: pendências permanecem explícitas e acionáveis quando necessárias.

## 16. Decisão final D-06
D-06 fica FECHADA para planeamento:
1. o Nexus aceita intake incompleto;
2. nome informado é o único campo humano universal para abrir o caso;
3. birth_date/documentos/contactos são captados quando disponíveis;
4. ausência nunca é preenchida com dados falsos;
5. o resolver nunca é ignorado;
6. baixa informação aumenta revisão;
7. criação com poucos dados é exceção controlada, idempotente, transacional e auditada;
8. completude para ativação da matrícula será definida em missões posteriores.

## 17. Consequência para READY
Com D-06, as decisões D-01 a D-06 do contrato 08B estão fechadas para planeamento. A missão pode seguir para Gate Review completo de READY, desde que ACs, evidência, escopo e decomposição técnica sejam consolidados e não exista contradição entre as decisões.