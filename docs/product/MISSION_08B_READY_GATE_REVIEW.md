# MISSÃO 08B — Gate Review completo de READY

Estado do gate: PASS
Resultado: 08B.1 autorizada a entrar em ANÁLISE Codex
Implementação funcional: AINDA NÃO AUTORIZADA
Issue de execução: #26

## 1. Escopo revisto
A missão 08B foi decomposta para evitar L/XL escondido:
- 08B.1 — Student Person Resolution + Enrollment Intake — READY para ANÁLISE;
- 08B.2 — Guardian Resolution + GuardianRelationship — permanece fora desta execução e será preparada separadamente.

Esta decomposição evita misturar identidade de aluno e encarregado na primeira intervenção.

## 2. Decisões de produto/domínio
- D-01 PASS — birth_date é atributo canónico global de Person, nullable e não identificador único.
- D-02 PASS — identificadores/documentos no contexto angolano separados entre civil, evidência documental, identificador institucional e autenticação; intake pode ocorrer sem documento.
- D-03 PASS — Person global pode ser reutilizada por nova instituição sem transferir dados/roles/recursos; novo vínculo exige caso de uso autorizado e confirmação humana.
- D-04 PASS — restricted possible match impede duplicação sem revelar existência/histórico de outra instituição e inclui anti-enumeração.
- D-05 PASS — matriz de autoridade para conflitos: Secretaria no caminho normal; Direção/Institution Admin em ambiguidades; conflito forte pode exigir segunda aprovação independente; merge fora do MVP.
- D-06 PASS — intake mínimo pode começar sem documento/telefone/email; ausência permanece NULL/pendente e nunca fictícia; baixa informação aumenta revisão.

Não restam decisões D-01..D-06 capazes de alterar silenciosamente o contrato de 08B.1.

## 3. Definition of Ready — identidade e objetivo
- [x] Issue única: #26.
- [x] Problema objetivo registado.
- [x] Resultado observável registado.
- [x] Valor funcional/segurança explícito: evitar Person duplicada, histórico fragmentado e linking indevido.
- [x] Prioridade definida: P0/P1 da primeira vertical de matrícula.
- [x] Decisões de produto persistidas em D-01..D-06.

Resultado: PASS.

## 4. Definition of Ready — âmbito
- [x] Dentro do âmbito explícito na issue #26.
- [x] Fora do âmbito explícito.
- [x] Guardian resolution removida para 08B.2.
- [x] Missão classificada M.
- [x] Obrigação de decompor em tarefas S/XS antes de edição.
- [x] Redesign geral, financeiro, documentos, vagas, Student 360 e IA fora do escopo.

Resultado: PASS.

## 5. Dependências
Dependências satisfeitas/identificadas:
- Foundation multi-instituição existente;
- Identity -> Person -> Membership -> Institution -> Resources preservado;
- `people`, `student_profiles`, `enrollment_applications` existentes;
- contexto institucional resolvido no backend;
- PostgreSQL de teste separado já utilizado na Foundation;
- decisões D-01..D-06 aprovadas.

Dependências a confirmar em ANÁLISE, não bloqueadoras de READY:
- mecanismo mínimo de idempotency key adequado ao código atual;
- necessidade efetiva de `person_identifiers` já na primeira tarefa;
- migration aditiva exata para `birth_date` e eventuais constraints/indexes.

Estas perguntas podem alterar a implementação, mas não o contrato do produto; por isso pertencem à fase ANÁLISE/PLANEADA e não bloqueiam READY.

Resultado: PASS.

## 6. Fontes de verdade
Obrigatórias para execução:
- `NEXUS_MASTER_PLANNING_V1.md`;
- `NEXUS_OPERATIONAL_MAP_V1.md`;
- `NEXUS_EXPERIENCE_GUIDANCE_MODEL_V1.md`;
- `MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT.md`;
- `MISSION_08B_PERSON_RESOLUTION_CONTRACT.md`;
- D-01..D-06;
- Arquitetura Oficial v4;
- Definition Ready/Done/Evidence;
- ADRs aceites aplicáveis.

Conflito conhecido com protótipo atual:
- `/api/enrollments/drafts` faz INSERT direto em `people` a partir do nome;
- esse comportamento é legado/protótipo e não dita o desenho final;
- não deve ser expandido antes da 08B.1.

Resultado: PASS.

