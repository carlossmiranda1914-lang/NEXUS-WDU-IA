# FINANCE-F1-01: Fee Catalogue Structural UX & Information Architecture Design

## 1. Executive Summary & Design Scope
This specification defines the human-approved Design A architecture for the **Fee / Emolument Catalogue** (`FINANCE-F1-01`) within the NEXUS EDU IA Finance vertical (`Finanças & Contas → Catálogo de Emolumentos`).

The goal is to establish a clear, resilient, and professional structural pattern for Finance verticals:
1. **Primary Workspace**: The catalogue list/table is the primary default surface. Creation and editing forms do not occupy persistent empty space on the screen.
2. **Dedicated Focused Surfaces**:
   - `Novo emolumento` opens a dedicated creation modal/dialog (`FeeCatalogueCreateDialog`).
   - `Editar` opens a dedicated version publishing modal/dialog (`FeeCatalogueVersionDialog`).
   - `Histórico` opens a dedicated read-only version timeline (`FeeCatalogueHistoryDialog`).
3. **Canonical Date Utilities**: Automatic calculation of valid next effective dates that prevent temporal constraint collisions across local browser timezones (WEST/UTC+1) and backend UTC storage.

---

## 2. Domain Contract & Invariants

### A. Catalogue Item Identity
- **Institutional Scoping**: Every item belongs strictly to an `institution_id`. Cross-tenant queries fail closed (HTTP 404).
- **Code (`code`)**: Natural business key (e.g. `PROP-REGULAR`, `CERT-01`). Upper-cased, unique per institution, and strictly immutable once created.
- **Status (`status`)**: Operational state (`'active' | 'inactive'`).
- **Current Version (`currentVersion`)**: Monotonically increasing positive integer ($1, 2, 3, \dots$).
- **History (`history`)**: Append-only sequence of immutable version rows representing past and present definitions.

### B. Create Initial Item ($v_1$)
- **Surface**: `FeeCatalogueCreateDialog`
- **Fields**:
  - `code`: Required, string, upper-case normalized, unique.
  - `name`: Required, non-empty string.
  - `kind`: Required, non-empty string (e.g. `tuition`, `fee`, `service`).
  - `amount`: Required positive `ExactDecimal` (supports `,` and `.` decimal separators).
  - `currency`: Required canonical registered currency enabled in the institution's financial profile (e.g. `EUR`).
  - `effectiveFrom`: Required ISO-8601 timestamp representing the starting validity of $v_1$ (defaults to current time).
  - `description`: Optional nullable string.
- **Result**: Inserts item with `status = 'active'`, `current_version = 1`, and creates version 1 with `effective_to = NULL`.

### C. Publish New Version ($v_{n+1}$)
- **Surface**: `FeeCatalogueVersionDialog`
- **Identity Protection**: `code` is immutable and displayed in read-only format.
- **Editable Versioned Fields**:
  - `name`: Name for the new version.
  - `kind`: Kind classification.
  - `amount`: New positive amount.
  - `currency`: Currency code.
  - `description`: Optional notes.
  - `effectiveFrom`: Validity start timestamp of the new version.
- **Concurrency Control**: Requires `expectedVersion = currentVersion` (`HTTP 409` on mismatch).
- **Result**: Sets previous version's `effective_to = newEffectiveFrom`, inserts version $n+1$ with `effective_to = NULL`, increments `current_version` to $n+1$.

### D. Lifecycle Actions (Activation / Deactivation)
- **Endpoints**: `POST /api/finance/fee-catalogue/:id/activate` and `POST /api/finance/fee-catalogue/:id/deactivate`.
- **Contract**: Toggles `status` (`'active'` $\leftrightarrow$ `'inactive'`). Does NOT create a new financial version row.
- **Idempotency**: Retrying with the same `Idempotency-Key` safely returns the existing item without side effects.

### E. Temporal Invariant & Automatic UI Date Computation
- **PostgreSQL Invariant**: Check constraint `finance_fee_catalogue_versions_effective_interval` enforces:
  $$\text{effective\_to} \text{ IS NULL} \lor \text{effective\_to} > \text{effective\_from}$$
- **Version Transition Rule**:
  $$\text{newEffectiveFrom} > \text{currentEffectiveFrom}$$
- **Automated Default Calculation**:
  The UI computes the default candidate effective date automatically without requiring manual mathematical calculations by the user:
  $$\text{candidateDate} = \max(\text{now rounded up to next minute}, \text{currentEffectiveFrom} + 1\text{ minute})$$
- Truncation to minute precision in HTML `<input type="datetime-local">` is accounted for explicitly so that the parsed input ISO string is guaranteed to be strictly greater than `currentEffectiveFrom`.
- Manual editing of `effectiveFrom` remains available for deliberate future scheduling.

### F. Error Handling & Architectural Safety
- **Typed HTTP Status Codes**:
  - `401 Unauthorized`: Token missing or invalid.
  - `403 Forbidden`: Role not authorized for fee catalogue read or write.
  - `404 Not Found`: Item does not exist or belongs to another institution.
  - `409 Conflict`: Concurrency conflict (stale `expectedVersion`) or duplicate `code`.
  - `422 Unprocessable Entity`: Validation failure (negative amount, invalid currency, non-posterior date).
  - `500 Internal Server Error`: Safe generic fallback (`"Catalogue operation failed"`) logged to server stderr. No SQL strings, table names, or constraint identifiers leaked to browser.
- **Zero Journal / Zero Projection Guarantee**: Fee catalogue mutations produce 0 facts in `finance_journal_transactions` and 0 balance movement in `finance_position_projection`.
- **No Authority in Browser**: Institution ID and Person ID authority originate exclusively from validated Firebase ID token sessions on the backend.

---

## 3. Modular Frontend Architecture

Refactored structure in `src/components/finance/fee-catalogue/`:

```
src/components/finance/fee-catalogue/
├── fee-catalogue-date.ts              # Canonical date helpers & minute-precision converters
├── FeeCatalogueList.tsx               # Primary list/table view with status, version, and action buttons
├── FeeCatalogueCreateDialog.tsx       # Dedicated modal for creating v1
├── FeeCatalogueVersionDialog.tsx      # Dedicated modal for publishing v(n+1)
├── FeeCatalogueHistoryDialog.tsx      # Read-only version timeline drawer/modal
└── FinanceFeeCatalogueWorkspace.tsx   # Top-level orchestrator & consumer interface
```

---

## 4. Verification & Regression Plan
- Unit tests for date calculations: `tests/finance-fee-catalogue-date.test.ts`.
- Component interaction & contract tests: `tests/finance-fee-catalogue-ui.test.ts`.
- PostgreSQL integration & HTTP contract tests: `tests/finance-fee-catalogue-http.test.ts`.
- Full F1 aggregate and Finance Foundation regression gates.
