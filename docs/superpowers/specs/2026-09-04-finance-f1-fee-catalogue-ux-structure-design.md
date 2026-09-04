# FINANCE-F1-01: Fee Catalogue Structural UX & Information Architecture Design

## 1. Executive Summary & Approved Navigation Model
This specification defines the human-approved **Integrated Subviews Navigation Architecture** for the **Fee / Emolument Catalogue** (`FINANCE-F1-01`) within the NEXUS EDU IA Finance vertical (`Finanças & Contas → Catálogo de Emolumentos`).

### Navigation Hierarchy & Principle:
Permanent sidebar navigation remains simple and coherent:
```
Finanças & Contas
└── Catálogo de Emolumentos
```
The operations for creating items, publishing new versions, and auditing history are **NOT separate sidebar routes**, nor are they modal overlays. They are **integrated internal subviews** managed by a deterministic state machine within `FinanceFeeCatalogueWorkspace`:

```
CATALOGUE LIST (Default Surface)
├── [Click + Novo emolumento]     ──> CREATE SUBVIEW     ──> [Save/Back] ──> CATALOGUE LIST
├── [Click Editar]                ──> VERSION SUBVIEW    ──> [Save/Back] ──> CATALOGUE LIST
└── [Click Histórico]             ──> HISTORY SUBVIEW    ──> [Back]      ──> CATALOGUE LIST
```

### Invariants:
1. **Zero Modal Overlays**: All interactions occur directly within the central workspace content area.
2. **Single Surface Rendering**: Exactly ONE principal view (`list`, `create`, `version`, or `history`) is rendered at a time. No floating generic CRUD boxes, no backdrop blur overlays, and no persistent empty forms occupying space.
3. **Integrated Page Shell**: Each subview features a contextual back action (`← Catálogo de Emolumentos`), section title, and structured form/timeline layout.
4. **Extensibility**: Establishes a standard pattern where future Finance capabilities (charges, payments, reconciliation) can exist as sibling areas within `Finanças & Contas` without altering Fee Catalogue contracts.

---

## 2. Workspace View State Machine

```typescript
export type FeeCatalogueView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'version'; item: FeeCatalogueRecord }
  | { kind: 'history'; item: FeeCatalogueRecord };
```

- **Initial State**: `{ kind: 'list' }`
- **Transitions**:
  - `LIST -> CREATE`: `setView({ kind: 'create' })`
  - `LIST -> VERSION`: `setView({ kind: 'version', item })`
  - `LIST -> HISTORY`: `setView({ kind: 'history', item })`
  - `* -> LIST`: `setView({ kind: 'list' })` (with catalog refresh on mutations)

---

## 3. Domain Contract & Invariants

### A. Catalogue Item Identity
- **Institutional Scoping**: Every item belongs strictly to an `institution_id`. Cross-tenant queries fail closed (HTTP 404).
- **Code (`code`)**: Natural business key (e.g. `PROP-REGULAR`, `CERT-01`). Upper-cased, unique per institution, strictly immutable once created.
- **Status (`status`)**: Operational state (`'active' | 'inactive'`).
- **Current Version (`currentVersion`)**: Monotonically increasing positive integer ($1, 2, 3, \dots$).
- **History (`history`)**: Append-only sequence of immutable version rows representing past and present definitions.

### B. Create Subview ($v_1$) — `FeeCatalogueCreateView`
- **Surface**: Full integrated subview replacing the list.
- **Fields**:
  - `code`: Required, string, upper-case normalized, unique.
  - `name`: Required, non-empty string.
  - `kind`: Required, non-empty string (e.g. `tuition`, `fee`, `service`).
  - `amount`: Required positive `ExactDecimal` (supports `,` and `.` decimal separators).
  - `currency`: Required canonical registered currency enabled in the institution's financial profile (e.g. `EUR`).
  - `effectiveFrom`: Required ISO-8601 timestamp representing the starting validity of $v_1$ (defaults to current time).
  - `description`: Optional nullable string.
- **Result**: Inserts item with `status = 'active'`, `current_version = 1`, and creates version 1 with `effective_to = NULL`. On completion, automatically returns to the list view with the new item visible.

### C. Version Subview ($v_{n+1}$) — `FeeCatalogueVersionView`
- **Surface**: Full integrated subview representing "Publicar Nova Versão".
- **Context Box**: Summarizes active version ($v_n$):
  - Immutable `code`
  - Active version number ($v_n$)
  - Current amount & currency
  - Active validity start date
  - Operational status
- **Version Definition Fields**:
  - `name`: Initialized with current name.
  - `kind`: Initialized with current kind.
  - `amount`: Initialized with current amount.
  - `currency`: Initialized with current currency.
  - `effectiveFrom`: Automatically proposed next valid timestamp strictly posterior to $v_n$.
  - `description`: Initialized with current description.
- **Amount-Only Mutation**: User can change ONLY the amount (e.g. `75.50` $\rightarrow$ `85.00`) and click "Guardar nova versão" to publish $v_{n+1}$ without manually modifying timestamps.
- **Result**: Sets previous version's `effective_to = newEffectiveFrom`, inserts version $n+1$, increments `current_version`, and returns to the catalogue list.

### D. History Subview — `FeeCatalogueHistoryView`
- **Surface**: Full integrated subview displaying the immutable audit trail.
- **Timeline Display**:
  - Version number badge ($v_1, v_2, \dots$) with active indicator.
  - Name, kind, and formatted amount + currency.
  - Validity interval (`Desde [data] até [data | Atualidade]`).
  - Change notes / descriptions.
- **Read-Only**: No inline editing; clean back button to return to the catalogue list.

### E. Lifecycle Actions
- **Endpoints**: `POST /api/finance/fee-catalogue/:id/activate` and `POST /api/finance/fee-catalogue/:id/deactivate`.
- **Contract**: Toggles `status` (`'active'` $\leftrightarrow$ `'inactive'`). Does NOT create a new financial version.

### F. Temporal Invariant & Automatic Date Computation
- Check constraint `finance_fee_catalogue_versions_effective_interval`:
  $$\text{effective\_to} \text{ IS NULL} \lor \text{effective\_to} > \text{effective\_from}$$
- Helper `nextValidEffectiveFrom(currentEffectiveFrom, now)` ensures candidate date is strictly posterior accounting for minute precision of HTML inputs.

### G. Error Handling & Architectural Safety
- Typed status codes: `401`, `403`, `404`, `409`, `422`, with safe generic `500` fallback logged server-side.
- Zero Journal facts and zero balance projection movements.
- No client-side authority for institution or person identities.

---

## 4. Component Hierarchy

```
src/components/finance/fee-catalogue/
├── fee-catalogue-date.ts              # Canonical date helpers & minute-precision converters
├── FeeCatalogueList.tsx               # Default home surface (table/cards, CTA, filters)
├── FeeCatalogueCreateView.tsx         # Integrated subview for creating v1
├── FeeCatalogueVersionView.tsx        # Integrated subview for publishing v(n+1)
├── FeeCatalogueHistoryView.tsx        # Integrated read-only history timeline subview
└── FinanceFeeCatalogueWorkspace.tsx   # Top-level orchestrator & state machine
```
