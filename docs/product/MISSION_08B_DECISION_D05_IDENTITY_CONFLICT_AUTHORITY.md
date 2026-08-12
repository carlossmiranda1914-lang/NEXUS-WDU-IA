# MISSÃO 08B — Decisão D-05: Autoridade para resolver conflitos de identidade

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: produto + segurança + autorização + auditoria + operação
Implementação: NÃO AUTORIZADA por este documento

## 1. Objetivo
Definir quem pode decidir, em cada nível de risco, se uma `Person` existente deve ser reutilizada, se uma nova `Person` pode ser criada apesar de uma possível correspondência, e quando uma segunda autoridade é obrigatória.

A decisão deve manter o fluxo simples para casos normais e forte para casos sensíveis.

## 2. Princípio central
A Secretaria resolve o caminho normal. Conflitos sensíveis não devem ser resolvidos silenciosamente pelo sistema nem por qualquer utilizador apenas porque possui acesso ao módulo de matrícula.

Autoridade segue o risco da decisão, não a conveniência da interface.

## 3. Classificação operacional dos casos

### Nível A — confirmação normal
Características:
- correspondência local forte;
- dados apresentados no atendimento confirmam a pessoa;
- não existem sinais contraditórios;
- não existe possível match restrito não resolvido;
- não há necessidade de ignorar evidência existente.

Autoridade:
- `secretariat`;
- `director`;
- `institution_admin`.

Ação permitida:
- confirmar reutilização da Person;
- garantir/reutilizar StudentProfile institucional;
- continuar intake.

Segunda aprovação: NÃO.

### Nível B — ambiguidade operacional resolvível
Características:
- múltiplos candidatos locais plausíveis;
- grafia/nome diverge, mas existe documentação ou combinação de sinais suficiente;
- dados antigos incompletos e dados novos permitem confirmação razoável;
- não existe conflito forte entre identificadores oficiais.

Autoridade:
- `secretariat` pode preparar e propor a resolução;
- `director` ou `institution_admin` confirma a decisão final quando a resolução implicar reutilizar uma Person entre candidatos concorrentes.

Segunda aprovação: SIM, quando houver mais de um candidato real ou quando a decisão alterar uma associação institucional relevante.

### Nível C — conflito sensível
Características:
- identificador oficial aponta para Person diferente da sugerida por outros sinais;
- possível correspondência restrita não pode ser confirmada com dados novos suficientes;
- existe forte suspeita de duplicação, mas criar nova Person exigiria ignorar candidato existente;
- dados de nascimento/nome/identificador apresentam contradição material;
- tentativa de associar UUID global de Person sem prova operacional suficiente;
- resolução pode afetar histórico de mais de uma instituição.

Autoridade:
- Secretaria NÃO decide sozinha;
- `director` ou `institution_admin` deve decidir;
- quando houver impacto interinstitucional ou identificador civil conflitante, preferir `institution_admin` como autoridade final do MVP.

Segunda aprovação:
- obrigatória quando a decisão for `CRIAR_NOVA_PERSON_APESAR_DE_CONFLITO`;
- recomendada quando houver conflito de identificador oficial;
- a segunda aprovação não pode ser do mesmo utilizador que propôs a exceção.

### Nível D — merge/correção global de identidade
Características:
- duas Persons já existentes parecem representar a mesma pessoa;
- seria necessário fundir histórico ou reatribuir relações/recursos globais;
- impacto potencial em várias instituições.

Autoridade no MVP:
- NÃO É OPERAÇÃO DA 08B;
- nenhuma role institucional executa merge global;
- criar caso administrativo específico para futura capacidade de reconciliação global.

Resultado:
- matrícula pode ficar bloqueada/review-required até decisão apropriada;
- não implementar merge automático nem manual genérico agora.

## 4. Matriz de autoridade resumida

| Caso | Secretaria | Direção | Institution Admin | Segunda aprovação |
|---|---|---|---|---|
| Reutilização local clara | Sim | Sim | Sim | Não |
| Novo registo sem match/conflicto | Sim | Sim | Sim | Não |
| Múltiplos candidatos plausíveis | Propõe | Confirma | Confirma | Sim |
| Restricted match confirmado por nova evidência forte | Propõe | Confirma | Confirma | Sim |
| Criar nova Person apesar de conflito forte | Não | Propõe/Confirma conforme policy | Sim | Obrigatória |
| Conflito de identificador oficial | Não | Sim, se policy permitir | Sim | Recomendada/obrigatória conforme impacto |
| Merge de Persons existentes | Não | Não | Não no MVP | Fora da 08B |

## 5. Regra para criação de nova Person

### Caminho normal
Se o resolver retorna `NO_MATCH` e não há sinais de conflito, `secretariat`, `director` ou `institution_admin` podem confirmar a criação.

### Sob suspeita de duplicação
Se existe `REVIEW_REQUIRED`, `MULTIPLE_MATCHES` ou `RESTRICTED_POSSIBLE_MATCH` não resolvido, a Secretaria não pode usar uma ação de bypass para criar uma nova Person.

A criação somente pode acontecer após:
1. recolha de evidência adicional;
2. registo da razão da decisão;
3. aprovação da autoridade exigida pelo nível de risco;
4. segunda aprovação quando aplicável;
5. auditoria da decisão.

## 6. Segregação de funções
A segregação deve ser aplicada apenas onde o risco justifica, para não tornar a Secretaria impraticável.

Obrigatória no MVP para:
- criar nova Person apesar de conflito forte/possível duplicação não resolvida;
- ações futuras que reatribuam identidade global ou ignorem identificador civil conflitante.

