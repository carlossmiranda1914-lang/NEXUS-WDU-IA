# MISSÃO 08B.1 — T7 Evidence Template

Preencher apenas com evidência executada.

- E01 branch/HEAD:
- E02 diff contra `main`:
- E03 `test:enrollment-ui-model`:
- E03 `test:enrollment-ui-contract`:
- E03 regressão `test:t6`:
- E04 lint/build:
- E05 UI não envia autoridade institucional:
- E06 restricted match sem origem/dados protegidos:
- E09 desktop:
- E09 tablet:
- E09 mobile:
- E10 fluxo manual Secretaria:
- E12 endpoints usados:
- E15 riscos P0–P3:

## PASS mínimo
- `npm run test:t7` exit code 0;
- nenhum endpoint legado de escrita aparece no `EnrollmentWorkspace`;
- nenhum campo de autoridade proibido é enviado pela UI;
- `NO_MATCH`/`LOCAL_MATCH` permitem intake seguro;
- ambiguidade/restricted permanecem fail-closed;
- loading/vazio/erro/revisão/sucesso observáveis;
- fluxo utilizável em desktop/tablet/mobile;
- build sem erro bloqueante.
