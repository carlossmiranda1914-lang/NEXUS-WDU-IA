# MISSÃO 08B — Decisão D-04: Restricted Possible Match

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: segurança + privacidade + domínio + UX operacional
Implementação: NÃO AUTORIZADA por este documento

## 1. Problema
O Nexus pode suspeitar que a pessoa que está a ser matriculada já existe globalmente, mas a instituição atual não tem autorização para ver dados pertencentes a outra instituição.

O sistema precisa simultaneamente:
- evitar duplicação desnecessária de `Person`;
- impedir enumeração de pessoas no Nexus;
- não revelar escola anterior, histórico, documentos, financeiro, matrícula ou contactos protegidos;
- permitir continuidade operacional quando existem dados suficientes para confirmação segura.

## 2. Decisão central
Quando existir um possível match global que não possa ser exposto diretamente à instituição atual, o resolver devolve semanticamente `RESTRICTED_POSSIBLE_MATCH`.

Isto significa apenas:
> Existe informação suficiente para suspeitar que esta pessoa já pode existir no Nexus, mas não existe autorização suficiente para mostrar os dados protegidos usados nessa deteção.

`RESTRICTED_POSSIBLE_MATCH` nunca significa:
- pessoa confirmada;
- autorização de reutilização;
- transferência entre escolas;
- acesso ao histórico;
- motivo para revelar a instituição anterior.

## 3. O que a UI pode mostrar
Mensagem recomendada em linguagem humana:

`Encontrámos uma possível correspondência que precisa de confirmação adicional antes de criar um novo registo.`

A UI pode explicar a ação seguinte:
- confirmar um dado adicional trazido pela própria família;
- apresentar documento/identificador disponível;
- encaminhar para revisão quando não houver evidência suficiente.

A UI NÃO deve mostrar, salvo futura base legal/policy explícita:
- nome da outra instituição;
- número de matrículas noutras escolas;
- turma, notas, assiduidade ou financeiro de outra escola;
- documentos anexados por outra instituição;
- email/telefone obtido exclusivamente através de outra instituição;
- identificadores internos da outra escola;
- `person_id` global como dado navegável;
- lista de possíveis pessoas globais para exploração manual.

## 4. Anti-enumeração
O resolver é uma capacidade interna de um caso de uso autorizado, não um motor de pesquisa global.

Regras obrigatórias:
1. exigir autenticação e contexto institucional resolvido;
2. exigir um fluxo legítimo, como intake de matrícula;
3. limitar frequência e volume de tentativas;
4. não oferecer pesquisa aberta por nomes parciais para explorar pessoas globais;
5. respostas de erro/não-match/restricted não devem permitir inferir facilmente se uma pessoa específica existe no Nexus;
6. auditoria deve registar uso anormal do resolver sem copiar dados pessoais desnecessários para logs.

## 5. Confirmação por dados fornecidos no novo contexto
Uma correspondência restrita pode ser promovida para `REUSABLE_MATCH` apenas quando a nova instituição obtém evidência suficiente no seu próprio atendimento/processo.

Exemplos de evidência aceitável, conforme D-01/D-02 e futura implementação:
- NUC/BI/passaporte/cartão de residente apresentado no processo atual;
- student number local não serve para provar identidade noutra escola, salvo mecanismo de transferência formal;
- nome + data de nascimento + outro sinal independente suficientemente forte;
- autenticação da própria pessoa/encarregado em fluxo futuro, quando aplicável;
- documento civil apresentado e validado no contexto atual.

O sistema pode comparar internamente o novo dado com a Person existente sem revelar o valor previamente armazenado pela outra instituição.

Exemplo seguro:
`O documento apresentado corresponde a um registo existente. Confirmar reutilização desta pessoa?`

Exemplo proibido:
`O BI guardado pela Escola X é 00XXXXXXLA...`

## 6. Quando não desbloquear
Manter `RESTRICTED_POSSIBLE_MATCH` / encaminhar para revisão quando:
- existe apenas similaridade de nome;
- nome + data ainda produz múltiplos candidatos plausíveis;
- os dados adicionais entram em conflito;
- a única confirmação exigiria revelar dados privados de outra instituição;
- existem sinais de fraude/uso indevido;
- há identificadores civis contraditórios;
- o utilizador tenta repetidamente contornar o fluxo mudando pequenos detalhes.