Não obrigatória para:
- reutilização local clara;
- criação normal em NO_MATCH;
- correções simples que não alterem identidade substantiva.

Quando obrigatória:
- `requested_by_person_id` != `approved_by_person_id`;
- ambos devem possuir autoridade válida no mesmo contexto institucional;
- aprovação deve ocorrer depois da proposta, não ser pré-preenchida.

## 7. Evidência obrigatória da decisão
Toda decisão de identidade fora do caminho trivial deve gerar evidência estruturada.

Registar no mínimo:
- institution_id;
- enrollment/intake case id quando existir;
- actor/proposer person id;
- approver person id quando aplicável;
- timestamp;
- resultado: `REUSE_PERSON`, `CREATE_PERSON`, `REVIEW_REQUIRED`, `REJECT_DECISION`;
- reason code estruturado;
- match reasons utilizados;
- tipos de evidência apresentados, sem copiar dados sensíveis desnecessários para logs;
- candidate Person IDs usados internamente;
- request/correlation id;
- policy/version quando aplicável.

Não guardar em log técnico:
- número completo de BI/passaporte sem necessidade;
- cópia do documento;
- dados de outra instituição;
- texto livre excessivo contendo informação pessoal.

## 8. Reason codes propostos
Começar pequeno e estruturado:
- `NO_MATCH_CONFIRMED`;
- `LOCAL_IDENTITY_CONFIRMED`;
- `MATCH_CONFIRMED_WITH_NEW_EVIDENCE`;
- `MULTIPLE_CANDIDATES_RESOLVED`;
- `CONFLICT_REQUIRES_REVIEW`;
- `NEW_PERSON_APPROVED_DESPITE_CONFLICT`;
- `IDENTIFIER_CONFLICT`;
- `INSUFFICIENT_EVIDENCE`.

Texto livre pode complementar casos excepcionais, mas nunca substituir reason code.

## 9. UX operacional
A interface não deve expor RBAC técnico.

### Para Secretaria
Casos normais:
- `Confirmar aluno`;
- `Criar novo registo`.

Casos ambíguos:
- `Enviar para confirmação`;
- `Adicionar informação`.

Casos sensíveis:
- mostrar claramente `Requer decisão superior`;
- indicar o que falta, sem mostrar dados protegidos;
- permitir preparar a decisão/evidência, não executar bypass.

### Para Direção/Institution Admin
Fila específica de decisões de identidade com:
- motivo;
- evidência mínima;
- candidatos autorizados/minimizados;
- decisão proposta;
- impacto esperado;
- ações `Confirmar reutilização`, `Autorizar novo registo`, `Pedir mais informação`, `Rejeitar`.

## 10. Estado do processo enquanto aguarda decisão
Enquanto um conflito sensível estiver aberto:
- não criar nova Person por workaround;
- não ativar Enrollment;
- manter o intake/caso persistido em estado de revisão;
- permitir recolha adicional de dados/documentos;
- tornar a próxima ação e responsável visíveis.

O processo não deve desaparecer nem obrigar a Secretaria a recomeçar.

## 11. Autorização backend
A UI nunca é autoridade.

Cada comando deve validar no backend:
- contexto institucional ativo;
- role autorizada;
- nível de risco/caso atual;
- se segunda aprovação é obrigatória;
- se proposer != approver quando necessário;
- se a decisão ainda é válida e não foi ultrapassada por dados novos.

Não aceitar `role`, `approved=true` ou risco fornecido pelo browser como prova.

## 12. Concorrência e consistência
Decisão de identidade deve ser protegida contra duas decisões concorrentes.

Na implementação futura:
- lock/versão otimista do caso;
- revalidar candidatos/evidência no momento da decisão;
- decisão já concluída deve retornar resultado idempotente ou conflito controlado;
- nunca criar duas Persons porque duas abas aprovaram simultaneamente.

## 13. Casos de teste obrigatórios derivados
- Secretaria confirma match local claro -> permitido;
- Secretaria tenta decidir múltiplos candidatos sozinha -> negado;
- Direção confirma candidato ambíguo -> permitido quando policy satisfaz;
- Secretaria tenta criar nova Person durante restricted match -> negado;
- Institution Admin + segunda autoridade aprovam exceção de criação -> permitido e auditado;
- proposer tenta aprovar a própria exceção quando segregação exigida -> negado;
- utilizador da Escola A tenta aprovar caso da Escola B -> negado;
- decisão concorrente/repetida -> não duplica recursos;
- evidência insuficiente -> caso continua REVIEW_REQUIRED;
- logs não expõem identificadores civis completos.

## 14. O que NÃO implementar agora
- workflow engine genérico de four-eyes para toda a plataforma;
- comité de aprovação com múltiplos níveis configuráveis;
- assinatura digital avançada;
- merge de Person;
- escalonamento interinstitucional automático;
- IA que recomenda decisão final.

A 08B precisa apenas de uma aprovação simples e explícita nos casos de alto risco.

## 15. Decisão fechada
D-05 fica FECHADA para planeamento:
- Secretaria resolve casos normais;
- casos ambíguos reais exigem confirmação de Direção/Institution Admin;
- criar nova Person apesar de conflito forte exige autoridade superior + segunda aprovação independente;
- merge global fica fora do MVP;
- toda exceção relevante gera evidência estruturada;
- backend aplica role, risco, segregação e contexto institucional.

## 16. Próxima decisão
D-06 — definir o intake mínimo quando aluno/família não possui documentação, telefone ou email suficientes no primeiro atendimento: quais dados permitem iniciar processo, quais pendências são criadas, o que pode avançar e o que fica bloqueado antes de ativação.