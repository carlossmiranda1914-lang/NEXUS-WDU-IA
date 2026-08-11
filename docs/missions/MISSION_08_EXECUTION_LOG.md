# Missão 08 — Registo de execução

## Entrega inicial

Foi iniciada a implementação da Matrícula Integrada e Student 360 sem reutilizar a tabela ou os identificadores demonstrativos do sistema legado.

### Incluído

- Migração vNext para anos letivos, ofertas, matrículas, checklist documental e linha temporal.
- Isolamento obrigatório por `institution_id` em cada entidade nova.
- API autenticada para listar, criar e transitar matrículas.
- Área de Secretaria no frontend ligada à API institucional, com estados de carregamento, vazio, erro e sucesso.
- O portal demonstrativo deixou de ser carregado no separador de matrículas; permanece no repositório apenas como legado não utilizado.
- Estados explícitos: `draft`, `under_review`, `awaiting_documents`, `validated`, `blocked`, `active` e `cancelled`.
- Regras de papel: secretaria prepara e analisa; direção ou administrador institucional ativam; professor, aluno e encarregado não gerem matrículas.
- Auditoria de linha temporal por matrícula.

### Deliberadamente fora desta entrega

- Interface visível substituta do portal demonstrativo.
- Upload ou armazenamento definitivo de ficheiros.
- Cobrança, pagamento e emissão de recibos.
- Migração automática de registos do sistema legado.

## Evidência de validação

- Compilação TypeScript.
- Testes unitários das regras de autorização e transição.
- Migração e verificação na base de testes antes de qualquer aplicação na base oficial.
- Migração `0006_vnext_enrollment_student360.sql` aplicada na base oficial em 2026-08-11, com verificação posterior em modo de leitura: 13 tabelas vNext confirmadas.
