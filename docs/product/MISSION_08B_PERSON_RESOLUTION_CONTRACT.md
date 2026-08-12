# MISSÃO 08B — Person Resolution & Enrollment Intake Contract

Estado: PREPARAÇÃO
Tipo: domínio + segurança + dados + experiência operacional
Implementação funcional: NÃO AUTORIZADA

## 1. Objetivo humano
Permitir que a Secretaria inicie uma matrícula identificando corretamente a pessoa antes de criar qualquer novo registo escolar, preservando uma única história por pessoa e impedindo duplicações, associações institucionais indevidas e exposição de dados entre instituições.

## 2. Regra central
Nenhuma nova `Person` deve ser criada apenas porque um nome foi digitado num formulário de matrícula.

O fluxo obrigatório é:
`captar dados mínimos -> resolver Person -> confirmar decisão -> garantir StudentProfile institucional -> criar EnrollmentApplication`.

## 3. Escopo obrigatório agora
### OBRIGATÓRIO
- resolver Person antes de criação;
- reutilizar Person existente quando a correspondência for suficientemente comprovada;
- impedir criação automática em caso de ambiguidade;
- garantir isolamento institucional e minimização de dados;
- garantir transação atómica Person/Profile/Enrollment quando houver criação;
- garantir idempotência do intake;
- auditar decisão de reutilizar/criar/bloquear;
- garantir que UUID global de Person não equivale a autorização institucional;
- testes negativos Escola A -> Escola B;
- comportamento explícito para loading, vazio, erro, conflito e sucesso.

### PREPARAR, MAS NÃO PRECISA SER IMPLEMENTADO NESTA PRIMEIRA ENTREGA
- resolução completa de encarregados;
- documentos oficiais como identificadores;
- importações de sistemas externos;
- matching com escola anterior;
- reconciliação/merge de pessoas já duplicadas;
- self-service da família;
- Student 360 visual.

### OVERENGINEERING / NÃO IMPLEMENTAR AGORA
- IA para decidir identidade;
- fuzzy matching opaco com score como única base de decisão;
- motor genérico de Master Data Management;
- merge automático de pessoas;
- dezenas de tipos de identificadores antes de necessidade comprovada;
- motor de regras genérico para todos os domínios;
- pesquisa global de pessoas exposta ao cliente.

## 4. Modelo de domínio preservado
- `Person`: ser humano único e global.
- `Identity`: credencial/autenticação; não é documento civil.
- `StudentProfile`: papel escolar de uma Person dentro de uma instituição.
- `GuardianRelationship`: relação institucional explícita entre pessoas.
- `EnrollmentApplication`: processo de matrícula, não identidade.

`people` não recebe `institution_id`. O isolamento ocorre nas relações e recursos institucionais.

## 5. Estados de resolução propostos
O resolver deve produzir um resultado explicável, nunca uma decisão opaca:
- `NO_MATCH` — nenhuma correspondência suficientemente útil;
- `LOCAL_MATCH` — Person já relacionada de forma válida com a instituição atual;
- `REUSABLE_MATCH` — possível Person existente que pode ser reutilizada após confirmação adequada, sem expor dados proibidos;
- `MULTIPLE_MATCHES` — mais de um candidato plausível;
- `REVIEW_REQUIRED` — dados insuficientes/ambíguos para decisão segura;
- `RESTRICTED_POSSIBLE_MATCH` — possível correspondência existe, mas o utilizador atual não pode receber dados que revelem contexto de outra instituição.

A implementação final pode reduzir ou renomear estados, mas deve preservar as semânticas de segurança acima.

## 6. Sinais de identidade — proposta inicial
### Sinais fortes
- `student_number` dentro da instituição, quando existente;
- `legacy_student_id` quando previamente validado;
- Firebase Identity quando a própria pessoa já possui autenticação;
- identificador oficial verificado, se aprovado e modelado futuramente.

### Sinais compostos
Usados em conjunto e sempre explicáveis:
- nome normalizado;
- data de nascimento (necessidade de modelação ainda a decidir);
- telefone/contacto;
- contacto do encarregado;
- relação familiar já existente.

### Sinais fracos
Apenas para ordenar/auxiliar revisão:
- similaridade de nome;
- escola/turma anterior;
- dados contextuais não verificados.

Nenhum sinal fraco isolado autoriza reutilização ou merge.

## 7. Privacidade e multi-instituição
A pesquisa pode usar dados globais internamente para evitar duplicação, mas não pode funcionar como diretório global de pessoas para uma instituição.

Regras:
1. o contexto institucional é resolvido no backend;
2. o cliente não recebe histórico, instituição anterior ou dados pessoais de outra instituição sem autorização explícita;
3. um possível match restrito pode ser indicado como `RESTRICTED_POSSIBLE_MATCH` sem revelar detalhes protegidos;
4. IDs globais não concedem acesso;
5. qualquer nova associação institucional deve ser criada apenas pelo caso de uso autorizado e auditado.

## 8. Contrato do Intake
### Fase A — Captar
Receber dados mínimos suficientes para procurar candidatos, sem criar Person.

### Fase B — Resolver
Normalizar os dados permitidos, procurar candidatos e devolver resultado + razões de correspondência autorizadas.

