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

## Consequências

As tabelas legadas ainda não têm isolamento institucional uniforme. Elas não
devem receber novas capacidades interinstitucionais enquanto o respetivo
caminho autoritativo não tiver tenant ownership explícito, filtros/constraints
adequados e testes negativos cross-tenant.

A ordem e o âmbito de qualquer migração posterior são definidos exclusivamente
por `docs/roadmap/IMPLEMENTATION_PLAN_VNEXT_V2.md` e pelo Mission Pack ativo.
Este ADR define o invariante de contexto institucional; não autoriza nem agenda
uma missão futura específica.

## Rollback

O rollback é de código: restaurar a versão anterior do middleware. Não há
migração destrutiva nem remoção de dados nesta decisão. Não se deve reativar a
inferência por domínio ou cabeçalhos como alternativa de produção.
