# MISSÃO 08B — Decisão D-03: Reutilização de Person entre instituições

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: produto + domínio + segurança + privacidade
Implementação: NÃO AUTORIZADA por este documento

## 1. Problema
Uma `Person` pode já existir no Nexus por estar relacionada com outra instituição. Quando uma nova escola inicia matrícula para essa mesma pessoa, o sistema deve evitar duplicação sem transformar `people` num diretório global acessível entre escolas e sem conceder acesso ao histórico anterior.

## 2. Decisão central
A mesma `Person` global pode ser reutilizada por uma nova instituição **sem criar nova Person**, mas apenas através de um caso de uso de `institutional linking` autorizado, confirmado e auditado.

Reutilizar `Person` NÃO transfere automaticamente:
- Membership;
- StudentProfile;
- GuardianRelationship;
- Enrollment;
- documentos institucionais;
- histórico académico;
- financeiro;
- comunicações;
- permissões;
- qualquer outro recurso da instituição anterior.

A nova instituição recebe apenas as relações e recursos que criar legitimamente no seu próprio contexto.

## 3. Regra de isolamento
`Person` é global; relações e recursos escolares são institucionais.

Portanto:
- identidade humana pode ser a mesma;
- contexto escolar continua completamente separado;
- um UUID de Person nunca funciona como prova de acesso;
- qualquer endpoint que use uma Person existente deve provar a relação/autorização necessária para o caso de uso atual.

## 4. Fluxos permitidos
### Caso A — Person já relacionada com a instituição atual
Resultado: `LOCAL_MATCH`.

O utilizador autorizado pode confirmar a reutilização usando apenas dados que já pertencem ao contexto atual.

### Caso B — Person existe globalmente, mas sem relação com a instituição atual
Resultado: `REUSABLE_MATCH` somente quando o sistema possui evidência suficiente para propor reutilização sem expor dados de outras instituições.

Antes de criar `StudentProfile`/Enrollment na nova escola deve existir confirmação explícita do utilizador autorizado.

### Caso C — possível Person externa, mas confirmação exigiria revelar dados protegidos
Resultado: `RESTRICTED_POSSIBLE_MATCH`.

A UI não revela escola anterior, turma, matrícula, notas, financeiro, documentos, contactos institucionais nem outros dados protegidos.

O processo segue para revisão ou recolha de sinais adicionais.

### Caso D — correspondência insuficiente
Resultado: `REVIEW_REQUIRED` ou `NO_MATCH`, conforme contrato do resolver.

Nunca criar vínculo cross-institution automaticamente com baixa confiança.

## 5. O que a nova instituição pode receber no momento do matching
Princípio de minimização: apenas a informação pessoal estritamente necessária para confirmar a identidade e que a política permita utilizar nesse contexto.

Preferência de desenho:
- mostrar dados fornecidos pelo próprio intake;
- comparar internamente com dados globais;
- devolver razões abstratas como `identificador confirmado`, `nome e nascimento compatíveis`, `revisão adicional necessária`;
- não revelar a origem institucional do dado por padrão.

Dados da instituição anterior não são usados como conteúdo navegável da nova instituição.

## 6. Confirmação humana obrigatória
Para MVP, reutilizar uma Person que ainda não possui relação com a instituição atual exige confirmação humana explícita.

Não haverá criação automática de novo vínculo institucional só porque o resolver encontrou um candidato forte.

A confirmação deve registrar:
- instituição atual;
- Person reutilizada;
- utilizador/Person que confirmou;
- sinais usados para suportar a decisão, em forma minimizada;
- timestamp;
- correlation/request id quando disponível;
- resultado do caso de uso.

## 7. Papel autorizado — decisão para MVP
Para o caminho normal, `secretariat`, `director` e `institution_admin` podem confirmar a reutilização quando o resolver apresenta correspondência suficientemente forte e não existe conflito explícito.

Casos com `RESTRICTED_POSSIBLE_MATCH`, múltiplas correspondências ou conflito material não são resolvidos automaticamente pela Secretaria no caminho normal; devem seguir política de revisão definida em D-05.

`teacher`, `financial`, `student` e `parent` não recebem autoridade geral para vincular Person global a uma instituição através deste fluxo.

## 8. O que acontece após confirmação
O caso de uso pode, de forma transacional e idempotente:
1. reutilizar `people.id` existente;
2. criar/garantir `student_profiles(institution_id, person_id)` para a nova instituição quando apropriado;
3. criar a `EnrollmentApplication` no contexto atual;
4. criar eventos/auditoria.

