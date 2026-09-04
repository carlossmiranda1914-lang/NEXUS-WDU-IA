# Implementation Plan — FINANCE-F1 Final Maturity Slice: Institutional Fee Types + Canonical Operational Code

**Goal:** Complete Phase 1 Fee Catalogue hardening by replacing free-text `kind` and manual `code` input with a PostgreSQL-backed Institutional Fee Type Registry and concurrency-safe backend operational code generation (`<PREFIX>-<SEQUENCE>`).

---

## User Review & Invariants
- **Institutional Fee Type Registry**: `finance_fee_types` table with Nexus baseline types and custom institutional types.
- **Backend Operational Code Generation**: Atomic counter table `finance_fee_code_counters`; code format `<PREFIX>-000001` generated server-side.
- **Code Immutability**: Code generated on item creation remains immutable across versions and lifecycle mutations.
- **Referential Integrity**: Referenced fee types cannot be deleted destructively (`ON DELETE RESTRICT`).
- **Single-Surface Integrated Workspace**: Internal subviews (`list`, `create`, `types`, `version`, `history`) inside `FinanceFeeCatalogueWorkspace`.
- **Zero Cross-Module Leaks**: No direct student billing, no payments, no enrollment execution in this slice.

---

## Proposed Changes

### 1. Database Migrations
#### [NEW] `src/db/migrations/0032_finance_fee_types_and_code_generation.sql`
- Create `finance_fee_types` table (`id`, `institution_id`, `canonical_key`, `source`, `display_name`, `code_prefix`, `status`, `created_at`, `updated_at`).
- Create `finance_fee_code_counters` table (`institution_id`, `fee_type_id`, `last_sequence`).
- Seed Nexus baseline types for all existing institutions in `institutions`.
- Add `fee_type_id` column to `finance_fee_catalogue_items` and `finance_fee_catalogue_versions`.
- Reconcile legacy `kind` values into appropriate `fee_type_id` references.
- Set `NOT NULL` and `FOREIGN KEY ... REFERENCES finance_fee_types(institution_id, id) ON DELETE RESTRICT`.
- Initialize counters for existing items.

---

### 2. Backend Modules (`src/modules/finance/`)
#### [NEW] `src/modules/finance/fee-type-model.ts`
- Types: `FeeType`, `CreateFeeTypeInput`, `UpdateFeeTypeInput`, `FeeTypeValidationError`.
- Baseline definitions constant: `NEXUS_BASELINE_FEE_TYPES`.

#### [NEW] `src/modules/finance/fee-type-repository.ts`
- `PostgresFeeTypeRepository`:
  - `ensureBaselineTypes(institutionId)`
  - `list(actor, status)`
  - `getById(actor, id)`
  - `create(actor, input, idempotencyKey)`
  - `update(actor, id, input, idempotencyKey)`
  - `setStatus(actor, id, status, idempotencyKey)`

#### [NEW] `src/modules/finance/fee-type-http.ts`
- Routes:
  - `GET /api/finance/fee-types`
  - `POST /api/finance/fee-types`
  - `PUT /api/finance/fee-types/:id`
  - `POST /api/finance/fee-types/:id/activate`
  - `POST /api/finance/fee-types/:id/deactivate`

#### [MODIFY] `src/modules/finance/fee-catalogue-model.ts`
- Update `CreateFeeCatalogueInput`: `{ feeTypeId, name, description?, amount, currency, effectiveFrom }` (no manual `code`).
- Update `UpdateFeeCatalogueInput`: `{ expectedVersion, feeTypeId?, name, description?, amount, currency, effectiveFrom }`.
- Update `FeeCatalogueVersion` and `FeeCatalogueItem` to include `feeTypeId` and `feeType`.

#### [MODIFY] `src/modules/finance/fee-catalogue-repository.ts`
- In `create`: Verify `feeTypeId` is active for the institution, atomically increment counter, generate `<PREFIX>-<SEQUENCE>`, insert item & version with `fee_type_id`.
- In `update`: Validate `feeTypeId` (or preserve existing), insert new version with `fee_type_id`.
- In `list` / `get`: Join `finance_fee_types` to populate `feeType` metadata.

#### [MODIFY] `src/modules/finance/fee-catalogue-client.ts`
- Add Fee Type client methods: `listTypes`, `createType`, `updateType`, `setTypeStatus`.
- Update `CreateFeeCatalogueInput` and `FeeCatalogueRecord`.

---

### 3. Frontend Components (`src/components/finance/fee-catalogue/`)
#### [NEW] `FeeCatalogueTypesView.tsx`
- Integrated subview for Fee Type management (`Gerir tipos`).
- Displays table/list of baseline and custom types.
- Inline form to add institutional custom type (display name + prefix).
- Status toggle buttons (Ativar/Desativar).
- Back navigation link `← Catálogo de Emolumentos`.

#### [MODIFY] `FeeCatalogueCreateView.tsx`
- Remove free-text `code` and `kind` input fields.
- Add `Tipo de Emolumento` combobox/select populated with active fee types.
- Display contextual hint showing the code prefix and auto-generation format (e.g. `PROP-000001`).

#### [MODIFY] `FeeCatalogueVersionView.tsx`
- Display immutable code.
- Add Fee Type selection dropdown with current type preselected.

#### [MODIFY] `FeeCatalogueList.tsx`
- Add `Gerir tipos` button in header.
- Display `item.current.feeType.displayName` instead of free-text kind.

#### [MODIFY] `FinanceFeeCatalogueWorkspace.tsx`
- Support `view: { kind: 'types' }`.

---

### 4. Tests
- PostgreSQL-backed tests for Fee Types: baseline provisioning, custom type creation, prefix uniqueness, active/inactive rules.
- PostgreSQL-backed concurrency test for code generation sequence.
- HTTP tests for `/api/finance/fee-types` and updated `/api/finance/fee-catalogue`.
- UI tests for Fee Types subview, combobox selection, and auto-generated code.
