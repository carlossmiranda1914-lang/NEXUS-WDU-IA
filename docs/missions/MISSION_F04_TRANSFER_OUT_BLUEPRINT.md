# F04 — Transferência de saída institucional

**Estado:** PREPARAÇÃO  
**Incremento:** F04.1 — saída auditada; não inclui entrada nem intercâmbio automático entre instituições.

## 1. Resultado operacional

Uma Secretaria autorizada pode abrir um pedido de saída para uma matrícula ativa da sua própria instituição. O pedido regista destino informado, motivo, data pretendida e observações. A Secretaria prepara o caso; Direção ou Administração institucional autoriza ou recusa o fecho. A conclusão preserva a matrícula, o histórico e a evidência; nunca elimina dados nem cria acesso para a instituição de destino.

## 2. Decisões de produto deste incremento

- O primeiro sentido é **saída**. Entrada, transferência entre instituições Nexus e importação de histórico são missões posteriores.
- Pendências académicas, documentais ou financeiras podem ser registadas no pedido, mas impedem a autorização final enquanto existirem sem resolução explícita.
- Secretaria cria, atualiza e submete o pedido; `director` e `institution_admin` autorizam ou recusam.
- A instituição de destino é texto informado no contexto da origem; não é um identificador autorizado nem concede acesso a dados.
- A saída não usa `cancelled` como atalho. O significado de estado de matrícula existente não é alterado nesta missão.

## 3. Segurança e invariantes

1. O `institution_id` vem exclusivamente do contexto resolvido no servidor.
2. Nenhuma API aceita uma instituição, papel ou destino enviado pelo cliente como autorização.
3. Um pedido só pode referir uma matrícula pertencente à instituição atual.
4. O pedido não revela, lê, escreve nem transfere dados de outra instituição.
5. O histórico de matrícula e os eventos de auditoria nunca são apagados.
6. Toda criação, submissão, decisão, recusa e bloqueio relevante é auditável com ator, instituição, instante e motivo.
7. Falha ao obter contexto, matrícula ou autorização significa recusar a operação.

## 4. Estado proposto

`draft -> submitted -> awaiting_resolution -> approved | rejected | withdrawn`

- `draft`: Secretaria ainda está a completar dados.
- `submitted`: aguarda verificação de pendências e decisão.
- `awaiting_resolution`: existem pendências que impedem o fecho.
- `approved`: saída foi autorizada; o registo de origem permanece histórico.
- `rejected`: decisão negativa, com motivo obrigatório.
- `withdrawn`: pedido retirado pela Secretaria antes de autorização.

## 5. Dentro e fora do âmbito

**Dentro:** pedido de saída, estados, autorização institucional, persistência, auditoria, leitura operacional e UI de Secretaria.

**Fora:** entrada, partilha/intercâmbio de dados entre instituições, transferência automática de histórico, alteração de estados de matrícula, pagamentos/reembolsos, emissão de certificados, upload físico de ficheiros, automação de comunicação e Student 360.

## 6. Critérios de aceitação verificáveis

1. Secretaria da Escola A cria um pedido apenas para uma matrícula ativa da Escola A.
2. Secretaria não pode autorizar nem recusar o pedido.
3. Direção/Admin da Escola A autoriza ou recusa apenas pedidos da Escola A e uma recusa exige motivo.
4. Pendência declarada ou verificada encaminha o pedido para `awaiting_resolution`; não pode chegar a `approved` sem resolução registada.
5. Escola B não consegue ler nem alterar o pedido, mesmo conhecendo o identificador.
6. Aprovação preserva matrícula, eventos e documentos existentes; não realiza hard delete, `cancelled` nem criação de vínculo na instituição de destino.
7. Cada transição produz evento de auditoria institucional com ator e motivo quando aplicável.
8. UI apresenta loading, vazio, erro de domínio e sucesso, em desktop/tablet/mobile, sem expor dados de outra instituição.

## 7. Plano de prova

- policy unitária para estados e matriz de papéis;
- contrato HTTP para criação, leitura e transições;
- PostgreSQL para transação, idempotência, auditoria e isolamento Escola A/B;
- regressão S01–S03;
- UAT de Secretaria e Direção nas três larguras, light/dark;
- CI remoto no PR da F04.

## 8. Gate para READY

Antes de código funcional, criar uma issue única para F04.1, mapear as tabelas/API de matrícula que serão tocadas, confirmar a fonte de pendências e decidir a consequência explícita de `approved` para a matrícula de origem. Se essa consequência exigir mudar o lifecycle de matrícula, a F04.1 permanece PREPARAÇÃO até haver decisão escrita.
