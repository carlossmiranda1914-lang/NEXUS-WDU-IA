# MISSÃO 08B.1 — T5 Micro-gate

Estado: IMPLEMENTADA / AGUARDA EVIDÊNCIA EXECUTÁVEL

## Objetivo
Aplicar D-05 no backend para conflitos de identidade sem criar um workflow genérico e sem executar ainda efeitos de Person/StudentProfile/Enrollment.

## Fronteira
T5 persiste proposta, autoridade, decisão e evidência estruturada. A decisão `approved` é uma autorização de domínio para uma etapa posterior; por si só não cria nem associa recursos.

## Regras fechadas
- autoridade vem exclusivamente de `memberships` ativa na mesma instituição;
- Secretaria pode propor nível B, mas não confirmar casos ambíguos;
- `NEW_PERSON_APPROVED_DESPITE_CONFLICT` exige proponente `director`/`institution_admin`, segundo ator independente e pelo menos um `institution_admin`;
- `IDENTIFIER_CONFLICT` resolvido só pode propor `REUSE_PERSON` e exige `institution_admin` como aprovador final;
- conflitos não resolvidos usam `CONFLICT_REQUIRES_REVIEW` ou `INSUFFICIENT_EVIDENCE` e não suportam bypass;
- `REUSE_PERSON` exige candidato interno explícito pertencente ao conjunto de candidatos do caso;
- decisão de outra instituição retorna `not found`;
- `SELECT ... FOR UPDATE` e unicidade `(institution_id, case_key)` evitam decisões concorrentes divergentes;
- replay da mesma proposta usa fingerprint; mesmo case key com evidência diferente é conflito;
- nenhum texto livre sensível é armazenado; match reasons e evidence types são allowlists.

## Fora do escopo
- rota HTTP/UI;
- criação/linking de Person;
- execução da autorização aprovada;
- guardian;
- merge global;
- four-eyes genérico;
- OCR/documentos;
- IA/fuzzy matching.

## Gates obrigatórios
1. `npm run test:person-resolution`
2. `npm run test:person-resolution-access`
3. `npm run test:enrollment-intake`
4. `npm run test:identity-resolution-decision`
5. `npm run test:migrations:isolated`
6. `npm run lint`
7. `npm run build`
8. diff somente nos ficheiros T5 previstos.

## Rollback
Reverter migration 0009 e ficheiros T5 antes de qualquer integração de rota. T5 não altera dados existentes nem executa linking de identidade.
