# Missão 05 — WebSocket e eventos em tempo real por instituição

## Objetivo

Garantir que as atualizações em tempo real nunca atravessam a fronteira entre instituições.

## Controlos implementados

- A ligação WebSocket exige um token Firebase válido.
- O servidor resolve a instituição a partir da membership ativa; o navegador não escolhe livremente uma sala.
- Uma identidade com mais de uma instituição sem seleção explícita é recusada de forma segura.
- Cada socket é associado à respetiva `institutionId` apenas depois da validação no servidor.
- Uma tentativa de subscrever outra instituição é recusada.
- Eventos de tarefas são encaminhados apenas para a sala institucional de origem.
- O canal envia apenas `REFRESH_DATA` sem dados de tarefa; os dados são obtidos depois por APIs autorizadas.
- Eventos legados sem contexto institucional continuam deliberadamente bloqueados.

## Evidência de validação

- Compilação de produção concluída.
- Verificação de tipos concluída.
- 20 testes automatizados passaram, incluindo:
  - uma escola não recebe evento da outra;
  - evento sem instituição é recusado;
  - socket não pode mudar de instituição por mensagem;
  - o encaminhamento de tarefas preserva a instituição de origem;
  - as proteções de persistência e autorização anteriores mantêm-se válidas.

## Limite intencional

O produto ainda não oferece no ecrã a escolha de instituição para utilizadores com memberships em várias escolas. Até essa experiência existir, o WebSocket recusa essa ligação em vez de assumir uma escola. É uma limitação funcional segura, não uma exceção de segurança.
