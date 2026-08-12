# MISSÃO 08B — Decisão D-01: Identidade mínima de Person

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: produto + domínio + segurança + dados
Implementação: NÃO AUTORIZADA por este documento

## 1. Decisão
`dateOfBirth` passa a ser um atributo canónico da `Person`, global e não institucional, mas permanece **nullable**.

Razões:
- data de nascimento descreve a pessoa, não a escola;
- é um sinal importante para diferenciar homónimos;
- não deve ser duplicada em cada matrícula/instituição;
- na realidade operacional podem existir casos em que a data ainda não está disponível ou confirmada no primeiro contacto;
- ausência de data não deve impedir a criação controlada de um processo de intake, mas deve reduzir a confiança do matching e poder gerar pendência.

## 2. Modelo recomendado para o MVP
Adicionar futuramente a `people`:

- `birth_date DATE NULL`

Não adicionar agora:
- score de confiança da data;
- precisão aproximada de data;
- histórico próprio de versões da data;
- dezenas de campos demográficos;
- campo institucional duplicado para nascimento.

Correções posteriores devem ser auditáveis pelo mecanismo de auditoria/eventos aplicável, sem criar nova Person por conveniência.

## 3. O que `birth_date` NÃO significa
- não é identificador único;
- não autoriza acesso;
- não prova sozinho que duas fichas representam a mesma pessoa;
- não substitui documento oficial;
- não é obrigatória para existir `Person`;
- não pertence a `Identity` Firebase;
- não deve ser exposta a outra instituição apenas porque foi usada internamente para prevenção de duplicação.

## 4. Identidade mínima para intake
O intake deve distinguir `dados mínimos para iniciar pesquisa` de `dados suficientes para confirmar identidade`.

### Para iniciar pesquisa
Obrigatório no MVP:
- nome completo informado.

Recomendado quando disponível:
- data de nascimento;
- telefone/contacto relevante;
- student number existente;
- legacy student id validado;
- identificador oficial aprovado futuramente;
- referência de encarregado já existente.

### Para criar nova Person
A criação não depende obrigatoriamente de documento/telefone/email.

É permitida quando:
1. o utilizador autorizado declara que os dados mínimos disponíveis foram captados;
2. o resolver não encontrou correspondência suficientemente segura ou a revisão concluiu que não é a mesma pessoa;
3. a decisão fica auditada;
4. a ausência de dados relevantes gera pendência quando necessário para completar a matrícula.

Nome sozinho pode permitir criação **apenas depois do gate de resolução/revisão**, nunca por INSERT direto do formulário.

## 5. Matching com data de nascimento
### Regra
Nome + data de nascimento é um sinal composto relevante, mas não autoriza merge automático.

Exemplos:
- mesmo student number institucional -> sinal forte local;
- mesmo nome normalizado + mesma data de nascimento -> candidato forte para confirmação;
- nome semelhante + mesma data -> candidato para revisão;
- mesmo nome + data diferente -> não assumir correspondência;
- mesma data + nome diferente -> não assumir correspondência;
- data ausente -> usar outros sinais e aumentar prudência.

## 6. Data declarada vs data comprovada
No MVP não criar um subsistema de verificação demográfica.

A data armazenada pode ter origem declarada e ser posteriormente corrigida mediante evidência/autorização. O facto de uma data estar preenchida não deve ser tratado automaticamente como `verified`.

A eventual necessidade de distinguir `declared` e `verified` será tratada juntamente com D-02/documentos, se os fluxos reais justificarem essa complexidade.

## 7. Realidade angolana considerada
Referências oficiais angolanas mostram que nascimento e identificação civil são relacionados por `Assento de Nascimento`, `Boletim de Nascimento`, NUC/Bilhete de Identidade e, conforme o caso, documentação dos pais. Isto confirma que a data de nascimento é informação civil estável e útil, mas que o ecossistema documental pode variar conforme idade, momento do registo e situação do cidadão.

Para estrangeiros, documentos como passaporte/cartão de residente podem tornar-se identificadores relevantes em D-02.

O Nexus não deve pressupor que toda criança chega à escola com BI próprio, telefone ou email.

## 8. Privacidade
`birth_date` é dado pessoal e deve obedecer minimização e autorização.

Regras:
- backend pode usá-la na resolução quando necessário;
- UI mostra apenas a quem tem necessidade operacional autorizada;
- resultados cross-institution não devem revelar data completa apenas para provar que existe possível match;
- logs técnicos não devem imprimir data de nascimento sem necessidade explícita;
- métricas não devem expor datas individuais.

## 9. Impacto no modelo atual
Hoje `people` contém `name` e `phone`, sem data de nascimento. Portanto a futura implementação da 08B provavelmente exigirá migration aditiva para `birth_date`, mas essa migration somente será desenhada quando a missão entrar em READY.

Nenhuma alteração deve ser feita agora em `0006_vnext_enrollment_student360.sql`; uma mudança nova deve ser migration versionada posterior.

## 10. Critérios derivados
- AC-D01-01: Person pode existir com `birth_date = NULL`.
- AC-D01-02: quando disponível, `birth_date` é armazenada uma única vez na Person, não por instituição.
- AC-D01-03: matching nunca trata `birth_date` isoladamente como prova de identidade.
- AC-D01-04: nome + birth_date pode produzir candidato, mas decisão ambígua exige confirmação/revisão.
- AC-D01-05: instituição sem autorização não recebe birth_date de Person externa através do resolver.
- AC-D01-06: correção de birth_date não cria automaticamente nova Person.
- AC-D01-07: ausência de birth_date não bloqueia necessariamente intake, mas pode gerar pendência e reduzir matching automático.

## 11. O que esta decisão resolve
D-01 fica FECHADA para planeamento:
- data de nascimento é atributo de Person;
- é nullable;
- é usada como sinal composto;
- não é identificador único;
- não é prova de autorização;
- não obriga documento no primeiro contacto;
- não justifica motor complexo de verificação neste momento.

## 12. Próxima decisão
D-02 — definir o conjunto mínimo e realista de identificadores/documentos usados no contexto angolano para matrícula e matching, separando:
- identificador da pessoa;
- documento/evidência;
- identificador institucional do aluno;
- identificador de autenticação.

D-02 deve evitar transformar `identities` em repositório de documentos civis e deve manter casos de alunos sem documentação imediata.