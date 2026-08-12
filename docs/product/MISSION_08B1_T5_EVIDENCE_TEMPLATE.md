# MISSÃO 08B.1 — T5 Evidence Template

Preencher somente após execução real dos gates.

- E01 branch/HEAD:
- E02 diff contra `main`:
- E03 `test:person-resolution`:
- E03 `test:person-resolution-access`:
- E03 `test:enrollment-intake`:
- E03 `test:identity-resolution-decision`:
- E04 lint:
- E04 build:
- E05 authority/segregation:
- E06 Escola A → Escola B:
- E08 migrations isoladas 0001→0009:
- E11 auditoria sem dados sensíveis:
- E15 riscos P0–P3:

## Critérios mínimos de PASS
- Secretaria não aprova caso B/C sensível;
- proposer != approver quando D-05 exige segregação;
- exceção de criar nova Person apesar de conflito inclui Institution Admin entre os dois atores;
- identifier conflict exige Institution Admin final;
- caso de outra instituição não é revelado;
- raw BI/passaporte não entra nos campos estruturados;
- T5 não contém INSERT/UPDATE em `people`, `student_profiles` ou `enrollment_applications`;
- migration 0009 aplica do zero em schema isolado;
- regressões T2/T3/T4 continuam verdes.