### Fase C — Confirmar
Uma decisão explícita deve existir:
- reutilizar Person local/existente;
- confirmar que nenhum candidato corresponde e criar nova Person;
- encaminhar para revisão.

### Fase D — Persistir
Dentro de uma única transação:
- criar Person apenas se necessário;
- criar/garantir StudentProfile na instituição;
- criar EnrollmentApplication;
- criar EnrollmentEvent;
- criar evidência/auditoria da decisão.

Falha em qualquer etapa crítica -> rollback.

## 9. Idempotência
O intake é uma operação idempotente.

Retry da mesma operação com a mesma idempotency key deve devolver o mesmo resultado lógico e nunca criar uma segunda Person, StudentProfile ou EnrollmentApplication.

A estratégia técnica exata (tabela/constraint/outbox/registro de command) será escolhida na análise de implementação, mantendo o menor mecanismo seguro.

## 10. Regras para StudentProfile
- se Person já tem StudentProfile na instituição, reutilizar;
- se não tem e o intake está autorizado, criar o perfil institucional;
- a constraint `(institution_id, person_id)` permanece a proteção estrutural;
- criar perfil não concede Membership nem credencial de login.

## 11. Encarregado
A primeira entrega da 08B não precisa resolver toda a identidade do encarregado.

Divisão recomendada:
- 08B.1 — Student Person Resolution + Enrollment Intake;
- 08B.2 — Guardian Resolution + GuardianRelationship.

Mesmo assim, nenhum fluxo novo deve voltar a criar encarregado cegamente apenas por nome quando a 08B.2 for iniciada.

## 12. API — contrato conceitual
Não fechar nomes de endpoint antes da tarefa técnica, mas separar responsabilidades:

- resolver candidatos de Person sem efeitos colaterais;
- confirmar decisão de identidade;
- executar intake idempotente e transacional.

A UI nunca implementa matching como regra autorizadora.

## 13. UX mínima da 08B.1
Três passos humanos:
1. `Identificar aluno`;
2. `Confirmar correspondência`;
3. `Iniciar matrícula`.

Casos visíveis:
- nenhum candidato -> permitir criação confirmada;
- correspondência local clara -> oferecer reutilização;
- múltiplos candidatos -> pedir confirmação;
- possível correspondência restrita -> informar necessidade de revisão sem expor dados protegidos;
- erro -> não criar nada silenciosamente.

Sem redesign geral do módulo nesta missão.

## 14. Critérios de aceitação propostos
- AC-01: nova pessoa sem correspondência pode originar Person + StudentProfile + Enrollment em transação única;
- AC-02: Person existente local é reutilizada sem duplicação;
- AC-03: ambiguidade não cria Person automaticamente;
- AC-04: retry idempotente não duplica recursos;
- AC-05: Escola A não recebe dados indevidos de Person associada à Escola B;
- AC-06: Person ID global manipulado não cria associação institucional indevida;
- AC-07: falha parcial causa rollback completo;
- AC-08: decisão de criar/reutilizar/rever fica auditável;
- AC-09: StudentProfile existente é reutilizado;
- AC-10: manipulação do contexto institucional no cliente não concede acesso;
- AC-11: nenhum fallback cria dados fictícios/demonstrativos;
- AC-12: persistência é recuperável após nova sessão/restart;
- AC-13: loading/vazio/erro/conflito/sucesso são tratados na UI;
- AC-14: fluxo é validado em desktop/tablet/mobile quando a UI entrar no escopo.

## 15. Evidência mínima futura
- testes unitários de normalização/resolução;
- integração com PostgreSQL real de teste;
- duas instituições;
- Person local existente;
- Person global restrita;
- ambiguidade;
- idempotência/retry;
- rollback;
- manipulação de IDs/contexto;
- auditoria sem dados sensíveis;
- persistência após restart.

## 16. Decisões que NÃO serão tomadas silenciosamente
Estas decisões exigem aprovação explícita de produto antes de READY:

D-01 — `dateOfBirth` passa a ser dado canónico de Person? Se sim, em `people` ou numa estrutura de perfil pessoal separada?

D-02 — Quais identificadores oficiais são relevantes para o MVP em Angola e quais podem legal/operacionalmente ser usados para matching?

D-03 — Qual nível de confirmação humana é obrigatório antes de reutilizar uma Person que ainda não tem relação com a instituição atual?

D-04 — Como deve funcionar `RESTRICTED_POSSIBLE_MATCH` na prática sem expor dados de outra escola?

D-05 — Qual papel institucional pode confirmar criação de nova Person quando existe conflito/possível duplicação?

D-06 — Qual informação mínima deve ser captada presencialmente quando a família não possui documento/telefone/email disponível?

## 17. Recomendação técnica atual
Para o primeiro MVP:
- usar matching determinístico e explicável;
- privilegiar matches locais/institucionais fortes;
- usar sinais compostos apenas para sugerir/revisar;
- nunca fazer merge automático;
- não criar pesquisa global exposta;
- adiar motor genérico de identificadores até a decisão D-02 justificar schema novo.

## 18. Gate READY
A 08B só pode entrar em READY quando D-01 a D-06 estiverem decididas ou explicitamente removidas do escopo, os ACs forem aprovados e o plano de evidência estiver fechado.

Até lá: análise e documentação apenas. Nenhuma alteração funcional em migration 0006, `EnrollmentWorkspace` ou controller para implementar matching/intake.