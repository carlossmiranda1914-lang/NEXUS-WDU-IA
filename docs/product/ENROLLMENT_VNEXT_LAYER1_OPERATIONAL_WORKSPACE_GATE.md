# Enrollment vNext — Layer 1 Operational Workspace Gate

Estado: IMPLEMENTAÇÃO AUTORIZADA PELO UTILIZADOR / SEM MERGE ANTES DE VALIDAÇÃO VISUAL

## Fontes obrigatórias
- NEXUS_MASTER_PLANNING_V1 / Documento Mestre de Planeamento;
- MISSION_08A_ENROLLMENT_STUDENT360_BLUEPRINT;
- Design System Oficial Nexus Edu IA;
- Relatório Estratégico Profundo;
- backend seguro 08B.1 T2–T6 já mergeado.

## Resultado humano
Ao entrar em `Alunos & Matrículas`, a Secretaria vê um único workspace operacional. Não existem duas experiências concorrentes de `Lista de Alunos` e `Portal de Matrícula`.

A primeira vista responde:
1. o que entrou;
2. o que está em andamento;
3. o que precisa de atenção;
4. o que está pronto para decisão;
5. onde cada processo está no fluxo;
6. qual é a próxima ação observável.

## Regra REAL / DEPENDÊNCIA / NÃO IMPLEMENTAR
Todo bloco visível deve ser classificado implicitamente por origem:
- REAL: existe fonte persistida/API e a UI usa-a;
- DEPENDÊNCIA: domínio aprovado, mas ainda não persistido; mostrar explicitamente `— / domínio ainda não persistido`, nunca números inventados;
- NÃO IMPLEMENTAR: não entra nesta camada.

Não existe categoria DEMO.

## Dados reais desta camada
- `/api/enrollments/context` para instituição/ofertas;
- `/api/enrollments` para processos persistidos;
- `/api/enrollments/person-resolution` para identificação inicial;
- `/api/enrollments/intake` para iniciar processo seguro/idempotente.

Nenhum `institutionId`, role, Person UUID global ou academicYearId é autoridade do browser.

## Estrutura visual aprovada
- cabeçalho operacional + ação `Nova entrada / matrícula`;
- vistas: `Visão Operacional`, `Entradas`, `Matrículas`, `Alunos`;
- indicadores reais: entradas novas, em andamento, precisam de atenção, prontas para decisão;
- pipeline: Entrada → Identificação → Documentos → Verificação → Financeiro → Decisão → Ativação;
- etapas sem domínio persistido aparecem explicitamente indisponíveis, não simuladas;
- fila `O que precisa da minha atenção` ordenada por bloqueio/pendência;
- painel contextual do processo com dados já persistidos;
- nova entrada inicia com dados mínimos e usa Person Resolution/Intake T6.

## Nesta camada NÃO entram
- checklist documental configurável;
- BI/document identifiers completos e email como identificador, até contrato backend correspondente;
- guardian 08B.2;
- condição financeira de matrícula;
- capacity/vagas;
- decisão/ativação completa;
- Student 360 completo;
- gamificação no workspace;
- dados académicos/financeiros hardcoded do StudentsList legado;
- nova paleta de marca.

## Gate técnico
- testes do modelo operacional;
- teste de contrato da UI;
- regressão T6 completa;
- lint;
- build;
- nenhuma reintrodução de endpoints legados.

## Gate visual obrigatório antes de merge
Validar manualmente com o utilizador:
- desktop;
- tablet;
- mobile;
- leitura clara da hierarquia;
- ausência da duplicação Lista/Portal;
- estado vazio sem dados fictícios;
- erro real compreensível;
- abertura de processo;
- início de nova entrada;
- nenhuma alteração de paleta fora dos padrões já existentes.

Sem aprovação visual explícita, a PR permanece draft e não é mergeada.
