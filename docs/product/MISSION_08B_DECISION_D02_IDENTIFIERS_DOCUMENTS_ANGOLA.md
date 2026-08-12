# MISSÃO 08B — Decisão D-02: Identificadores e documentos no contexto angolano

Estado: DECISÃO APROVADA PARA PLANEAMENTO
Âmbito: produto + domínio + segurança + dados + operação escolar
Implementação: NÃO AUTORIZADA por este documento

## 1. Objetivo
Definir quais dados devem funcionar como identificadores de `Person`, quais são apenas documentos/evidências, quais pertencem à instituição e quais pertencem à autenticação.

O objetivo é permitir matching e matrícula realistas em Angola sem assumir que todo aluno possui BI, telefone ou email no primeiro contacto.

## 2. Evidência operacional e pública considerada
Fontes oficiais angolanas confirmam que a identificação civil pode envolver:
- Bilhete de Identidade;
- NUC (Número Único do Cidadão), atribuído no acto de registo e associado ao futuro BI;
- Assento de Nascimento;
- Boletim de Nascimento;
- Cédula Pessoal / Certidão de Nascimento;
- Passaporte;
- Cartão de Estrangeiro Residente.

O SIAC informa que, para primeira via do BI, o Assento de Nascimento ou Boletim de Nascimento com NUC são relevantes, e explica que o NUC é o número do bilhete a ser adquirido no acto do registo. O Governo de Angola também reforçou em 2026 que o BI não substitui juridicamente o Assento de Nascimento, que continua a ser o primeiro registo civil da pessoa.

Serviços públicos angolanos também contemplam cenários `Sem Documento`. O registo individual do Ministério da Saúde permite explicitamente seleccionar `Sem Documento` e recorrer a dados dos progenitores. Isto é relevante para o desenho do Nexus: ausência momentânea de documento não pode equivaler a ausência de pessoa nem impedir todo o intake.

O Ministério da Educação, em processos relacionados com estudantes, aceita BI ou cédula do estudante em contextos oficiais, reforçando a necessidade de suportar mais de um tipo documental.

## 3. Separação canónica obrigatória
### 3.1 Identificador da pessoa
Um valor estável que pode ajudar a reconhecer a mesma pessoa em mais de um contexto.

Exemplos aprovados para suporte futuro:
- `NUC`;
- número de Bilhete de Identidade;
- número de Passaporte;
- número de Cartão de Estrangeiro Residente.

### 3.2 Documento/evidência
Artefacto que comprova ou suporta dados, mas não deve ser confundido com a entidade Person.

Exemplos:
- Assento de Nascimento;
- Certidão de Nascimento;
- Boletim de Nascimento;
- Cédula Pessoal;
- cópia/imagem do BI;
- cópia/imagem do Passaporte;
- comprovativos escolares anteriores.

Um documento pode conter um identificador. O documento e o identificador continuam conceitos separados.

### 3.3 Identificador institucional do aluno
Pertence ao vínculo aluno-instituição, não à Person global.

Exemplos:
- `student_number`;
- número interno de processo;
- `legacy_student_id` durante migração.

Estes identificadores não devem ser utilizados como identificador global fora do respectivo contexto sem regra explícita.

### 3.4 Identificador de autenticação
Pertence a `Identity`.

Exemplos:
- Firebase UID;
- provider + providerSubject.

BI, NUC, Assento, Passaporte e número de aluno NÃO pertencem à tabela `identities`.

## 4. Tipos aprovados para o MVP de modelação
A futura capacidade `person_identifiers`, se confirmada no gate técnico, deve começar pequena.

Tipos candidatos aprovados:
- `angola_nuc`;
- `angola_bi`;
- `passport`;
- `resident_card`.

Não criar inicialmente tipos genéricos para todo documento existente no mercado.

Assento/Certidão/Boletim/Cédula devem ser tratados primeiro como evidência/documento, excepto quando possuam número oficial que precise ser indexado para pesquisa; nesse caso a estratégia exacta será definida com o domínio documental para evitar duplicação de dados.

## 5. Prioridade dos sinais para matching
### Forte e potencialmente determinístico após normalização e validação
- mesmo `angola_nuc`;
- mesmo número de BI válido;
- mesmo Passaporte + país emissor;
- mesmo Cartão de Residente válido;
- mesmo `student_number` dentro da mesma instituição;
- mesmo `legacy_student_id` validado no período de transição.

Mesmo sinais fortes não substituem autorização e não devem permitir exposição cross-institution.

### Composto
- nome normalizado + data de nascimento;
- nome + data de nascimento + referência de progenitor/encarregado;
- nome + telefone/contacto + data de nascimento.

### Fraco
- nome semelhante;
- escola anterior;
- turma anterior;
- endereço;
- contacto isolado.

