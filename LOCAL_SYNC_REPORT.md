# Relatório de Sincronização Local e Auditoria (Local Sync Report)

**Data:** 10 de Outubro de 2026  
**Branch de Salvaguarda:** `antg-sync-dump-local` (baseada em `codex/nexus-integrated-portal-v1`)  
**Commit de Salvaguarda:** `e4911a2` (`chore: DUMP Antigravity - Sincronizacao de seguranca do estado local`)  
**Remoto:** Sincronizado e enviado com sucesso para `origin/antg-sync-dump-local`

---

## 1. Resumo do Diagnóstico do Workspace

- **Ficheiros Totais Salvos no Dump:** 56 ficheiros (8809 inserções, 230 deleções).
- **Componentes Alterados:** Documentos (`DocumentDetailDrawer.tsx`, `DocumentTable.tsx`, `local-uat-storage-provider.ts`), Finanças (`FinancePaymentCreateView.tsx`, `payment-repository.ts`, `payment-service.ts`).
- **Scripts e Testes Untracked Integrados no Dump:** Scripts de auditoria dinâmica de escala (`documents-dynamic-scale-audit.mjs`), scripts de transição (`prepare-h1-*`), migração `0038_documents_storage_content_availability.sql`, e harnesses de teste e reconciliação de storage.
- **Integridade do Repositório:** O estado de trabalho pendente foi completamente preservado sem perdas e sem destruição de histórico.

---

## 2. Desvios em Relação à Arquitetura Canónica (Gap Analysis vs. `IMPLEMENTATION_PLAN_VNEXT_V2.md`)

| Domínio / Área | Estado Documentado / Canónico (`vNext`) | Estado Factual no Código Local | Desvio Identificado |
|---|---|---|---|
| **Finanças & Ledger (Part 6)** | Ledger imutável, modelo de obrigações/pagamentos com contas financeiras ativas, idempotência estrita via `executeIdempotentFinanceCommand`, proibição do uso de `outstandingFees` como autoridade de saldo. | `FinancialPanel.tsx` persiste faturas e despesas em `localStorage` (`nexus_invoices`, `nexus_expenses`). `StudentsList.tsx` e `App.tsx` realizam mutações manuais diretas a `outstandingFees` no cliente. `server.ts` possui rotas legadas (`/api/invoices`) que alteram `students.outstandingFees` diretamente, embora atualmente bloqueadas por 503. | **P0 - Violação de Autoridade Financeira e Product Truth**: Persistência no cliente / browser masquerading como estado financeiro. |
| **Corpo Docente / Academic Core (Part 4)** | Modelo canónico relacional temporal: `Teacher × Class × Subject × AcademicYear`, resolução institucional estrita via IAM. | `TeachersList.tsx` (991 linhas) está totalmente desligado do fluxo principal da aplicação. Ao selecionar a tab de Docentes, `App.tsx` apresenta um painel de indisponibilidade (`FactualUnavailablePanel`), e as rotas `/api/teachers` em `server.ts` retornam 503 (`CANONICAL_TENANT_AUTHORITY_REQUIRED`). | **P1 - UI Fantasma**: Componente órfão rico no frontend que não opera sobre base institucional canónica. |
| **Comunicação, Processos e Assinaturas (Part 8)** | Infraestrutura institucional transacional com auditoria e confirmação de entrega. | As tabs de `communications`, `workflows`, `signatures` e `sheets` renderizam barreiras de bloqueio informativo (`FactualUnavailablePanel`), ocultando código legado e impedindo efeitos colaterais fictícios. | **P1 - Funcionalidades Retidas por Falta de Autoridade Canónica**. |
| **Matrículas & Alunos (Part 3 & 5)** | Intake transacional, resolução de identidade canónica, transições formais de estado através de `registerEnrollmentRoutes`. | `EnrollmentOperationsWorkspace.tsx` consome os endpoints vNext autorizados, mas ficheiros residuais como `MatriculaPortal.tsx` e `SchoolMigration.tsx` ainda operam com conceitos pré-vNext de dívidas e mutações pontuais. | **P2 - Dívida Técnica Residual de Migração**. |
| **Armazenamento de Documentos (Part 8)** | Abstração multicloud (GCP/Local) com atomicidade, metadados persistentes e hash SHA-256 verificado. | A branch local continha melhorias substanciais no `LocalUatObjectStorageProvider` (removendo retenção de buffers em memória para evitar memory leaks sob carga de 6000+ ficheiros) e scripts de reconciliação de conteúdo pendentes de consolidação formal. | **P2 - Reforço Operacional Local**: Necessidade de fechar formalmente a suíte de reconciliação e validação durável. |

---

## 3. Os 3 Ficheiros com Mais "Remendos" (Tech Debt / Workarounds)

Estes três ficheiros concentram as maiores violações aos contratos de integridade arquitetural e necessitam de ser descartados ou refatorados para código transacional canónico:

### 1. `src/components/FinancialPanel.tsx`
- **Diagnóstico:** Mais de 10 chamadas diretas a `localStorage.setItem('nexus_invoices', ...)` e `localStorage.setItem('nexus_expenses', ...)`.
- **Problema:** Simula faturamento, pagamentos e despesas no armazenamento local do browser. Não respeita limites transacionais, concorrência, idempotência nem o modelo de contas/ledger implementado em `src/modules/finance/`.
- **Ação Recomendada:** Descarte total ou substituição integral pelo `FinanceWorkspace.tsx` modular.

### 2. `server.ts`
- **Diagnóstico:** Monólito de ~5900 linhas contendo endpoints legados (`/api/teachers`, `/api/invoices`, `/api/invoices/pay`, `/api/invoices/cancel`) com retornos precoces `res.status(503)` colocados como "cercas" de segurança, mas mantendo abaixo centenas de linhas de código morto com mutações diretas a tabelas (`students.outstandingFees`, logs operacionais síncronos, broadcasts não autorizados).
- **Problema:** Duplicação de autoridade e risco de contorno acidental dos módulos de domínio canónicos (`src/modules/enrollments`, `src/modules/finance`, `src/modules/documents`).
- **Ação Recomendada:** Limpeza das rotas legadas mortas e delegação estrita para os controladores dos módulos canónicos.

### 3. `src/components/StudentsList.tsx`
- **Diagnóstico:** Mutações no cliente como:
  ```ts
  const rem = Math.max(0, prev.outstandingFees - inv.amount);
  onUpdateStudent(prev.id, { outstandingFees: rem });
  ```
- **Problema:** O frontend assume o papel de cálculo e autoridade financeira de saldos pendentes do aluno, colidindo frontalmente com a regra canónica: *"The legacy outstandingFees field cannot remain balance authority"*.
- **Ação Recomendada:** Eliminar a edição/recálculo de saldos nesta view e consumir estritamente a projeção de leitura do domínio financeiro (`FinanceWorkspace` / read-models de Finance).