## 7. Critérios de aceitação consolidados
AC-01 nova pessoa sem match -> Person + StudentProfile + Enrollment atomicamente.
AC-02 Person local existente -> reutilizar sem duplicar.
AC-03 ambiguidade -> sem criação automática.
AC-04 retry idempotente -> mesmo resultado lógico/sem duplicação.
AC-05 Escola A não recebe dados indevidos de Person ligada à Escola B.
AC-06 Person ID global manipulado -> sem linking indevido.
AC-07 falha parcial -> rollback total.
AC-08 criar/reutilizar/rever -> auditoria.
AC-09 StudentProfile existente -> reutilizar.
AC-10 contexto institucional manipulado no cliente -> sem acesso.
AC-11 nenhum fallback/dado fictício.
AC-12 persistência após restart/nova sessão.
AC-13 intake sem documento/telefone/email funciona conforme D-06.
AC-14 birth_date desconhecida permanece NULL.
AC-15 restricted match não revela origem/dados protegidos.
AC-16 conflito forte respeita autoridade/segunda aprovação D-05.
AC-17 UI futura trata loading/vazio/erro/conflito/sucesso.
AC-18 UI futura validada desktop/tablet/mobile.

Todos são binários/verificáveis; nenhum critério depende de linguagem vaga.

Resultado: PASS.

## 8. Plano de evidência
- E01 Estado Git — branch/commit/status.
- E02 Diff — stat, diff completo e diff check.
- E03 Testes — unitários e integração.
- E04 Typecheck/build.
- E05 Segurança/autorização — 401/403 e ações permitidas/proibidas.
- E06 Multi-tenant — Escola A -> Escola B rejeitada.
- E07 Persistência — restart/nova sessão.
- E08 Base de dados — migration/constraints/indexes/transação.
- E09 UI visual — quando UI entrar em implementação.
- E10 Fluxo manual — Secretaria.
- E11 Auditoria — eventos e ausência de dados sensíveis.
- E12 Contrato/API — requests/responses sanitizados.
- E15 Riscos P0-P3.

Perfis mínimos de teste:
- secretariat A;
- director/institution_admin A para conflito;
- secretariat B;
- Person local A;
- Person existente apenas B/global restrita;
- nova Person sem documento;
- cenário ambíguo/múltiplos candidatos.

Resultado: PASS.

## 9. Segurança e dados
- [x] origem do tenant: contexto institucional resolvido no servidor;
- [x] UUID global não autoriza acesso;
- [x] pesquisa global navegável proibida;
- [x] anti-enumeração definida;
- [x] minimização de dados definida;
- [x] birth_date/documentos tratados como dados pessoais;
- [x] logs sem identificadores civis completos/dados desnecessários;
- [x] linking cross-institution confirmado/auditado;
- [x] conflito forte sujeito a autoridade definida;
- [x] nenhuma criação de Membership/role implícita;
- [x] rollback e idempotência obrigatórios.

Resultado: PASS.

## 10. Prompt Codex ANALISAR
Prompt oficial registado na issue #26:
- modo somente leitura;
- proíbe alteração de ficheiros/migration/commit/push/deploy;
- exige mapa de ficheiros/fluxos;
- exige riscos P0–P3;
- exige estratégia mínima de idempotência/transação;
- exige análise de necessidade real de `person_identifiers`;
- exige plano de migration aditiva;
- exige decomposição técnica XS/S;
- manda parar se surgir área fora do âmbito.

Resultado: PASS.

## 11. Riscos aceites para fase de ANÁLISE
P0 que implementação deve provar = zero no DONE, mas não bloqueiam análise porque estão explicitamente especificados:
- exposição cross-institution;
- enumeração de pessoas;
- linking por UUID global sem prova institucional.

P1:
- Person duplicada por corrida/retry;
- estado parcial Person/Profile/Enrollment;
- matching excessivamente permissivo;
- auditoria insuficiente.

P2:
- normalização gera demasiados casos de revisão;
- UX de conflito pouco clara.

P3:
- otimizações/ergonomia secundária.

Todos têm critério/teste correspondente; nenhum risco crítico está escondido.

## 12. Micro-gates de implementação obrigatórios
Mesmo após READY, nenhum ficheiro pode ser editado até a ANÁLISE entregar e aprovar a decomposição.

Sequência esperada, sujeita à análise:
1. S — modelo/migration mínima (`birth_date` e apenas estruturas indispensáveis);
2. S — resolver determinístico read-only;
3. S — intake transacional + idempotência + StudentProfile;
4. S — autoridade/conflitos/restricted match + auditoria;
5. S — integração/API e testes PostgreSQL multi-tenant;
6. S — UI mínima Identificar -> Confirmar -> Iniciar;
7. XS/S — validação completa e documentação.

Cada passo recebe objetivo, ficheiros permitidos/proibidos, ACs, testes imediatos, risco e rollback antes de edição.

## 13. Decisão do Gate Review
### PASS — READY
A 08B.1 satisfaz a Definition of Ready e pode entrar em **ANÁLISE Codex**.

Isto NÃO significa autorização para implementar imediatamente.

Próximo gate oficial:
`READY -> ANÁLISE`.

A implementação só começa depois de:
1. análise read-only concluída;
2. riscos e mapa de dependências aprovados;
3. plano mínimo de tarefas S/XS aprovado;
4. primeira tarefa técnica passar o micro-gate.

08B.2 permanece fora desta autorização.