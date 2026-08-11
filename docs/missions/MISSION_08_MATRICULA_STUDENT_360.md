# Missão 08 — Preparar Matrícula Integrada e Student 360

**Estado:** PREPARAÇÃO — ainda não iniciar implementação funcional ou visual.

## Decisão de prioridade

O Plano Mestre v4.2 define a Fase 2 como o primeiro fluxo vertical do Nexus: matrícula integrada. Esta missão inicia essa fase pela preparação do contrato do produto e dos dados, evitando criar ecrãs que apenas simulem operações.

## Resultado esperado da fase seguinte

Uma secretaria consegue iniciar uma matrícula, identificar ou criar a pessoa correta, relacionar aluno e encarregado, acompanhar documentos e ver o estado do processo. Cada passo deve ter responsável, estado, evidência e histórico.

## Esta missão prepara, mas não implementa ainda

1. O modelo de dados mínimo: pessoa, aluno, encarregado, candidatura/matrícula, ano letivo, oferta/turma e checklist documental.
2. A máquina de estados: rascunho, em análise, a aguardar documentos, validada, bloqueada, ativa e cancelada.
3. As regras de autorização por papel e instituição.
4. As APIs e eventos necessários, sem aceitar IDs fixos ou dados fictícios como fonte de verdade.
5. O plano de interface para Secretaria em desktop, tablet e telemóvel.
6. O plano de prova com duas escolas e utilizadores reais de teste.

## Fora do âmbito inicial

- confirmação de pagamento, recibo ou conciliação financeira;
- assinatura qualificada e certificados oficiais;
- integração de fornecedor de mensagens ou pagamentos;
- conversão global da interface antiga;
- apagar os módulos demonstrativos antigos.

## Critérios READY para implementação

- Uma decisão escrita define o identificador único do aluno e a relação entre `people`, `student_profiles` e o fluxo de matrícula.
- Todos os estados, transições, bloqueios e responsáveis estão definidos.
- Os documentos obrigatórios são configuráveis por oferta/ciclo, não codificados no ecrã.
- Cada entidade nova contém `institution_id` e é filtrada no servidor.
- Ações de secretaria, direção e encarregado têm permissões e auditoria definidas.
- A experiência especifica estados de loading, vazio, erro, conflito e sucesso nos três dispositivos.
- Existe um teste negativo para escola A contra escola B e para cada transição não autorizada.

## Riscos que a Missão 08 deve resolver antes de implementar

- O frontend atual ainda contém dados e IDs de demonstração, incluindo `ALU-101`; não pode ser reutilizado como contrato de matrícula.
- Documentos atuais ainda não constituem armazenamento documental oficial e autorizado.
- O repositório contém módulos grandes e simuladores; a nova experiência deve ser modular e isolada, sem aumentar `App.tsx` ou `server.ts` desnecessariamente.
- A interface ainda não tem seleção visual de instituição para memberships múltiplas; o backend mantém bloqueio seguro até essa experiência existir.

## Prova de conclusão da futura implementação

1. Criar uma matrícula de teste na escola A.
2. Guardar, reiniciar e recuperar o processo e a linha temporal.
3. Confirmar que a escola B não lê, altera nem recebe eventos desse processo.
4. Confirmar que um encarregado apenas vê os seus próprios educandos.
5. Validar os mesmos estados principais em desktop, tablet e telemóvel.
