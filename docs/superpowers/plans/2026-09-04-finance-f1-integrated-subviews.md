# Implementation Plan — FINANCE-F1-01 Integrated Subviews Navigation Refactor

**Goal:** Refactor the Fee Catalogue interaction model from modal dialogs to integrated internal subviews within `FinanceFeeCatalogueWorkspace`, adhering to the frozen design specification in `docs/superpowers/specs/2026-09-04-finance-f1-fee-catalogue-ux-structure-design.md`.

---

## User Review & Invariants
- **Zero Modal Overlays**: No floating dialogs, no backdrop overlays (`bg-black/70`, `backdrop-blur`).
- **Single Principal Surface**: Exactly one view rendered at a time (`list`, `create`, `version`, `history`).
- **Sidebar Stability**: Permanent sidebar navigation remains `Finanças & Contas → Catálogo de Emolumentos`. Subviews are internal workspace states.
- **Backend & Domain Preservation**: No changes to PostgreSQL schema, Money model, idempotency, or API contracts.
- **Date Automation**: Preserve `fee-catalogue-date.ts` canonical calculations for `v(n+1)` effective date proposals.

---

## Proposed Changes

### 1. View Components (`src/components/finance/fee-catalogue/`)

#### [NEW] `FeeCatalogueCreateView.tsx`
- Replaces `FeeCatalogueCreateDialog.tsx`.
- Integrated full-width page shell with top navigation: `← Catálogo de Emolumentos`.
- Clean form groupings: Identity & Classification (code, name, kind), Monetary Parameters (amount, currency), Validity & Description (effectiveFrom, description).
- Actions: `Voltar ao catálogo` (cancel/back) and `Criar emolumento` (submit).
- On success: refreshes catalog and returns to list view.

#### [NEW] `FeeCatalogueVersionView.tsx`
- Replaces `FeeCatalogueVersionDialog.tsx`.
- Integrated page shell with top navigation: `← Catálogo de Emolumentos` and header `Publicar Nova Versão — <CODE>`.
- Read-only context card displaying active version details ($v_n$, amount, validity interval, status).
- Version definition fields initialized with current values; automatic `effectiveFrom` proposed via `nextValidEffectiveFrom`.
- Supports amount-only update workflow without touching the proposed date.
- Actions: `Voltar ao catálogo` (cancel/back) and `Guardar nova versão` (submit).
- On success: refreshes catalog and returns to list view.

#### [NEW] `FeeCatalogueHistoryView.tsx`
- Replaces `FeeCatalogueHistoryDialog.tsx`.
- Integrated page shell with top navigation: `← Catálogo de Emolumentos` and header `Histórico de Versões — <CODE>`.
- Fetches full version history via `feeCatalogueClient.get(item.id, true)`.
- Renders timeline with version badges ($v_1, v_2, \dots$), active status indicator, amount, validity dates, and description notes.
- Action: `← Voltar ao catálogo`.

#### [MODIFY] `FinanceFeeCatalogueWorkspace.tsx`
- Introduce explicit state type:
  ```typescript
  export type FeeCatalogueView =
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'version'; item: FeeCatalogueRecord }
    | { kind: 'history'; item: FeeCatalogueRecord };
  ```
- Replace boolean/nullable state flags (`isCreateOpen`, `editingItem`, `historyItem`) with a single `view: FeeCatalogueView` state variable (default `{ kind: 'list' }`).
- Conditionally render exactly ONE view component at a time:
  - `view.kind === 'list'` -> `<FeeCatalogueList ... />`
  - `view.kind === 'create'` -> `<FeeCatalogueCreateView onBack={() => setView({ kind: 'list' })} onCreated={handleCreated} />`
  - `view.kind === 'version'` -> `<FeeCatalogueVersionView item={view.item} onBack={() => setView({ kind: 'list' })} onUpdated={handleUpdated} />`
  - `view.kind === 'history'` -> `<FeeCatalogueHistoryView item={view.item} onBack={() => setView({ kind: 'list' })} />`

#### [DELETE] Obsolete Dialogs
- Delete `FeeCatalogueCreateDialog.tsx`
- Delete `FeeCatalogueVersionDialog.tsx`
- Delete `FeeCatalogueHistoryDialog.tsx`

---

### 2. Automated Test Suite

#### [MODIFY] `tests/finance-fee-catalogue-ui.test.ts`
- Update tests to assert integrated subviews and single-surface rendering:
  - **Test 1 (Default List)**: Assert list rendered, no forms, no dialogs.
  - **Test 2 (Error & Retry)**: Assert error handling and retry functionality.
  - **Test 3 (Create Subview Navigation)**: Assert clicking `+ Novo emolumento` switches surface to `FeeCatalogueCreateView` (no modal backdrop); test form submission, idempotency header, and auto-return to list.
  - **Test 4 (Version Subview Navigation & Amount Edit)**: Assert clicking `Editar` switches surface to `FeeCatalogueVersionView`; verify immutable code, context summary, automatic date, amount modification, submission, and auto-return to list.
  - **Test 5 (History Subview Navigation)**: Assert clicking `Histórico` switches surface to `FeeCatalogueHistoryView`; verify timeline render and back navigation.
  - **Test 6 (State Exclusivity)**: Assert exactly one subview exists at any point in time.
  - **Test 7 (Lifecycle Toggle)**: Assert activation/deactivation preserved.

---

## Verification Plan

### Automated Test Execution
1. Run UI unit tests:
   ```bash
   npx tsx tests/finance-fee-catalogue-ui.test.ts
   ```
2. Run Date unit tests:
   ```bash
   npx tsx tests/finance-fee-catalogue-date.test.ts
   ```
3. Run F1 Aggregate Suite:
   ```bash
   $env:TEST_DATABASE_LOCAL_AUTHORIZED="true"; npm run test:finance:f1:fee-catalogue
   ```
4. Run Foundation Suite:
   ```bash
   $env:TEST_DATABASE_LOCAL_AUTHORIZED="true"; npm run test:finance:foundation
   ```
5. Run Static Analysis & Build:
   ```bash
   npm run lint
   npm run build
   git diff --check
   npm run test:secrets
   npm run test:artifacts
   ```

### Human UAT Verification
- Portal running at `http://localhost:3000`.
- Verify flow in browser:
  - Open `Finanças & Contas → Catálogo de Emolumentos`.
  - Click `+ Novo emolumento` -> verify full subview without backdrop.
  - Create fee item -> verify return to list with new item.
  - Click `Editar` -> verify full subview with active version summary and auto date.
  - Change only amount -> save -> verify v2 in list.
  - Click `Histórico` -> verify full timeline subview and return button.
  - Toggle activate/deactivate.
