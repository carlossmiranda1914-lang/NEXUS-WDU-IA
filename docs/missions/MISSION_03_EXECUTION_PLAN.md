# MISSÃO 03 — Isolamento Multi-Instituição

## Objetivo

Garantir que nenhum dado institucional é lido, alterado ou transmitido fora da
instituição resolvida pelo backend.

## Ordem de execução

1. Criar a propriedade institucional persistente para recursos legados.
2. Migrar leitura e escrita de documentos, comunicações, aprovações e finanças
   para a propriedade institucional, sempre com negação por omissão.
3. Substituir gradualmente tabelas legadas por tabelas vNext com
   `institution_id` obrigatório.
4. Provar isolamento de leitura, escrita e WebSocket com duas instituições.

## Regra de segurança

Um recurso sem mapeamento institucional confirmado não é visível nem editável
por uma API institucional. O cliente nunca pode fornecer a escola como prova de
acesso.

## Critérios de fecho

- Testes negativos de duas instituições para leitura e escrita.
- Eventos em tempo real entregues apenas à instituição correta.
- Nenhuma rota crítica usa um filtro global de dados legados.
- Migrações e testes validados antes de um commit separado.