Não criar Membership automaticamente. Login/acesso continua sendo um processo separado.

## 9. Transferência de escola não é reutilização de Person
Uma futura transferência escolar pode reutilizar a mesma Person, mas transferência de documentos/histórico requer um workflow próprio, autorização e evidência.

D-03 não autoriza compartilhamento automático de dados entre instituições.

`Person reuse` responde apenas: "é a mesma pessoa?".

`Data transfer` responde: "quais informações esta instituição pode receber?" e pertence a outro contrato.

## 10. Person com múltiplas instituições
É válido que a mesma Person possua relações simultâneas com múltiplas instituições, por exemplo:
- histórico numa escola e matrícula ativa noutra;
- instituições diferentes por contextos permitidos;
- pessoa que também seja staff/guardian/student em contextos diferentes.

Não impor unicidade global de instituição à Person.

Cada relação institucional continua com estado e autorização próprios.

## 11. Pesquisa global proibida
Não criar endpoint/UI do tipo:
`GET /api/people?q=...` que permita a qualquer Secretaria navegar por pessoas de todo o Nexus.

A resolução global deve estar encapsulada no caso de uso de intake, receber dados mínimos suficientes e devolver apenas resultados minimizados.

Rate limiting, logging e proteção contra enumeração devem ser considerados na implementação.

## 12. Anti-enumeração
O resolver não deve permitir descobrir sistematicamente se uma pessoa específica existe no Nexus através de mensagens diferentes demais.

Respostas externas devem evitar padrões como:
- "esta pessoa pertence à Escola X";
- "BI encontrado noutra instituição";
- "aluno já matriculado em Y".

Quando necessário, usar mensagem neutra: `Encontrámos uma possível correspondência que precisa de confirmação adicional.`

## 13. Concorrência
Duas instituições podem iniciar intake da mesma Person em paralelo.

Isso não é conflito por si só.

O sistema deve apenas impedir duplicação de Person quando existe identificador forte/constraint apropriada e manter cada StudentProfile/Enrollment isolado por instituição.

## 14. Correção de vínculo errado
Se uma instituição vincular incorretamente uma Person existente:
- não apagar histórico silenciosamente;
- não editar a Person para transformá-la noutra pessoa;
- bloquear/retificar a relação institucional afetada;
- registrar decisão/evidência;
- encaminhar eventual merge/split de Person para processo especializado futuro.

## 15. Critérios derivados
- AC-D03-01: Person existente pode ser reutilizada sem criar nova Person.
- AC-D03-02: reutilização numa nova instituição não concede Membership nem acesso ao histórico anterior.
- AC-D03-03: Secretaria da Escola A não recebe recursos institucionais da Escola B durante matching.
- AC-D03-04: reutilização cross-institution exige confirmação explícita no MVP.
- AC-D03-05: confirmação cria apenas relações/recursos da instituição atual.
- AC-D03-06: UUID global fornecido pelo cliente não basta para criar Enrollment/StudentProfile.
- AC-D03-07: `RESTRICTED_POSSIBLE_MATCH` não revela instituição de origem ou dados protegidos.
- AC-D03-08: tentativa de enumeração fica limitada, auditada e sem respostas excessivamente reveladoras.
- AC-D03-09: duas instituições podem ter StudentProfile válido para a mesma Person sem partilhar dados institucionais.
- AC-D03-10: erro de vinculação é corrigido por workflow/auditoria, não por destruição silenciosa de Person.

## 16. O que NÃO implementar agora
- consentimento interinstitucional genérico;
- portal central de transferência de histórico;
- data-sharing entre escolas;
- merge automático de Person;
- instituição proprietária da Person;
- criação automática de Membership;
- pesquisa global navegável;
- mecanismo nacional/federado de identidade.

## 17. Resultado da decisão
D-03 fica FECHADA para planeamento:
- Person é reutilizável entre instituições;
- reutilização não transfere recursos nem privilégios;
- confirmação humana é obrigatória para novo vínculo no MVP;
- Secretaria pode confirmar match forte normal;
- conflitos/restricted matches vão para revisão;
- pesquisa global aberta é proibida;
- linking e data transfer são problemas diferentes.

## 18. Próxima decisão
D-04 — definir o comportamento exato de `RESTRICTED_POSSIBLE_MATCH`: quais sinais podem ser mostrados à Secretaria, que perguntas adicionais podem ser feitas, quando o sistema pode converter o caso em `REUSABLE_MATCH` e quando deve permanecer bloqueado para revisão.
