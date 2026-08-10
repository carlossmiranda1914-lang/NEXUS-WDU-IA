# ADR-001 — Contexto institucional obrigatório

**Estado:** aceite
**Prioridade:** P0 / ARC-001 e ARC-005
**Data:** 2026-08-10

## Decisão

O Firebase prova apenas a identidade. O backend resolve essa identidade em
`Identity → Person → Membership → Institution` no PostgreSQL antes de autorizar
qualquer operação institucional.

O navegador não escolhe o contexto por e-mail, domínio, `tenantId`, `schoolId`
ou parâmetros equivalentes. Uma associação ativa define o contexto. Quando uma
pessoa tem associações ativas em mais de uma instituição, a API exige uma
seleção explícita e valida-a contra as memberships existentes.

## Aplicação inicial

- `requireAuth` falha sem membership ativa e não cria contas, pessoas ou
  privilégios automaticamente.
- As rotas de tarefas recebem o identificador institucional apenas do backend.
- O WebSocket requer token Firebase e membership ativa antes de associar uma
  ligação à instituição; uma subscrição não pode trocar de instituição.
- O papel `institution_admin` é temporariamente mapeado para `admin` apenas
  para compatibilidade dos endpoints legados durante a migração controlada.

## Consequências e próximos passos

As tabelas legadas ainda não têm `institution_id` como chave estrangeira. Elas
não devem receber novas capacidades interinstitucionais até serem migradas.
A próxima missão aplica a mesma chave e filtros a Pessoas/Alunos, Documentos,
Financeiro e Comunicação, com testes negativos de leitura e escrita entre duas
instituições.

## Rollback

O rollback é de código: restaurar a versão anterior do middleware. Não há
migração destrutiva nem remoção de dados nesta decisão. Não se deve reativar a
inferência por domínio ou cabeçalhos como alternativa de produção.