## 7. Resultado da revisão
A revisão deve terminar num dos resultados:
- `CONFIRMED_REUSE` — reutilizar Person existente e criar apenas relações/recursos da instituição atual;
- `CONFIRMED_NEW_PERSON` — criar nova Person porque a correspondência foi descartada;
- `INSUFFICIENT_EVIDENCE` — manter processo pendente até obter informação adicional;
- `SECURITY_REVIEW` — bloquear/escalar quando houver indício de abuso ou conflito sensível.

Nenhum destes resultados transfere automaticamente histórico escolar.

## 8. Quem pode ver o quê
### Secretaria no caminho normal
Pode ver apenas informação já pertencente à instituição atual e dados que a própria família fornece no processo atual.

### Revisores autorizados
Podem receber metadados mínimos adicionais necessários para resolver o conflito, de acordo com D-05 e policies futuras.

Mesmo revisor autorizado não recebe acesso indiscriminado ao histórico da outra instituição. A necessidade de dados adicionais deve ser específica e auditada.

## 9. UX operacional
Evitar linguagem técnica como `restricted match`, `global person` ou `tenant`.

Estados humanos sugeridos:
- `Possível registo existente`;
- `Precisamos confirmar a identidade`;
- `Aguardando informação adicional`;
- `Em revisão de identidade`.

A ação principal deve ser contextual:
- `Adicionar dado de identificação`;
- `Confirmar com documento`;
- `Enviar para revisão`.

Nunca apresentar um botão genérico `Ignorar e criar mesmo assim` quando existe conflito não resolvido.

## 10. Matching e confidencialidade
O backend pode conhecer os motivos completos do match. A UI recebe apenas motivos autorizados.

Exemplo interno:
- mesmo NUC;
- nome normalizado compatível;
- mesma birth_date;
- Person associada a outra instituição.

Exemplo de resposta permitida:
- `strong_identifier_confirmed`;
- `additional_confirmation_required`;

Sem retornar a origem institucional do dado.

## 11. Criação de nova Person após restricted match
Não é permitida automaticamente.

Só ocorre quando:
1. revisão/fluxo autorizado conclui que não é a mesma pessoa; ou
2. evidência disponível é insuficiente e a política explicitamente permite criar nova Person com estado/flag de possível duplicação — **esta segunda opção fica fora do MVP e não deve ser implementada agora**.

Para o MVP, conflito não resolvido = não criar nova Person.

## 12. Não criar agora
Para evitar overengineering, D-04 NÃO autoriza:
- data clean room interinstitucional;
- portal de consulta entre escolas;
- federação de identidades entre instituições;
- matching biométrico;
- IA para decisão de identidade;
- score probabilístico exposto ao utilizador;
- sistema de consentimento interinstitucional genérico;
- transferência automática de dados escolares.

## 13. Testes derivados
- AC-D04-01: Escola A não consegue descobrir a escola anterior através do resolver.
- AC-D04-02: restricted match não devolve `person_id` navegável nem dados protegidos desnecessários.
- AC-D04-03: nome semelhante isolado nunca desbloqueia reutilização.
- AC-D04-04: dado civil forte apresentado no novo contexto pode confirmar reutilização sem revelar o valor previamente armazenado.
- AC-D04-05: conflito entre identificadores envia para revisão e não cria Person automaticamente.
- AC-D04-06: tentativas repetitivas de enumeração são limitadas/auditadas.
- AC-D04-07: confirmação de reutilização cria apenas relações/recursos da instituição atual.
- AC-D04-08: nenhuma decisão D-04 cria Membership ou transfere histórico automaticamente.

## 14. Impacto técnico esperado
Provavelmente será necessário que o serviço de resolução possua duas representações do resultado:
- `internal match result` com evidência completa, apenas backend;
- `authorized resolution view` minimizada para o utilizador/contexto atual.

A implementação deve evitar que controllers serializem diretamente rows/resultados globais do resolver.

## 15. Decisão fechada
D-04 fica FECHADA para planeamento:
- possível match global restrito não é revelado como diretório;
- a UI recebe mensagem minimizada e próxima ação;
- nova evidência fornecida no contexto atual pode confirmar reutilização;
- conflitos não resolvidos bloqueiam criação automática;
- nenhuma escola ganha acesso ao histórico de outra escola por reutilizar Person;
- anti-enumeração e auditoria são requisitos de segurança do resolver.

## 16. Próxima decisão
D-05 — definir autoridade e segregação de funções para conflitos de identidade:
- quais casos a Secretaria resolve no caminho normal;
- quais casos exigem Direção/Institution Admin ou função específica;
- como evitar que o mesmo utilizador crie o conflito e aprove uma exceção sensível;
- que evidência e motivo ficam registados.