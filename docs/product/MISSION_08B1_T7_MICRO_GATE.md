# MISSÃO 08B.1 — T7 Micro-gate

Estado: IMPLEMENTADA / AGUARDA GATES E VALIDAÇÃO VISUAL

## Objetivo
Entregar a UI mínima do fluxo 08B.1 para a Secretaria: `Identificar aluno → Confirmar/rever identidade → Iniciar matrícula`, consumindo apenas a API segura T6.

## Contrato UX
- linguagem operacional, sem termos técnicos de identidade;
- nome é obrigatório; birth date, telefone, número do aluno e referência antiga são opcionais;
- `NO_MATCH` e `LOCAL_MATCH` permitem avançar para intake, sempre com revalidação no backend;
- `MULTIPLE_MATCHES`, `REVIEW_REQUIRED`, `REUSABLE_MATCH` e `RESTRICTED_POSSIBLE_MATCH` não iniciam matrícula automaticamente;
- possíveis matches restritos não mostram Person ID, origem institucional ou dados protegidos;
- candidatos locais só aparecem quando o backend explicitamente os devolve como permitidos;
- casos sensíveis são encaminhados para decisão T5; a UI não simula aprovação.

## Autoridade
A UI nunca envia como autoridade:
- `institutionId`;
- `role`;
- `studentPersonId`/`personId`;
- `academicYearId`;
- `approved`.

O `Idempotency-Key` é apenas uma chave de retry da mesma tentativa lógica e não concede autorização.

## Bypasses proibidos
- nenhum uso de `POST /api/enrollments/drafts`;
- nenhum uso do POST legado `/api/enrollments`.

## Estados obrigatórios
- loading institucional;
- configuração/oferta vazia;
- erro de API;
- identificação em progresso;
- match local / nova pessoa segura;
- revisão/conflito/restricted;
- confirmação encaminhada;
- matrícula iniciada com sucesso.

## Responsividade
O layout deve funcionar em mobile, tablet e desktop sem esconder ações críticas. A grelha principal só divide em duas colunas em `xl`; formulários internos passam a duas colunas em `sm`/`md` quando há espaço.

## Gates
1. `npm run test:enrollment-ui-model`;
2. `npm run test:enrollment-ui-contract`;
3. regressão completa `npm run test:t6`;
4. agregado `npm run test:t7`;
5. inspeção do diff contra `main`;
6. validação manual/visual desktop, tablet e mobile antes de merge.

## Fora do escopo
- guardian 08B.2;
- Student 360;
- financeiro;
- OCR/documentos;
- fuzzy/IA;
- pesquisa global de pessoas;
- novos endpoints ou migrations;
- redesign geral do módulo de matrículas.
