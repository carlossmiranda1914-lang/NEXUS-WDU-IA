# Missão 06 — Auditoria, logs e observabilidade

## Objetivo

Tornar cada ação relevante rastreável por escola, ator, resultado e identificadores técnicos, sem colocar segredos, tokens, corpos de pedidos ou parâmetros de consulta nos logs.

## Implementação

- Cada pedido recebe `X-Request-ID` e `X-Correlation-ID`.
- Escritas e respostas com erro são registadas automaticamente depois da resposta.
- O registo inclui apenas a rota parametrizada, método, estado HTTP e duração.
- Cada novo registo institucional contém `institution_id`, ator, resultado, request ID e correlation ID.
- O endpoint de logs exige perfil administrativo/direção e filtra sempre pela instituição ativa.
- A migração `0005_vnext_audit_observability.sql` é aditiva e indexa a consulta institucional.

## Validação

- Migração aplicada na base de testes.
- Verificação de tipos concluída.
- Testes automatizados confirmam que só escritas e falhas são auditadas e que detalhes sensíveis não são registados.
- A migração foi aplicada com confirmação explícita na base oficial.
- A verificação em leitura confirmou as 8 tabelas/estruturas vNext necessárias.