Sinal fraco nunca produz merge automático.

## 6. Ausência de documentos
O Nexus deve suportar explicitamente `documentação ainda não apresentada`.

### Permitido
Uma criança pode iniciar intake sem BI, NUC conhecido, telefone próprio ou email.

### Condições
- nome é captado;
- data de nascimento é captada quando conhecida;
- dados de progenitor/encarregado são usados quando disponíveis;
- o resolver procura correspondências antes de criar Person;
- a ausência documental fica como pendência do processo quando a política da instituição/oferta assim exigir;
- a falta de documento não é convertida em dado fictício;
- não usar placeholders como `000000000` ou `SEM-BI` em campos únicos.

## 7. Nacionalidade e estrangeiros
O modelo deve suportar aluno estrangeiro sem forçá-lo a possuir identificador angolano.

Para matching futuro:
- Passaporte deve incluir país emissor;
- Cartão de Estrangeiro Residente pode funcionar como identificador quando existente;
- nacionalidade pode ser dado de Person/perfil demográfico futuro, mas não precisa ser acrescentada à 08B.1 se não for necessária para resolver os primeiros casos.

Não criar tabela específica por nacionalidade.

## 8. NUC e BI
### Decisão
NUC e número de BI são semanticamente relacionados no ecossistema angolano, mas o Nexus não deve assumir cegamente que são sempre intercambiáveis em todo registo legado.

A normalização deve permitir verificar formatos e, quando evidência oficial confirmar que dois valores representam a mesma identificação civil, consolidá-los de forma auditável.

Não criar duas Persons porque um sistema antigo guardou NUC e outro guardou BI para a mesma pessoa.

## 9. Assento de Nascimento
### Decisão
O Assento de Nascimento é tratado como evidência civil de alta importância, não como substituto automático do BI.

O Governo de Angola afirma que o BI não substitui juridicamente o Assento de Nascimento e o considera o primeiro documento de integração e registo da pessoa.

Implicação para o Nexus:
- pode ser requisito documental de matrícula;
- pode suportar confirmação de nome, filiação e data de nascimento;
- a ausência de BI não invalida necessariamente a existência civil quando existe Assento/Boletim/Cédula;
- o ficheiro/documento deve pertencer ao domínio documental, não à tabela `people`.

## 10. BI
### Decisão
Número de BI é identificador forte quando presente e correctamente normalizado.

Regras:
- armazenar valor normalizado;
- manter tipo explícito;
- nunca usar BI como password/login implícito;
- nunca expor BI completo em logs ou candidatos cross-institution;
- uniqueness global só deve ser activada se a estratégia de dados legados e qualidade estiver validada; não impor constraint que bloqueie migração antes do dry-run correspondente.

## 11. Passaporte e cartão de residente
### Decisão
São identificadores suportados para estrangeiros e casos aplicáveis.

Passaporte precisa de contexto do país emissor para evitar colisões de numeração entre países.

Validade/expiração pertence à evidência/documento e pode influenciar requisitos de matrícula, mas um documento expirado não deve apagar ou mudar a identidade histórica da Person.

## 12. Student number e legacy student id
`student_number` pertence a `StudentProfile` e é local à instituição.

`legacy_student_id` permanece mecanismo transitório de mapeamento e não deve ser promovido a identificador civil global.

Ambos podem ser sinais fortes dentro do contexto institucional correcto.

## 13. Modelo conceptual recomendado
Se a análise técnica confirmar necessidade, a menor estrutura futura seria aproximadamente:

`person_identifiers`
- `id` UUID;
- `person_id` FK;
- `type`;
- `value_normalized`;
- `issuing_country` nullable;
- `status` (`declared`, `verified`, `invalidated`) — avaliar se necessário no MVP;
- timestamps.

Não incluir `institution_id` para identificadores civis globais.

Acesso a estes dados continua condicionado ao caso de uso e contexto institucional; serem globais no modelo não significa serem globalmente visíveis.

## 14. Documentos não devem ser duplicados no identificador
Evitar armazenar cópia do documento, URL de ficheiro ou OCR bruto em `person_identifiers`.

O domínio documental deve tratar:
- ficheiro;
- tipo documental;
- proveniência;
- validade;
- verificação;
- storage;
- ligação autorizada à Person/processo.

O resolver recebe apenas os sinais mínimos necessários.

## 15. Normalização
Antes de matching:
- trim;
- uppercase quando aplicável;
- remover espaços/separadores apenas quando a semântica do tipo permitir;
- preservar valor original fora do índice normalizado se necessário para apresentação/auditoria;
- Passaporte deve considerar país emissor;
- formatos devem ser validados por tipo, sem rejeitar definitivamente dados legados apenas por inconsistência de formatação.

## 16. Segurança e privacidade
Identificadores civis são dados pessoais sensíveis do ponto de vista operacional e devem receber protecção reforçada.

- não enviar lista global de pessoas ao browser;
- não devolver identificador completo em `RESTRICTED_POSSIBLE_MATCH`;
- mascarar quando apresentação parcial for necessária;
- logs não contêm números completos por defeito;
- matching cross-institution ocorre no servidor;
- acesso a documento/evidência requer autorização própria;
- nenhum identificador concede Membership, role ou permissão.

## 17. UX da Secretaria
A Secretaria não deve escolher entre conceitos técnicos como `NUC identifier` e `person_identifier type`.

Exemplo de captura humana:
`Documento apresentado`:
- Nenhum por agora;
- Bilhete de Identidade;
- Assento/Certidão/Boletim/Cédula de Nascimento;
- Passaporte;
- Cartão de Residente;
- Outro documento permitido pela configuração futura.

Se `Nenhum por agora`, o fluxo continua com os dados disponíveis e explica claramente o que ficará pendente.

## 18. O que é obrigatório na 08B.1
Para evitar overengineering, a primeira implementação deve ser capaz de:
- trabalhar sem documento;
- usar `student_number`/legacy mapping quando disponíveis;
- usar nome + birth_date como sinal composto;
- estar preparada para identificadores civis sem necessariamente implementar todos os tipos no primeiro commit;
- nunca criar Person directamente a partir do nome sem resolução.

A criação efectiva de `person_identifiers` pode ser feita em subpasso próprio somente se necessária para cumprir os cenários de teste aprovados.

## 19. O que fica para o domínio documental
- upload de BI/Assento/Passaporte;
- OCR;
- verificação visual;
- validade/expiração;
- checklist obrigatório por oferta;
- pedidos de reenvio;
- arquivo e retenção.

A 08B não deve absorver o futuro módulo documental.

## 20. Critérios derivados D-02
- AC-D02-01: intake funciona quando aluno não apresenta documento no primeiro contacto;
- AC-D02-02: ausência documental nunca gera placeholder fictício;
- AC-D02-03: student number só resolve dentro da instituição correcta;
- AC-D02-04: legacy student id não se torna identificador global de Person;
- AC-D02-05: BI/NUC/Passaporte/Cartão de Residente não pertencem a `identities` Firebase;
- AC-D02-06: possível match cross-institution não expõe número civil completo;
- AC-D02-07: Passaporte considera país emissor;
- AC-D02-08: documento expirado não cria automaticamente nova Person;
- AC-D02-09: Assento/Certidão pode servir como evidência sem obrigar BI;
- AC-D02-10: identificador civil nunca concede acesso institucional;
- AC-D02-11: normalização é determinística e testável;
- AC-D02-12: nenhum merge automático é feito apenas por similaridade de dados.

## 21. Decisão final D-02
D-02 fica FECHADA para planeamento com a seguinte política:

1. Nexus suporta múltiplas formas reais de identificação, não apenas BI.
2. BI/NUC, Passaporte e Cartão de Residente são identificadores civis candidatos.
3. Assento/Certidão/Boletim/Cédula são primeiro tratados como evidência documental.
4. Student number e legacy id são institucionais/transitórios.
5. Firebase UID é autenticação e permanece separado.
6. Ausência de documento é estado válido do intake e pode gerar pendência, nunca bloqueio automático universal.
7. Nenhuma ausência é preenchida com dados fictícios.
8. Nenhum identificador global é globalmente visível por consequência do modelo.

## 22. Fontes públicas oficiais utilizadas
- SIAC — Identificação Civil: https://siac.gov.ao/servico/identificacao-civil/
- SIAC — Conservatória do Registo Civil: https://siac.gov.ao/servico/registo-civil/
- SIAC — SME Migração e Estrangeiros: https://siac.gov.ao/servico/sme-migracao-e-estrangeiros/
- Governo de Angola — Modernização dos serviços / Bilhete de Identidade, 02-07-2026: https://www.governo.gov.ao/noticias/2955/governo/modernizacao-dos-servicos/bilhete-de-identidade-podera-ser-tratado-e-entregue-ao-domicilio
- Ministério da Saúde — Registo individual HPV, exemplo oficial de fluxo `Sem Documento`: https://www.vacina.gov.ao/hpv/individualvph.aspx
- Ministério da Educação — requisitos de identificação de estudante para passe social: https://med.gov.ao/web/noticias/mais-de-4-mil-estudantes-come%C3%A7am-a-receber-os-passes-sociais-giramais

## 23. Próxima decisão
D-03 — definir quando uma Person global já existente pode ser reutilizada por uma nova instituição e qual confirmação humana/evidência é necessária para criar o novo vínculo institucional sem duplicar pessoa nem expor histórico indevido.